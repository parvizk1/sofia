# Spec: Sofia Inbound Qualification Voice Agent

**Date:** 2026-04-13
**Blueprint:** [`specs/BLUEPRINT_sofia_inbound_agent.md`](./BLUEPRINT_sofia_inbound_agent.md)
**Decision:** [`docs/decisions/2026-04-13-sofia-first-10-seconds.md`](../docs/decisions/2026-04-13-sofia-first-10-seconds.md) — voice=shimmer, disclosure=explicit upfront, name=soft ask at end
**Status:** draft

---

## Overview

This spec defines the inbound qualification voice agent that answers `+1 (873) 736-0217` (the callsofia.ca hero CTA). It replaces the 14-line inline `SYSTEM_PROMPT` in `backend/relay.js` with a persona/tool module architecture (`backend/agents/`, `backend/tools/`, `backend/prompts/`, `backend/audio/`) and wires three OpenAI Realtime tools (`submit_lead`, `send_sms_link`, `end_call`), a transcript-fallback extractor, and an 800ms latency filler.

The relay stays persona-agnostic. All intelligence lives in the persona module and tool registry. This is the template for future per-client personas (`salon-sofia`, `dental-sofia`, etc.) — do not hardcode "sofia-inbound" anywhere in `relay.js`.

---

## Section 1 — File structure

### Exact file tree

```
backend/
├── agents/
│   ├── index.js                  ← NEW — registry + resolvePersona(context)
│   └── sofia-inbound.js          ← NEW — PersonaConfig default export
├── prompts/
│   └── sofia-inbound.md          ← NEW — instruction text (markdown, loaded once at init)
├── tools/
│   ├── index.js                  ← NEW — registry: name → { schema, handler }
│   ├── submit-lead.js            ← NEW — submit_lead handler + schema
│   ├── send-sms-link.js          ← NEW — send_sms_link handler + schema
│   └── end-call.js               ← NEW — end_call handler + schema
├── audio/
│   └── un-instant.mulaw          ← NEW — pre-recorded 8kHz μ-law filler (see §5)
├── lib/
│   ├── twilio-sms.js             ← NEW — fetch-based Twilio SMS sender (shared)
│   ├── twilio-calls.js           ← NEW — fetch-based Twilio Calls REST (end-call)
│   └── transcript-fallback.js    ← NEW — GPT-4o-mini extraction (§4)
├── relay.js                      ← MODIFIED — becomes orchestrator
├── server.js                     ← MODIFIED — adds metrics counters to /health
└── test/
    ├── submit-lead.test.js       ← NEW
    ├── send-sms-link.test.js     ← NEW
    ├── end-call.test.js          ← NEW
    ├── transcript-fallback.test.js ← NEW
    └── sofia-inbound-prompt.test.js ← NEW — grep asserts (bilingual, 7 points, guardrails)
```

### What `relay.js` keeps vs. delegates

**Keeps:**
- Twilio WebSocket handshake + `validateStreamAuth()`.
- OpenAI Realtime WebSocket lifecycle (`connectToOpenAI`, ping/pong, reconnect on transient error).
- Twilio `media` → OpenAI `input_audio_buffer.append` forwarding.
- OpenAI `response.audio.delta` → Twilio `media` forwarding.
- Per-call state object (see below).

**Delegates to new modules:**
- System prompt → loaded from persona module at init.
- Session config (voice, VAD, tools, model) → read from persona module.
- Tool call dispatch (`response.function_call_arguments.done`) → `tools/index.js` registry.
- Call-end lead fallback → `lib/transcript-fallback.js`.
- Latency filler logic → self-contained timer in `relay.js` but audio bytes loaded once at init from `backend/audio/un-instant.mulaw`.

### Per-call state object (lives in `relay.js` closure per connection)

```js
const callState = {
  reqId,
  streamSid: null,
  callSid: null,              // from Twilio start.callSid — required for end_call
  callerPhone: null,          // E.164 from Twilio start.customParameters or from[]
  startedAtMs: Date.now(),
  persona: null,              // PersonaConfig reference
  leadSubmitted: false,       // idempotency flag for submit_lead (§3)
  linkSent: false,            // set true on send_sms_link success
  transcript: [],             // [{ role: 'caller'|'sofia', text, tMs }]
  language: 'unknown',        // 'fr' | 'en' | 'unknown' — best-effort from tool calls
  fillerTimer: null,          // setTimeout handle, see §5
  fillerPlaying: false,       // true while filler audio is streaming
  openaiResponseInFlight: false,
  endCallRequested: false,
  wrapWarningSent: false,     // true once T-30s wrap message injected
};
```

### Persona resolution (future-ready, hardcoded default now)

`agents/index.js` exports `resolvePersona(context)`:

```js
// context: { toNumber, streamSid, reqId }
// Returns: PersonaConfig (default export of a persona module)
export function resolvePersona(context) {
  // v1: hardcoded. Future: lookup by toNumber → client config.
  return sofiaInbound;
}
```

`agents/sofia-inbound.js` default export:

```js
{
  key: 'sofia-inbound',
  model: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview',
  voice: 'shimmer',
  instructions,                 // string, read once at module load from prompts/sofia-inbound.md
  tools: [submitLeadTool, sendSmsLinkTool, endCallTool],  // full OpenAI schema objects
  toolHandlers: { submit_lead, send_sms_link, end_call }, // name → async fn
  audioFormats: { input: 'g711_ulaw', output: 'g711_ulaw' },
  vad: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600 },
  maxCallSeconds: 360,
  maxResponseOutputTokens: 180,
  temperature: 0.7,
  metadata: { phoneNumber: '+18737360217', businessId: null },
}
```

Prompt is loaded at module-init time with `readFileSync(path.join(__dirname, '../prompts/sofia-inbound.md'), 'utf8')`. **Not** re-read per call.

---

## Section 2 — The prompt (`backend/prompts/sofia-inbound.md`)

