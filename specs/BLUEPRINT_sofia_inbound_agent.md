# Blueprint: Sofia Inbound Qualification Agent

**Status:** Pending (awaiting DECISION #2 before Designer hands off to Coder)
**Author:** Architect
**Date:** 2026-04-13
**Initiative:** First production voice flow — the agent behind the "Call Sofia" hero CTA on callsofia.ca → `+1 (873) 736-0217`

---

## What we are building

The first real Sofia voice conversation: a 60–90 second bilingual (FR/EN) inbound qualification flow that greets a prospect, figures out what they want, and SMS-hands a structured lead summary to Parviz. This is not a demo scaffold; it is the live agent any prospect hears when they press the hero CTA. Everything about its architecture — file layout, prompt loading, tool-based state, lead handoff — becomes the template for future per-client personas (`salon-sofia`, `dental-sofia`, etc.).

## Why this matters

The hero CTA is the single highest-intent funnel entry on callsofia.ca. Whoever answers *is* the demo. The first 90 seconds decide whether Sofia is "a real AI receptionist I want to buy" or "a janky chatbot that proves Parviz can't ship." There is no B surface. The architecture must be boring, debuggable, and evolvable — not clever.

## System impact

Touches:

- `backend/relay.js` — where the agent logic lives today as a 14-line inline `SYSTEM_PROMPT`. This becomes a thin orchestrator that loads a persona module.
- `backend/server.js` — unchanged except possibly one env var read for Twilio SMS creds (already set per `backend/README.md` deploy list).
- New directory `backend/agents/` — persona modules (pattern for future personas).
- New directory `backend/tools/` — tool-call handlers invoked by the model (`submit_lead`, `send_sms_link`, `end_call`).
- Outbound Twilio SMS REST call — not yet used anywhere in backend; same pattern as the existing Netlify `submission-created` function (direct `fetch` against Twilio REST, no SDK).

**What breaks if we get this wrong:** Caller hangs up in the first 20 seconds → zero signal that the product works → Parviz spends another week in scaffolding instead of shipping clients. A too-aggressive tool-call architecture that adds 1500ms of turn-taking latency ruins the "feels natural" bar and is not recoverable by better prompting.

---

## A. File structure & module layout

### Chosen layout

```
backend/
  agents/
    sofia-inbound.js         ← persona module (default export = PersonaConfig)
    index.js                 ← resolves a persona by key (phone number → persona)
  tools/
    submit-lead.js           ← handler for the submit_lead tool call
    send-sms-link.js         ← handler for the send_sms_link tool call
    end-call.js              ← handler for the end_call tool call
    index.js                 ← registry: name → { schema, handler }
  prompts/
    sofia-inbound.md         ← the long-form instructions text (markdown, editable without touching JS)
  relay.js                   ← existing; becomes a thin orchestrator (see below)
```

### What a `PersonaConfig` exports

```
{
  key: 'sofia-inbound',
  voice: 'shimmer' | 'nova' | 'alloy',         // see DECISION #2
  instructionsPath: './prompts/sofia-inbound.md',
  tools: ['submit_lead', 'send_sms_link', 'end_call'],
  vad: { threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 500 },
  maxCallSeconds: 360,                          // hard ceiling; Sofia wraps at maxCallSeconds-30
  metadata: { phoneNumber: '+18737360217', businessId: null }
}
```

### Rationale

- **Module not inline string.** Inline is fine for today's 14-line greeting; it breaks the moment we want (a) per-client tool lists, (b) A/B testing two prompts, (c) unit tests that assert the prompt actually mentions the Starter/Pro/Complete tiers.
- **Markdown prompt file, code-wired assembly.** The prompt is prose — markdown is the right editor. Engineers load it with `readFileSync` at module-init time (not per-call; avoids disk I/O in the hot path). Parviz or Designer can edit the prompt without touching `relay.js`.
- **`agents/` + `tools/` separation.** Tools are shared across personas (salon-Sofia also needs `send_sms_link`). Personas compose a subset. This is the same shape as LangChain, OpenAI's assistants pattern, and every production voice agent codebase worth reading — don't reinvent.
- **`relay.js` stays the orchestrator.** It still owns the Twilio ↔ OpenAI WebSocket bridge. Its `configureSession()` now reads from the persona. `handleOpenAIEvent()` gains a single new case for `response.function_call_arguments.done` that dispatches to the tool registry. No rewrite — a ~50-line addition.

### Future extensibility (item H, answered here)

When we add `salon-sofia.js`, it's a sibling file: different voice, different prompt (booking, not qualifying), different tool list (`book_appointment`, `check_availability`, `send_booking_confirmation` instead of `submit_lead`). `agents/index.js` picks the persona by the `To` number Twilio sends on the `start` event (or by a client config lookup once we have multi-client). The relay stays persona-agnostic. **This is the central architectural bet of this blueprint — keep the relay dumb, put all intelligence in persona + tool modules.**

---

## B. Prompt engineering approach

### Length target: 600–900 tokens

OpenAI Realtime's `instructions` field has no hard cap, but past ~2k tokens we've seen noticeably slower first-token latency (the session has to re-prime on every turn). 600–900 tokens is enough for:

- Identity (2–3 sentences)
- Bilingual protocol (how to open, how to switch)
- The 6-question qualification sequence with allowed variants
- Tool-use protocol (when to call `submit_lead`, when to call `send_sms_link`, when to call `end_call`)
- Guardrails (don't quote prices, don't promise SLAs, don't claim to be human)
- Voice/tone (short, warm, professional, no emoji obviously, no "As an AI…" disclaimers)

Designer writes the actual prose. Architect's spec for Designer: the prompt must be organized under the six headings above, in that order, each with a labeled anchor the Critic can grep for.

### One prompt, not two

**One bilingual mega-prompt with an explicit "after caller picks a language, respond only in that language until they switch" rule.** Reasons:

1. Swapping sessions mid-call by sending a second `session.update` with different instructions is possible but resets VAD state and can drop the first 100–300ms of the caller's next utterance. Not worth it.
2. GPT-4o handles French/English switching natively at near-parity; the weakness is TTS accent (item G), not language understanding.
3. Two prompts doubles the surface area for Designer and Critic to keep in sync.

### Voice selection

See DECISION #2. Architect's recommendation is **shimmer** for warmth + feminine presence without being saccharine. Alloy (current default) reads as a bit flat and slightly male-leaning to Quebec ears in the informal sample I mentally A/B'd against the brand — but this is a taste call Parviz must make by listening.

### Tool count: exactly 3

| Tool             | Purpose                                                                 | When model calls it                           |
| ---------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `submit_lead`    | Emits the full structured lead payload. Triggers SMS to Parviz.          | Exactly once, after final qualifying question. |
| `send_sms_link`  | Texts the caller the callsofia.ca URL (step 5 of the flow).              | If caller says yes to "want me to text you?" |
| `end_call`       | Cleanly terminates the Twilio call after the closing line finishes.      | After `submit_lead` succeeds + goodbye spoken. |

More tools = more places the model "thinks" instead of talking. Three is the minimum that lets us (a) get structured output, (b) do the concrete action the caller asked for, (c) hang up gracefully. No `set_field`-per-datum — see item C.

---

## C. State management during a call

### Chosen: structured-submission-at-end (hybrid, leaning model-context)

Sofia converses freely and relies on the model's conversation context to track who answered what. At the moment she judges the qualification complete (all 6 data points captured OR caller says "that's everything" / equivalent), she fires **exactly one** `submit_lead` tool call with the full structured payload:

```
submit_lead({
  language: "fr" | "en",
  service_interest: "starter" | "pro" | "complete" | "unsure",
  has_website: true | false | null,
  callback_window: "morning" | "afternoon" | "evening",
  wants_sms_link: true | false,
  business_type: "salon" | "clinic" | "dealership" | "other",
  business_type_other: string | null,
  caller_name: string | null,
  callback_number: string | null,     // falls back to Twilio caller ID if unprovided
  notes: string                        // Sofia's own 1-sentence summary
})
```

### Why not `set_field`-per-datum

Each tool call is ~200–400ms of latency (model stops talking, emits the call, handler responds, model resumes). Six fields × ~300ms = 1.8s of dead air across the call, which on a 60-second flow is a 3% latency tax *plus* the psychological cost: the caller hears micro-pauses and feels the machinery.

### Why not pure-context (no tool at all, log transcript post-hoc)

We'd be parsing a free-text SMS summary from a transcript, which means Parviz gets unstructured notes and we have no reliable signal for downstream automations (CRM push, scheduling). The `submit_lead` structured object is the contract that lets every future feature hook in cleanly.

### Trade-off being accepted

The model might occasionally get a field wrong because it's relying on in-context memory across a 60-second exchange. Mitigations:

1. Prompt instructs Sofia to **briefly confirm** any ambiguous field before `submit_lead` ("So: Starter plan, morning callback, got it?"). One summary line is cheap.
2. `submit_lead` handler logs the full payload at `info` level. If the lead is wrong, Parviz sees it in `fly logs` within seconds.
3. Fields are all low-cardinality enums except name + number. The enums are the exact strings the prompt tells Sofia to produce, reducing free-text drift.

---

## D. Lead handoff

### SMS format (optimized for 5-second phone glance)

```
📞 Sofia lead · 2026-04-13 14:32
Martin Tremblay · 514-555-0199
Pro · morning · has website
Salon (Laval)
"Wants to replace voicemail for after-hours bookings."
Call in: open
```

Line 1: source + timestamp. Line 2: name + number (tappable on iOS/Android). Line 3: tier + window + website y/n. Line 4: business type + city if caller mentions it. Line 5: Sofia's one-sentence `notes` field quoted verbatim. Line 6: call status (future: "in progress" / "ended").

**Keep emojis.** Parviz explicitly asked for scannability; the phone icon is visually faster than "Sofia lead:".

### Failure handling

Two-phase:

1. **Network / Twilio API error** on SMS post → handler returns `{ ok: false, error: "..." }` to the model. Sofia is prompted to say (paraphrased): *"I've got your info — I'll make sure Parviz gets it."* She does **not** say "the SMS failed" because that leaks implementation. The payload is also written to a local log line at `error` level with `reqId` so Parviz can recover it manually.
2. **Twilio 4xx (invalid number, unsupported region)** → same user-facing message, different log severity + tag so we can alert separately.

The model **never** hears "retry" — Sofia's job is to be calm and hang up clean. Retries are infrastructure's job (future: a small outbox table in SQLite, DECISION deferred).

### Caller-facing confirmation

Caller always hears a positive confirmation ("Parviz will call you between 9 and noon tomorrow — merci!"), regardless of SMS success. Worst case: Parviz recovers the lead from logs and calls back 30 minutes later. Best case: SMS arrives instantly and Parviz calls back while caller is still warm. Either way, never break the caller's experience with a backend hiccup.

---

## E. End-of-call behavior

### Chosen: Sofia asks, then ends

Flow:

1. After `submit_lead` returns `ok: true`, Sofia says the confirmation line.
2. Sofia asks: *"Anything else I can help with before we hang up?"*
3. On negative confirmation ("no", "non", "nope", "c'est tout", "that's all") → Sofia says goodbye (*"Parfait, have a great day — Parviz will call you soon."*), then fires `end_call`.
4. `end_call` handler waits for the audio to flush (~500ms post `response.done`), then issues Twilio REST `POST /Calls/{sid}` with `Status=completed`.
5. On positive confirmation → Sofia handles the one extra question in-conversation, then re-asks the "anything else?" question. Max 2 loops before Sofia politely wraps: *"I want to make sure Parviz can give you a real answer on that — he'll cover it when he calls you back."*

### Why not just leave the line open

- Carrier billing per-second means a caller who forgets to hang up costs us money (small, but real at scale).
- The "anything else?" explicit check prevents the too-eager hang-up failure mode that the user flagged as worse than long silence.
- `end_call` is a tool the model must decide to fire, which means the decision is auditable in the event stream — useful for debugging "why did Sofia hang up on the caller?"

### Max call length

`maxCallSeconds: 360` (6 min). At T-30s, `relay.js` injects a system message to the OpenAI session: *"Caller has been on the line 5 minutes 30 seconds; gracefully wrap and hang up."* Sofia then fires `submit_lead` with whatever she has + `end_call`. This is a safety floor, not a common path. See DECISION #2.

---

## F. Cost and latency budget

### Cost per call (target: ≤ $0.45 at 90s)

| Item                              | Rate                    | 90s cost | Notes                                |
| --------------------------------- | ----------------------- | -------- | ------------------------------------ |
| OpenAI Realtime input audio       | $0.06/min               | $0.09    | Caller's voice                       |
| OpenAI Realtime output audio      | $0.24/min               | $0.36    | Sofia's voice — dominant cost        |
| Twilio inbound voice              | ~$0.014/min             | $0.021   | Toronto region                       |
| Twilio outbound SMS (lead)        | ~$0.0083 per segment    | $0.009   | One segment                          |
| Twilio outbound SMS (link)        | ~$0.0083 per segment    | $0.009   | If caller accepts                    |
| **Total**                         |                         | **~$0.49** |                                    |

Marginally over the $0.45 target. Two levers:

1. **Make Sofia talk less** — prompt instructs concise responses, bilingual turn-efficiency. Every 10s of Sofia speech saved = $0.04.
2. **Cap `max_response_output_tokens` per turn** in session config to ~150, which naturally keeps responses short.

**No architectural choice in this blueprint breaks the budget.** The tool-call-only-once decision in (C) is what keeps the budget — six `set_field` tool calls would add ~1.5s of Sofia "thinking" audio per call = $0.06 tax.

### Latency target: <800ms turn-taking

Realtime API handles STT+LLM+TTS in-session, so p50 should come in at 400–700ms if:

- VAD tuning is correct (current `0.5 / 300 / 500` is fine for English, may need tweaking for French rate-of-speech — flag for item G/I).
- We don't add a roundtrip per turn. The `submit_lead`-at-end architecture explicitly avoids this.
- The Fly.io Toronto region stays close to Twilio's Toronto carrier point-of-presence (already confirmed in the Fly.io blueprint).

If a tool call mid-conversation is unavoidable (`send_sms_link` is the only realistic one), budget ~400ms extra on that turn only. Acceptable.

---

## G. Bilingual quality risks

### Known limitations to flag in v1

1. **Quebec French accent.** OpenAI's French TTS is Metropolitan French (Paris-ish), not Québécois. The caller hears an "educated European-tinged French" voice. Acceptable for v1. Sofia's prompt must **not** claim to be Québécoise; she says *"Je suis Sofia, une assistante virtuelle bilingue"* — AI, period.
2. **Code-switching (Franglais)** common in Laval/Montreal: *"OK donc je veux le Pro chatbot avec le booking."* GPT-4o handles this well in text; Realtime mode with VAD on code-switched audio is less tested. Architect's position: **assume it works for v1, add one manual QA script in Designer's spec that exercises three code-switched utterances, log failures for v2 tuning.**
3. **VAD threshold on French.** French speakers average ~20% faster syllable rate than English. `silence_duration_ms: 500` may chop the end of French sentences. Principal Engineer tunes this during smoke testing — do not commit to a specific number in the blueprint.

### What Sofia must never do

- Claim to be human.
- Claim a specific Québec accent.
- Promise pricing or delivery SLAs (not in her scope — Parviz closes the sale).

---

## H. Future extensibility

Already addressed inline at end of item A. Summary: `backend/agents/sofia-inbound.js` is the template. `salon-sofia.js` swaps prompt, voice, tool list; `agents/index.js` resolves persona by Twilio `To` number or by per-client config (once multi-tenancy exists). `backend/tools/` is shared across personas. `relay.js` stays persona-agnostic.

---

## I. Teaching moment

### Why state-via-tools beats state-in-context for any agent that must produce structured output

When you build a chatbot, state lives in the conversation — the model "remembers" by re-reading prior turns. That works because the output is also text: sloppy state produces sloppy prose, but nobody's automation breaks. Voice agents that hand off to a system (SMS to Parviz, row in SQLite, POST to a CRM) are different: the output is a typed object, and a single missed field silently corrupts downstream automation. The `submit_lead` tool with an enforced JSON schema is the forcing function that converts the model's fuzzy conversational memory into a validated structured payload exactly once, at the moment the model itself declares the qualification complete. This is the same reason you use Pydantic/TypedDict on the Python side of your ML pipelines at Ubicquia — the schema is the contract, and the contract is where reliability lives. Skip it and you'll spend week three debugging why 15% of leads arrive missing `callback_window` and have no idea when the regression started.

---

## J. Items needing Parviz's input → DECISION.md

Two genuinely ambiguous calls. One DECISION.md file at a time per CLAUDE.md — I'm opening **DECISION #2: Voice + disclosure + name-capture bundle** because these three sub-questions are coupled (they all shape the first 10 seconds of the call) and splitting them into three files would waste Parviz's attention. The `maxCallSeconds` question is architect-delegatable — setting to 360s.

See `/home/parviz/sofia/DECISION.md`.

---

## Agent delegation

- **Devil's Advocate** (runs first, before Designer) → Challenge the `submit_lead`-at-end choice. Specifically: is the risk of the model forgetting a field across a 90s conversation greater than the latency cost of `set_field`-per-datum? Want a concrete scenario where the chosen architecture fails.
- **Designer** (after Devil's Advocate, after DECISION #2 resolved) → Write `specs/SPEC_sofia_inbound_agent.md` covering the 600–900 token prompt (structured under the 6 headings in item B), the three tool JSON schemas exactly as in item C, and three manual QA scripts (English-only, French-only, code-switched).
- **Principal Engineer** (after Designer) → Review spec for coherence with this blueprint and with `relay.js` as-is. Sign off before Coder touches anything. Owns VAD-tuning decisions during smoke test.
- **Coder** (after PE sign-off) → Create `backend/agents/`, `backend/tools/`, `backend/prompts/`; refactor `relay.js` to load the persona and dispatch tool calls; wire Twilio REST SMS using `fetch` (no SDK). Feature branch `feat/sofia-inbound-agent`.
- **Critic** (after Coder) → Verify: prompt file exists and is loaded at init (not per-call); tool schemas validated against OpenAI Realtime API spec; SMS failure path logs but doesn't throw; `end_call` flushes audio before hanging up; no hardcoded secrets.
- **Note Taker** → Capture this blueprint under `docs/decisions/` once DECISION #2 resolves; update `README.md` TODO to point at this blueprint.
- **Secretary** → Update `HANDOFF.md` with "Blueprint written, awaiting DECISION #2, then Devil's Advocate".

---

## Open questions for Parviz

All rolled into DECISION #2. One decision, three coupled choices, three sentences of context each.
