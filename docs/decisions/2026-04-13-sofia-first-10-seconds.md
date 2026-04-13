# DECISION #2 — Sofia's first-10-seconds bundle (voice, disclosure, name capture)

**Status:** Waiting for Parviz
**Date:** 2026-04-13
**Blueprint:** [`specs/BLUEPRINT_sofia_inbound_agent.md`](specs/BLUEPRINT_sofia_inbound_agent.md)

## Context

These three sub-questions all shape the first 10 seconds of every call and are tightly coupled (voice + disclosure line + whether Sofia asks for a name up front all happen in the same breath). Splitting them into three DECISION files would waste your attention. I've bundled them; pick one option per sub-question.

---

## Sub-question A — Voice

OpenAI Realtime voices: `alloy` (current), `echo`, `fable`, `onyx`, `nova`, `shimmer`. Only one is easily changed per persona.

**Option 1 — shimmer** (warm, bright, female-leaning)
Tradeoff: Best "professional receptionist" vibe; slight risk of sounding generic to French ears.

**Option 2 — nova** (measured, female, slightly deeper)
Tradeoff: More authoritative; a touch less warm, might read as corporate.

**Option 3 — stay on alloy** (current default, androgynous, neutral)
Tradeoff: Safe and already working; reads slightly flat on bilingual output.

**Architect recommendation: Option 1 (shimmer)** — Sofia is branded as a warm bilingual receptionist; alloy is functional but not on-brand. Spend 30 seconds listening to all three on the OpenAI playground before deciding.

---

## Sub-question B — Upfront disclosure

Quebec/Canada don't legally require an AI disclosure on inbound calls (as of 2026-04). Some US states do.

**Option 1 — Explicit disclosure in greeting** ("Je suis Sofia, une assistante virtuelle — I'm Sofia, an AI assistant.")
Tradeoff: Transparent, zero legal risk; some callers hang up immediately on hearing "AI".

**Option 2 — Soft disclosure only if asked** (Sofia says "virtual assistant" in greeting; only admits AI if caller asks "am I talking to a robot?")
Tradeoff: Higher engagement rate; slightly riskier if a caller feels deceived.

**Option 3 — No disclosure, full-on persona** (Sofia acts human unless directly pressed)
Tradeoff: Best conversion; crosses an ethical line you'll regret later.

**Architect recommendation: Option 1 (explicit)** — This is your hero CTA; the callers are already primed ("Call Sofia" is on the hero button). They *know* they're calling an AI. Disclose plainly and use the transparency as a feature.

---

## Sub-question C — Name capture

**Option 1 — Ask for name explicitly** ("Avant qu'on commence, puis-je avoir votre prénom?")
Tradeoff: Cleaner lead record; adds ~5 seconds to every call (= ~$0.02 output-audio cost).

**Option 2 — Rely on Twilio caller ID, never ask** (pass the E.164 number to Parviz; skip the name field entirely)
Tradeoff: Shorter, more efficient calls; Parviz has to ask the name when he calls back.

**Option 3 — Soft ask at the end only** (Sofia asks for name as the very last question, after qualification is done, framed as "so Parviz knows who to ask for")
Tradeoff: Gets the name without front-loading friction; small risk caller drops off before the ask.

**Architect recommendation: Option 3 (soft ask at end)** — Front-loading a name ask is the #1 way to lose casual callers in the first 15 seconds. Caller ID gives us the callback number anyway. Asking for the name at the end, as the last thing before `submit_lead`, is the best cost/signal trade.

---

Your call (reply with three numbers, one per sub-question — e.g. "1, 1, 3"):