### Bilingual strategy

**One bilingual mega-prompt, English-authoritative with French guidance inline.** Justification: architect locked this; DA challenged and Parviz held. Designer's implementation call is to write the prompt primarily in English (the model's instruction-following is stronger in English for meta-rules like tool-use protocols), with French example strings quoted verbatim in the relevant sections so Sofia has canonical Québec-compatible phrases.

### Full prompt text — write this file verbatim

```markdown
# Sofia — Inbound Qualification Agent (callsofia.ca)

## 1. Identity

You are Sofia, a warm, professional, bilingual (French/English) AI receptionist for Sofia AI, a service that provides AI phone assistants to local businesses in Laval and Montreal. You are answering an inbound call to the main Sofia AI sales line. The caller is a prospect who pressed the "Call Sofia" button on callsofia.ca. You are NOT human. You are NOT Québécoise. You are an AI assistant, and you disclose this openly in your first breath.

Your goal is to qualify the caller in 60 to 90 seconds and hand a structured lead to Parviz (the founder) via the `submit_lead` tool. You do not close sales. You do not quote prices. You do not promise SLAs or delivery dates. Parviz does all of that on the callback.

## 2. Bilingual protocol

Open every call with this exact bilingual greeting, in this order, without adding anything:

> "Hi, I'm Sofia, an AI assistant for Sofia AI — bonjour, je suis Sofia, une assistante virtuelle. How can I help you today? Comment puis-je vous aider aujourd'hui?"

After the caller's first reply, detect their language from what they said, and from that turn forward respond **only in that language** — French if they spoke French, English if they spoke English. If their first turn was code-switched ("OK donc je veux le Pro chatbot"), default to French. If you cannot tell, ask once: "Préférez-vous continuer en français ou en anglais? / Would you prefer French or English?"

If the caller switches language mid-call, switch with them immediately. Never refuse to switch. Never comment on the switch.

You speak European French (your TTS is Parisian). Do NOT claim to be Québécoise. Do NOT imitate a Québec accent. If a caller comments on your accent, say (in French): "Je suis une assistante virtuelle, mon accent n'est pas local — mais je comprends bien le français d'ici."

## 3. Qualification arc — the seven points

You must gather these seven data points before firing `submit_lead`. Ask in this order unless the caller volunteers information out of order; then skip ahead. Be conversational, not interrogative. Group related questions into single turns ("Do you have a website, and what kind of business are you in?") where natural.

1. **Service interest** — Starter, Pro, Complete, or not sure yet.
   - Starter = $100/mo chatbot only.
   - Pro = $200/mo chatbot + voice.
   - Complete = chatbot + voice + full booking integration (price TBD by Parviz).
   - If the caller doesn't know, ask: "What's the one thing you'd most want Sofia to handle for you?" and map their answer.
2. **Has website** — yes/no/unknown. If yes, optionally note the URL in `notes` if they say it.
3. **Business type** — free text (salon, clinic, dealership, café, etc.) plus city if mentioned.
4. **Callback window** — morning, afternoon, evening, or flexible. Map "anytime" / "whenever" → flexible.
5. **Offer the SMS link** — "Would you like me to text you the callsofia.ca link so you can look at the site while Parviz calls you back?" If yes, fire `send_sms_link`. If no, continue.
6. **Open questions for Parviz** — "Is there anything specific you want Parviz to address when he calls?" Capture verbatim in `notes`.
7. **Name (soft ask, at the very end)** — after the above six are gathered, before firing `submit_lead`, ask exactly this:
   > "Avant qu'on raccroche, à qui ai-je parlé? / Before we hang up, who am I speaking with?"
   If the caller hesitates or says "I'd rather not", accept gracefully: "No problem — Parviz will just ask when he calls back." Leave `caller_name` null.

After each qualification datum that could be ambiguous (service tier, callback window, business type), briefly echo back to confirm: "So that's the Pro plan, morning callback, a salon in Laval — did I get that right?" One confirmation line at the end is enough; do NOT echo after every single answer.

## 4. Tool-use protocol

You have exactly three tools:

- **`submit_lead`** — Fire this EXACTLY ONCE per call, after the seven qualification points are gathered (or after the caller has clearly indicated they're done, even if some points are missing — fill nulls where needed). Never fire it twice. Never fire it before you've attempted the soft name ask.
- **`send_sms_link`** — Fire this ONLY when the caller says yes to the SMS offer in step 5. Pass no arguments (server has the caller's number from Twilio). On success, confirm verbally: "Parfait, je viens de vous envoyer le lien. / Perfect, I just sent you the link." On failure, say: "The text didn't go through, but no worries — Parviz will send it when he calls." Continue the flow.
- **`end_call`** — Fire this AFTER you've said goodbye AND after `submit_lead` has returned. Never fire it before submitting the lead. Never fire it mid-conversation.

The correct end-of-call sequence is: say goodbye → fire `submit_lead` → wait for it to return → fire `end_call`. All three happen in the last ~5 seconds of the call.

## 5. Guardrails

- **If asked something you don't know about Sofia's services, pricing, SLAs, integrations, or timelines:** Say "That's a great question — let me have Parviz answer that directly when he calls back." Then add the question verbatim to `notes` when you eventually fire `submit_lead`. Do NOT invent answers. Do NOT speculate.
- **Never claim to be human.** If asked "are you a real person?", say "No, I'm an AI assistant — Parviz built me to answer the first call and get you on his calendar."
- **Never quote specific prices beyond the Starter ($100) and Pro ($200) tiers.** Complete tier is "Parviz will quote that based on your needs."
- **Never promise SLAs, delivery dates, or callback times more specific than the window** (morning/afternoon/evening/flexible).
- **Never claim to be Québécoise or to have a local accent.**
- **If the caller becomes hostile or asks you to stop, stop.** Say: "Understood — I'll let Parviz know. Have a good day." Fire `submit_lead` with whatever you have + `notes: "Caller asked to end the call."` Then fire `end_call`.
- **If the caller is clearly not a prospect (wrong number, telemarketer, robot):** Say goodbye politely and fire `end_call` without submitting a lead.

## 6. Voice & tone

- Warm, professional, concise. A bilingual receptionist on a good day.
- Short turns. One or two sentences per response. This is a phone call, not an email.
- No emoji. No "As an AI..." hedges. No filler ("umm", "like"). No excessive apologizing.
- Smile through the voice (the model emulates this from prompt instructions — keep your tone bright).
- If the caller interrupts you, stop talking immediately and listen.
- Match the caller's energy: brisk if they're brisk, patient if they're unsure.

## 7. Wrap-up

After `submit_lead` returns successfully, say one bilingual-aware confirmation line:

- French: "Parfait, Parviz va vous rappeler [window] — merci d'avoir appelé Sofia!"
- English: "Perfect, Parviz will call you back [window] — thanks for calling Sofia!"

Then fire `end_call`. Do not add anything else after that line.

If the call has been going more than 5 minutes 30 seconds and you receive a system notice that says "CALL_WRAP_WARNING", politely wrap within two turns: submit whatever you have, say goodbye, fire `end_call`.
```

**Token target:** 700–900 tokens. The Coder MUST verify with `tiktoken` or equivalent and trim Section 3 if over 1000.

**Acceptance — the Coder's prompt test must grep for:**
- `I'm Sofia, an AI assistant` (upfront disclosure, EN)
- `je suis Sofia, une assistante virtuelle` (upfront disclosure, FR)
- `Starter`, `Pro`, `Complete` (tiers)
- `morning`, `afternoon`, `evening`, `flexible` (windows)
- `Avant qu'on raccroche` (soft name ask)
- `let me have Parviz answer that` (no-invent guardrail)
- `submit_lead`, `send_sms_link`, `end_call` (tool names)

---

## Section 3 — Tool schemas

All three tools follow OpenAI Realtime's function-tool shape: `{ type: 'function', name, description, parameters: { type: 'object', properties, required } }`.

### 3.1 `submit_lead`

**OpenAI schema** (exact object exported from `backend/tools/submit-lead.js` as `submitLeadTool`):

```js
{
  type: 'function',
  name: 'submit_lead',
  description: 'Submit the qualified lead to Parviz via SMS. Call EXACTLY ONCE per call, at the end after gathering the seven qualification points (soft name ask included). Never call twice. The server auto-populates caller_phone from Twilio caller ID — do not pass it.',
  parameters: {
    type: 'object',
    properties: {
      caller_name: {
        type: ['string', 'null'],
        description: 'Caller first name from the soft end-of-call ask. Null if caller declined or did not provide.',
      },
      language: {
        type: 'string',
        enum: ['fr', 'en', 'unknown'],
        description: 'Detected language of the conversation.',
      },
      service_interest: {
        type: 'string',
        enum: ['starter', 'pro', 'complete', 'not_sure'],
        description: 'Which service tier the caller expressed interest in.',
      },
      has_website: {
        type: ['boolean', 'null'],
        description: 'True if caller has an existing website, false if not, null if unknown or not asked.',
      },
      callback_window: {
        type: 'string',
        enum: ['morning', 'afternoon', 'evening', 'flexible'],
        description: 'Preferred callback window. Map "anytime"/"whenever" to flexible.',
      },
      business_type: {
        type: 'string',
        description: 'Free text: salon, clinic, dealership, café, etc. Include city if mentioned. Max 200 chars.',
      },
      notes: {
        type: 'string',
        description: 'One or two short sentences summarizing anything notable the caller said, including questions they want Parviz to answer. Max 400 chars.',
      },
    },
    required: ['language', 'service_interest', 'callback_window', 'business_type', 'notes'],
  },
}
```

**Server-side handler signature** (`backend/tools/submit-lead.js`):

```js
/**
 * @param {object} args - validated function call arguments from the model
 * @param {object} callState - per-call state (see §1)
 * @param {object} deps - { log, env, smsClient }
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function submit_lead(args, callState, deps) { ... }
```

**Behavior:**
1. **Idempotency:** If `callState.leadSubmitted === true`, log at `info` level `{ reqId, event: 'submit_lead_duplicate_discarded' }`, return `{ ok: true }` to the model immediately **without** sending a second SMS. The model treats this as a successful no-op.
2. Otherwise: build the full lead payload (including server-derived `caller_phone` from `callState.callerPhone`, `link_sent` from `callState.linkSent`, `partial: false`).
3. Format SMS body using the template in §6 and send via `deps.smsClient.send(...)`.
4. On SMS success: set `callState.leadSubmitted = true`, increment `leads_submitted_total` counter, return `{ ok: true }`.
5. On SMS failure: set `callState.leadSubmitted = true` anyway (we got the payload; don't retry-storm), log at `error` level with the full payload (no tokens) and `reqId`, return `{ ok: true, warning: 'sms_failed_logged' }` to the model (we never tell the caller the SMS failed — the model has a guardrail for this).

**Full lead payload written to log + sent to SMS formatter:**

```ts
{
  caller_phone: string,              // E.164, auto from callState.callerPhone
  caller_name: string | null,        // from args
  language: 'fr' | 'en' | 'unknown', // from args
  service_interest: 'starter' | 'pro' | 'complete' | 'not_sure', // from args
  has_website: boolean | null,       // from args
  callback_window: 'morning' | 'afternoon' | 'evening' | 'flexible', // from args
  business_type: string,             // from args, truncated to 200
  link_sent: boolean,                // from callState.linkSent (server truth)
  notes: string,                     // from args, truncated to 400
  partial: false,                    // direct-submit path always false
  timestamp_iso: string,             // server ISO timestamp
  call_duration_sec: number,         // server-computed
  req_id: string,                    // for log correlation
}
```

### 3.2 `send_sms_link`

**OpenAI schema** (`sendSmsLinkTool`):

```js
{
  type: 'function',
  name: 'send_sms_link',
  description: 'Text the caller the callsofia.ca link. Call only when the caller says yes to the SMS offer. The server uses the Twilio caller ID — no arguments needed.',
  parameters: { type: 'object', properties: {}, required: [] },
}
```

**Handler** (`backend/tools/send-sms-link.js`):

```js
export async function send_sms_link(args, callState, deps) { ... }
```

**Behavior:**
1. If `callState.callerPhone` is missing (shouldn't happen, but defensively), return `{ ok: false, error: 'no_caller_phone' }`.
2. If already sent (`callState.linkSent === true`), return `{ ok: true, note: 'already_sent' }` idempotently.
3. Send SMS with body:
   - FR: `"Voici le lien : https://callsofia.ca — Parviz vous rappelle bientôt. -Sofia"`
   - EN: `"Here's the link: https://callsofia.ca — Parviz will call you back soon. -Sofia"`
   - Selection by `callState.language`; default to EN if `unknown`.
4. On success: `callState.linkSent = true`, return `{ ok: true }`.
5. On failure: log at `error`, return `{ ok: false, error: 'sms_failed' }` — model's guardrail tells caller gracefully.

### 3.3 `end_call`

**OpenAI schema** (`endCallTool`):

```js
{
  type: 'function',
  name: 'end_call',
  description: 'End the phone call gracefully. Call only AFTER saying goodbye AND after submit_lead has returned. Never call mid-conversation.',
  parameters: { type: 'object', properties: {}, required: [] },
}
```

**Handler** (`backend/tools/end-call.js`):

```js
export async function end_call(args, callState, deps) { ... }
```

**Behavior:**
1. Mark `callState.endCallRequested = true` (so the response listener knows to hang up after audio flush).
2. Wait for the final audio response to flush — implementation: register a one-shot listener for OpenAI `response.done`; then `setTimeout(500)`; then POST Twilio REST `POST /2010-04-01/Accounts/{AccountSid}/Calls/{CallSid}.json` with form body `Status=completed`.
3. On success: log at `info`, close Twilio and OpenAI sockets cleanly.
4. On failure (Twilio 4xx/5xx): log at `error`, close the local WebSockets anyway (Twilio will time out the call on its side within ~30s).
5. Return `{ ok: true }` to the model (fire-and-forget from the model's view).

**Duplicate invocation:** If `callState.endCallRequested === true`, return `{ ok: true }` immediately, no-op.

### 3.4 Tool dispatch in `relay.js`

Add one case to `handleOpenAIEvent`:

```js
case 'response.function_call_arguments.done': {
  const { name, call_id, arguments: argsJson } = event;
  const handler = callState.persona.toolHandlers[name];
  if (!handler) {
    log.error({ reqId: callState.reqId, toolName: name }, 'Unknown tool call');
    sendFunctionCallOutput(openaiWs, call_id, { ok: false, error: 'unknown_tool' });
    break;
  }
  let args;
  try { args = JSON.parse(argsJson); }
  catch (e) {
    log.error({ reqId: callState.reqId, toolName: name, e }, 'Tool args JSON parse failed');
    sendFunctionCallOutput(openaiWs, call_id, { ok: false, error: 'invalid_args' });
    break;
  }
  const result = await handler(args, callState, { log, env: process.env, smsClient, callsClient });
  sendFunctionCallOutput(openaiWs, call_id, result);
  // Nudge the model to continue speaking:
  openaiWs.send(JSON.stringify({ type: 'response.create' }));
  break;
}
```

`sendFunctionCallOutput` helper:

```js
function sendFunctionCallOutput(ws, callId, output) {
  ws.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: callId,
      output: JSON.stringify(output),
    },
  }));
}
```

---

## Section 4 — Transcript-fallback path (DA fix #1)

**Module:** `backend/lib/transcript-fallback.js`.

**Trigger:** In `relay.js`, on Twilio `stop` event OR on `twilioWs.on('close')`, if `callState.leadSubmitted === false` AND `callState.transcript.length > 0`, fire the fallback path asynchronously (do not block socket teardown).

**Implementation:**

```js
export async function extractLeadFromTranscript(transcript, callState, deps) {
  const { log, env, smsClient } = deps;
  const prompt = buildExtractionPrompt(transcript);
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`openai_${resp.status}`);
    const json = await resp.json();
    const extracted = JSON.parse(json.choices[0].message.content);
    const payload = { ...extracted, partial: true, caller_phone: callState.callerPhone,
                      link_sent: callState.linkSent, timestamp_iso: new Date().toISOString(),
                      req_id: callState.reqId };
    log.info({ reqId: callState.reqId, event: 'transcript_fallback_success' }, 'Partial lead extracted');
    await smsClient.sendLeadSms(payload, { partial: true });
  } catch (err) {
    log.error({ err, reqId: callState.reqId, event: 'transcript_fallback_failed' }, 'Extraction failed');
    // Raw transcript SMS to Parviz — never silently drop
    const rawBody = buildRawTranscriptSms(transcript, callState);
    try {
      await smsClient.sendRaw(env.LEAD_NOTIFICATION_PHONE, rawBody);
    } catch (smsErr) {
      log.error({ err: smsErr, reqId: callState.reqId }, 'Raw transcript SMS also failed');
    }
  }
}
```

**Extraction system prompt** (`EXTRACTION_SYSTEM`, lives as const in the file):

```
You are a lead-extraction parser. You will receive the transcript of a phone call between Sofia (an AI receptionist) and a prospect. Your job is to extract a structured lead summary as strict JSON. Follow this schema exactly and output JSON only, no prose:

{
  "caller_name": string | null,
  "language": "fr" | "en" | "unknown",
  "service_interest": "starter" | "pro" | "complete" | "not_sure",
  "has_website": boolean | null,
  "callback_window": "morning" | "afternoon" | "evening" | "flexible",
  "business_type": string,
  "notes": string
}

Rules:
- If a field wasn't covered in the transcript, use null (for nullable fields) or the closest default: service_interest="not_sure", callback_window="flexible", business_type="unknown", notes="Call ended before full qualification.".
- language: detect from transcript; "unknown" if too short to tell.
- notes: 1-2 short sentences summarizing what the caller wanted. Include any questions they asked. Max 400 chars.
- Output valid JSON only. No markdown fences, no commentary.
```

**User prompt builder:**

```js
function buildExtractionPrompt(transcript) {
  const lines = transcript.map(t => `${t.role === 'sofia' ? 'Sofia' : 'Caller'}: ${t.text}`).join('\n');
  return `Transcript:\n\n${lines}\n\nExtract the lead as JSON per the schema.`;
}
```

**Raw transcript SMS fallback body:**

```js
function buildRawTranscriptSms(transcript, callState) {
  const last = callState.callerPhone ? callState.callerPhone.slice(-4) : '????';
  const lines = transcript.map(t => `${t.role === 'sofia' ? 'S' : 'C'}: ${t.text}`).join('\n').slice(0, 1200);
  return `[PARTIAL-RAW] Sofia call ${new Date().toISOString()} caller ...${last}\nExtraction failed — raw transcript:\n${lines}`;
}
```

**Cost ceiling:** gpt-4o-mini is ~$0.15/1M input + $0.60/1M output. A 90-second transcript is ~400 input tokens + ~200 output tokens → ~$0.0002/call. Well under the $0.005 ceiling.

**Metrics:** increment `transcript_fallbacks_total` counter (success + failure summed). Add `transcript_fallback_failures_total` separately.

---

## Section 5 — Latency filler audio (DA fix #3)

**File path:** `backend/audio/un-instant.mulaw`.

**Format spec:**
- μ-law 8 kHz mono, single channel, raw (no WAV header — Twilio Media Stream payloads are base64-encoded raw μ-law).
- Duration: **~1.0 to 1.2 seconds** (single syllable + trailing silence; roughly 8000–9600 bytes).
- Content: the word "un instant" (French, works bilingually — English ears hear a neutral filler).
- Normalized to -3 dBFS peak to sit evenly with OpenAI's output.

**How to source:** Coder generates once at build/setup time (committed to repo, not generated per-call). Recommended pipeline:

1. **Option A (preferred) — OpenAI TTS one-shot:**
   ```bash
   curl https://api.openai.com/v1/audio/speech \
     -H "Authorization: Bearer $OPENAI_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"tts-1","voice":"shimmer","input":"Un instant.","response_format":"wav"}' \
     --output un-instant.wav
   ffmpeg -i un-instant.wav -ar 8000 -ac 1 -f mulaw un-instant.mulaw
   ```
2. **Option B — Mac `say`:** `say -v Amelie "Un instant." -o un-instant.aiff && ffmpeg -i un-instant.aiff -ar 8000 -ac 1 -f mulaw un-instant.mulaw`

The `.mulaw` file is loaded **once at process start** via `readFileSync` into a Buffer, then pre-chunked into 20ms frames (160 bytes each at 8kHz μ-law) and pre-base64-encoded once into an array of strings for efficient replay.

**Trigger logic** (in `relay.js`):

1. On OpenAI event `input_audio_buffer.speech_stopped` (caller just finished speaking), set `callState.fillerTimer = setTimeout(playFiller, 800)` and `callState.openaiResponseInFlight = false`.
2. On OpenAI event `response.audio.delta` (first response chunk arrives), `clearTimeout(callState.fillerTimer)`; if `callState.fillerPlaying`, stop the filler playback immediately (break the frame loop) and optionally send Twilio a `mark` + `clear` sequence so the buffer is flushed.
3. `playFiller()` streams the pre-chunked μ-law frames to Twilio as `event: media, streamSid, media: { payload: base64Frame }` one frame every 20ms using `setInterval`. Sets `callState.fillerPlaying = true` at start, clears at end.
4. If OpenAI audio arrives mid-filler: immediately clear the filler interval, send Twilio `{ event: 'clear', streamSid }` to flush the Twilio-side buffer, then forward the OpenAI audio normally. This may produce a ~40ms audio cut — acceptable.

**Failure mode:** if the audio file is missing at boot, log `warn { msg: 'filler_audio_missing' }` and set a flag that disables the filler entirely (call proceeds without it). Never crash the process over missing filler.

**Metrics:** `filler_plays_total` counter.

---

## Section 6 — Twilio SMS sender

**Module:** `backend/lib/twilio-sms.js`.

**Direct REST call via `fetch`** (no `twilio` SDK — matches the Netlify function pattern and the security PR). Exports an object with `send`, `sendLeadSms`, `sendRaw` methods.

### Env vars consumed

| Variable                   | Type   | Example                      | Source         |
|----------------------------|--------|------------------------------|----------------|
| `TWILIO_ACCOUNT_SID`       | string | `ACxxxxxxxx...`              | Twilio Console |
| `TWILIO_AUTH_TOKEN`        | string | 32-hex                       | Twilio Console |
| `TWILIO_FROM_NUMBER`       | E.164  | `+18737360217`               | Twilio number  |
| `LEAD_NOTIFICATION_PHONE`  | E.164  | `+1XXXXXXXXXX`               | Parviz's cell  |

All four already listed in `backend/README.md` deploy block — no new secrets.

### API

```js
export function createSmsClient({ env, log }) {
  return {
    async send({ to, body }) { ... },           // low-level; returns { ok, sid?, error? }
    async sendLeadSms(payload, opts) { ... },   // formats body via buildLeadSmsBody, sends to LEAD_NOTIFICATION_PHONE
    async sendRaw(to, body) { ... },            // untyped passthrough for transcript fallback
  };
}
```

### Implementation skeleton

```js
const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
const form = new URLSearchParams({ From: env.TWILIO_FROM_NUMBER, To: to, Body: body });
const resp = await fetch(url, {
  method: 'POST',
  headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: form.toString(),
});
if (!resp.ok) {
  const text = await resp.text();
  log.error({ status: resp.status, body: text.slice(0, 200) }, 'Twilio SMS failed');
  return { ok: false, error: `twilio_${resp.status}` };
}
const json = await resp.json();
return { ok: true, sid: json.sid };
```

**Never throw.** Always return `{ ok, ... }`. Never log the auth header, token, or account SID full value. Mask account SID to first 4 + `...`.

### SMS body format — `buildLeadSmsBody(payload, { partial })`

Scannable in 5 seconds on phone. Exact template (NUL-separated lines for readability below, actual newlines `\n` in the string):

```
📞 Sofia lead · {YYYY-MM-DD HH:mm}{PARTIAL_SUFFIX}
{caller_name or "(no name)"} · {caller_phone}
{service_interest} · {callback_window}{website_suffix}
{business_type}
"{notes}"
{link_suffix}
```

Where:
- `{PARTIAL_SUFFIX}` = ` [PARTIAL]` if `partial === true`, else empty.
- `{website_suffix}` = ` · has website` if `has_website === true`, ` · no website` if `false`, empty if `null`.
- `{link_suffix}` = `link sent ✓` if `link_sent`, `link not sent` otherwise.
- `{caller_phone}` in the SMS body is the FULL E.164 (tappable on iOS/Android). **In server logs, only the last 4 digits are logged** — see §8.

Example output (90-char target, well under 160 for single-segment):

```
📞 Sofia lead · 2026-04-13 14:32
Martin · +15145550199
pro · morning · has website
salon (Laval)
"Wants to replace voicemail for after-hours bookings."
link sent ✓
```

Partial example:

```
📞 Sofia lead · 2026-04-13 14:32 [PARTIAL]
(no name) · +15145550199
not_sure · flexible
unknown
"Call ended before full qualification."
link not sent
```

### Failure path

- Log at `error` with `{ reqId, event: 'sms_failed', status, body_preview }`, never the token or the auth header.
- Never throw. Never tell the caller. Return `{ ok: false, ... }` so the handler can mark `leadSubmitted = true` anyway.

---

## Section 7 — Realtime API session config

**Built from persona in `configureSession(ws, persona)`** — replaces current inline config in `relay.js`:

```js
ws.send(JSON.stringify({
  type: 'session.update',
  session: {
    modalities: ['text', 'audio'],
    instructions: persona.instructions,
    voice: persona.voice,                          // 'shimmer'
    input_audio_format: persona.audioFormats.input,   // 'g711_ulaw'
    output_audio_format: persona.audioFormats.output, // 'g711_ulaw'
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: persona.vad,
    tools: persona.tools,                          // full OpenAI schema array
    tool_choice: 'auto',
    temperature: persona.temperature,              // 0.7
    max_response_output_tokens: persona.maxResponseOutputTokens, // 180
  },
}));
```

### VAD threshold recommendation for bilingual code-switching

```js
{ type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600 }
```

Designer's call: bump `silence_duration_ms` from the current 500 to **600** because French syllable rate is ~20% faster, and callers mid-thought in French often pause briefly at clause boundaries; 500 chops them. 600 is the safer default; PE tunes during smoke test.

### Token ceiling

`max_response_output_tokens: 180` per turn. Keeps Sofia concise and caps cost. The model can string multiple turns together; this cap is per-response not per-call.

### Temperature

`0.7` — warm but not chaotic. Lower (e.g., 0.5) makes Sofia sound robotic; higher (0.9+) risks off-script answers that break guardrails.

---

## Section 8 — Logging & observability

### `info` level

- `{ event: 'call_start', reqId, streamSid, callSid, callerPhoneLast4 }`
- `{ event: 'language_detected', reqId, language }` (first time language locks in)
- `{ event: 'tool_fired', reqId, toolName }` (for each tool call)
- `{ event: 'lead_submitted', reqId, service_interest, callback_window, partial }`
- `{ event: 'sms_sent', reqId, sid, toLast4 }`
- `{ event: 'filler_played', reqId }`
- `{ event: 'call_end', reqId, durationSec, leadSubmitted, linkSent }`

### `error` level

- `{ event: 'sms_failed', reqId, status, bodyPreview }`
- `{ event: 'openai_error', reqId, error }`
- `{ event: 'transcript_fallback_failed', reqId, err }`
- `{ event: 'tool_handler_error', reqId, toolName, err }`
- `{ event: 'twilio_end_call_failed', reqId, status }`

### Never log

- `OPENAI_API_KEY`, `TWILIO_AUTH_TOKEN`, `STREAM_AUTH_TOKEN`, the full Twilio auth header — under any circumstance.
- Full caller phone numbers. Log `callerPhoneLast4` only (`callState.callerPhone.slice(-4)`).
- Full transcripts at `info` level. Full transcripts only when `LOG_LEVEL === 'debug'`, gated by `if (log.level === 'debug')` checks before assembling the string.

### `/health` metrics additions

Modify `server.js` to extend the in-memory `counters` object and emit it from `/health`:

```js
const counters = {
  authRejectionsTotal: 0,          // existing
  inboundCallsTotal: 0,            // NEW — increment on Twilio start event
  leadsSubmittedTotal: 0,          // NEW — increment on submit_lead ok
  leadsPartialTotal: 0,            // NEW — increment on transcript-fallback success
  smsFailuresTotal: 0,             // NEW
  transcriptFallbackFailuresTotal: 0, // NEW
  fillerPlaysTotal: 0,             // NEW
};
```

`/health` response adds a `metrics` block:

```json
{
  "status": "ok",
  "ws_registered": true,
  "active_ws_connections": 0,
  "metrics": {
    "auth_rejections_total": 0,
    "inbound_calls_total": 0,
    "leads_submitted_total": 0,
    "leads_partial_total": 0,
    "sms_failures_total": 0,
    "transcript_fallback_failures_total": 0,
    "filler_plays_total": 0
  }
}
```

Counters reset on process restart (documented; acceptable for v1, matches existing `auth_rejections_total` pattern).

---

## Section 9 — Tests the Coder must include

All under `backend/test/`, using Node's built-in `node:test` runner (no Jest).

### 9.1 `submit-lead.test.js`

- **success path:** given a valid args + callState with `leadSubmitted=false`, mocks `smsClient.sendLeadSms` to return `{ ok: true }`, asserts handler returns `{ ok: true }`, asserts `callState.leadSubmitted === true`.
- **idempotency:** given `callState.leadSubmitted === true`, asserts handler returns `{ ok: true }` WITHOUT calling `smsClient.sendLeadSms` (use a spy — assert call count is 0).
- **sms failure:** mock `smsClient.sendLeadSms` to return `{ ok: false, error: 'twilio_500' }`, assert handler returns `{ ok: true, warning: 'sms_failed_logged' }` AND `callState.leadSubmitted === true` AND error was logged.
- **payload shape:** assert the payload passed to `smsClient.sendLeadSms` includes `partial: false`, `caller_phone` from callState, `link_sent` from callState, `timestamp_iso`, `req_id`.

### 9.2 `send-sms-link.test.js`

- success path (EN and FR body selection by `callState.language`).
- idempotency (`callState.linkSent === true` returns `{ ok: true, note: 'already_sent' }` without sending).
- missing caller phone returns `{ ok: false, error: 'no_caller_phone' }`.
- SMS failure returns `{ ok: false, error: 'sms_failed' }`.

### 9.3 `end-call.test.js`

- success: mocks Twilio Calls client, asserts POST to correct URL with `Status=completed`, asserts sockets closed.
- idempotency: second call no-ops.
- Twilio 4xx: logs error, closes sockets anyway.

### 9.4 `transcript-fallback.test.js`

- **extraction success:** mock `fetch` to return a valid JSON response, assert the request used `gpt-4o-mini`, `response_format: json_object`, and included the exact `EXTRACTION_SYSTEM` string in the system message. Assert the final SMS payload has `partial: true`.
- **extraction failure → raw fallback:** mock `fetch` to return 500, assert raw transcript SMS is sent to `LEAD_NOTIFICATION_PHONE` with `[PARTIAL-RAW]` prefix.
- **raw fallback also fails:** mock both to fail, assert two error logs, no throw.

### 9.5 `sofia-inbound-prompt.test.js`

Greps the loaded prompt text for required phrases (see §2 acceptance list). One `assert.match(prompt, /I'm Sofia, an AI assistant/)` line per required phrase. Fails the build if the prompt drifts.

### 9.6 Integration — OUT OF SCOPE

Full integration tests against real Twilio + OpenAI are NOT part of this PR. Instead, the Coder adds a **manual smoke-test runbook** to `backend/README.md` with:
- Call the live number from a Québec cell.
- Exercise one English-only conversation, one French-only, one code-switched.
- Verify SMS arrives within 10 seconds of Sofia saying the goodbye line.
- Verify `fly logs` shows expected `info` events, no `error` events.
- Manual hang-up mid-call to verify transcript-fallback SMS arrives.

---

## Section 10 — Files affected

### New files

| Path                                           | Purpose                                                         |
|------------------------------------------------|-----------------------------------------------------------------|
| `backend/agents/index.js`                      | `resolvePersona(context)` registry; v1 returns sofia-inbound.   |
| `backend/agents/sofia-inbound.js`              | PersonaConfig default export; loads prompt once at init.        |
| `backend/prompts/sofia-inbound.md`             | The 700-900 token instruction text (markdown).                  |
| `backend/tools/index.js`                       | Tool registry; exports array of schemas + handler map.          |
| `backend/tools/submit-lead.js`                 | `submit_lead` schema + handler (idempotent).                    |
| `backend/tools/send-sms-link.js`               | `send_sms_link` schema + handler.                               |
| `backend/tools/end-call.js`                    | `end_call` schema + handler.                                    |
| `backend/lib/twilio-sms.js`                    | fetch-based Twilio SMS client (`send`, `sendLeadSms`, `sendRaw`). |
| `backend/lib/twilio-calls.js`                  | fetch-based Twilio Calls REST (completes the call).             |
| `backend/lib/transcript-fallback.js`           | gpt-4o-mini extraction + raw transcript SMS fallback.           |
| `backend/audio/un-instant.mulaw`               | Pre-recorded 8kHz μ-law filler, ~1.0s.                          |
| `backend/test/submit-lead.test.js`             | Unit tests for submit_lead handler.                             |
| `backend/test/send-sms-link.test.js`           | Unit tests for send_sms_link handler.                           |
| `backend/test/end-call.test.js`                | Unit tests for end_call handler.                                |
| `backend/test/transcript-fallback.test.js`     | Unit tests for extraction + raw fallback.                       |
| `backend/test/sofia-inbound-prompt.test.js`    | Grep tests on loaded prompt.                                    |

### Modified files

| Path                     | What changes                                                                                     |
|--------------------------|--------------------------------------------------------------------------------------------------|
| `backend/relay.js`       | Remove inline `SYSTEM_PROMPT`. Load persona via `resolvePersona()`. Add tool dispatch case. Add transcript-fallback trigger on call end. Add filler timer + playback. Track full `callState` object. Build transcript array from `conversation.item.input_audio_transcription.completed` + `response.audio_transcript.done`. Capture `callSid` and caller E.164 from Twilio `start` event (`customParameters` + `start.from`). |
| `backend/server.js`      | Extend `counters` object with new metrics; expose them on `/health`. Pass counters into `handleTwilioConnection`.                                             |
| `backend/README.md`      | Remove the "TODO — Sofia inbound qualification script" section (it's built). Add manual smoke-test runbook. Document new env var requirements (none — all already listed). Document how to regenerate `un-instant.mulaw`.                                         |
| `.env.example`           | No new vars (all Twilio/OpenAI vars already present). Add a comment documenting `OPENAI_API_KEY` is now used for BOTH Realtime and transcript-fallback (gpt-4o-mini).                                                                                               |

### Out of scope (explicitly not built)

- **Per-client multi-persona registry.** `agents/index.js` returns sofia-inbound unconditionally in v1. Multi-tenant routing by Twilio `To` number is future work.
- **Retry/outbox for failed SMS.** One attempt, log and move on. No SQLite outbox table.
- **Lead storage in SQLite.** Only SMS + logs in v1. DB persistence is future.
- **Google Calendar integration.** Not yet wired.
- **Full integration tests** against real Twilio + OpenAI.
- **A/B testing infrastructure** for prompts.
- **Metrics to Prometheus / external telemetry.** `/health` in-memory counters only.
- **Call recording / transcript archive.** Transcripts live in memory for the duration of one call, then discarded.

---

## Acceptance criteria (binary — all must be true)

- [ ] A new call to `+1 (873) 736-0217` is answered with the exact bilingual greeting from §2, Section 2 ("Hi, I'm Sofia, an AI assistant..."), spoken by OpenAI Realtime voice `shimmer`.
- [ ] `backend/prompts/sofia-inbound.md` exists and is loaded exactly once at module init (not per-call).
- [ ] Prompt test (`sofia-inbound-prompt.test.js`) passes all greps listed in §2 acceptance.
- [ ] The three tools (`submit_lead`, `send_sms_link`, `end_call`) are registered in `session.update` with schemas exactly as in §3.
- [ ] `submit_lead` called twice in the same call results in one SMS to `LEAD_NOTIFICATION_PHONE` (second call is discarded, logged as duplicate).
- [ ] On Twilio `stop` without prior `submit_lead`, `transcript-fallback.js` runs, uses `gpt-4o-mini`, and produces an SMS with `[PARTIAL]` prefix. If extraction fails, raw transcript SMS with `[PARTIAL-RAW]` prefix is sent instead.
- [ ] If no OpenAI response token arrives within 800ms of caller speech-end, `backend/audio/un-instant.mulaw` plays to the caller. If a response token arrives during filler playback, filler is interrupted and response audio plays.
- [ ] SMS body format matches §6 exactly, including tappable E.164 on line 2.
- [ ] No secrets (tokens, auth headers) appear in any log line. Full caller phone numbers never appear in logs at `info` level — only last 4 digits.
- [ ] `/health` returns the extended metrics block from §8.
- [ ] All unit tests in §9 pass via `npm test`.
- [ ] `relay.js` contains no hardcoded prompt text, no hardcoded voice name, no hardcoded tool schemas. All come from the persona.
- [ ] No new npm dependencies added. Twilio REST via `fetch`. OpenAI calls via `fetch` (transcript-fallback) or existing `ws` (Realtime).
- [ ] Call gracefully terminates via `end_call` → Twilio REST `Status=completed` within 1 second of Sofia's goodbye line finishing.

---

## Accepted risks (do not re-litigate — document for future-Parviz)

1. **Parisian French TTS accent.** OpenAI Realtime `shimmer` speaks Metropolitan French, not Québécois. Some callers may find it "not local". Parviz's call to ship and evaluate post-launch. If conversion suffers, the mitigation path is: (a) switch to a Québec-trained TTS vendor (non-trivial — breaks single-WebSocket architecture), or (b) pre-record a handful of Sofia's most-used French phrases in a Québec voice and splice them in (complex, deferred).
2. **Upfront AI disclosure may suppress engagement.** Option 1 of DECISION #2. Some prospects hang up on hearing "AI assistant" in the greeting. Parviz's call to maximize transparency. Mitigation if conversion suffers: soften to "virtual assistant" (Option 2) and disclose AI only if asked. Track hang-up-in-first-10-seconds rate to evaluate.
3. **Name-at-end may yield leads with no name on early hang-ups.** Option 3 of DECISION #2. If a caller drops off before the final soft ask, `caller_name` is null. Parviz's call — caller ID still provides the callback number. Mitigation if a meaningful % of leads arrive nameless: move the ask to after the first qualification point (service interest), not at the very end.
4. **VAD threshold on bilingual code-switching.** PE will tune during smoke test. Designer set `silence_duration_ms: 600` as safer default than the current 500. Extreme code-switchers may still get chopped — monitor and adjust.
5. **No SMS retry / outbox.** A transient Twilio 5xx during `submit_lead` loses the lead to logs only. Acceptable at v1 volume (low single-digit calls/day). Re-evaluate at 20+ calls/day.

---

## Open questions for Architect (DECISION items Designer could not resolve)

**None.** All ambiguity in the brief was resolvable by translating the blueprint + DECISION #2 outcome. Flagging two items for Architect's awareness only (not blocking Coder):

1. **Transcript capture source.** Designer assumes transcripts are built from OpenAI events `conversation.item.input_audio_transcription.completed` (caller side) and `response.audio_transcript.done` (Sofia side). This is a reasonable default — if Architect prefers a different source (e.g., Whisper pass over the raw audio post-hoc for higher fidelity), flag before Coder starts.
2. **`end_call` audio flush heuristic.** Designer chose "wait for `response.done` then `setTimeout(500)` then hit Twilio API". If Architect wants a more precise flush-detection (e.g., drain Twilio buffer by mark/ack protocol), flag before Coder starts. The 500ms heuristic is what most reference implementations use.
