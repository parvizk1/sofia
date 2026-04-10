# System Design Kickoff — Full Session
**Date:** 2026-04-10
**Participants:** Parviz, Secretary, Architect, Devil's Advocate, Critic
**Status:** decided

---

## Overview

Complete system design session for the Sofia voice backend. Started with 12 blocking questions, ended with a fully resolved architecture and 5 major decisions locked. The session fundamentally changed the planned stack — the biggest shift was replacing the original Whisper → Claude → ElevenLabs sequential pipeline with the OpenAI Realtime API as a single WebSocket, eliminating three separate services and dropping latency from ~2–3s to sub-200ms.

---

## Phase 1: Session open

- Secretary opened the session and produced a brief
- Last session recap: agent system designed, marketing website built, marketing copy drafted
- Recommended focus: system design via Architect

---

## Phase 2: Architect clarifying questions

Before producing any blueprint, the Architect reviewed CLAUDE.md, HANDOFF.md, and README.md, then surfaced 12 blocking questions across 7 topics.

### Teaching moment: The Latency Budget Problem in voice AI

A voice AI pipeline has 4 hops:
1. Caller speaks → audio captured and sent to STT (Whisper)
2. Transcript → LLM (Claude) generates a reply
3. Reply text → TTS (ElevenLabs) synthesizes audio
4. Audio → streamed back to caller over Twilio

In a **sequential** architecture each hop waits for the previous one to finish. Total round-trip is roughly 2–3 seconds. Callers notice.

In a **streaming** architecture each hop starts as soon as the first bytes arrive — TTS speaks the first sentence while the LLM is still generating the second. Perceived latency can drop below 1 second. Tradeoff: streaming requires careful buffer management, error recovery across concurrent streams, and is significantly harder to debug.

For an MVP, sequential is faster to ship and still acceptable. Streaming is the right long-term target once the pipeline is proven.

### The 12 questions

**A. Call Flow**
1. What should Sofia's greeting script sound like?
2. What can a caller actually do — book, ask a question, leave a message?
3. How should a call end — goodbye/hang up, or transfer to a human?

**B. Multi-Tenant**
4. How many clients at launch?
5. What is the per-client config set?
6. Where does that config live?

**C. Booking Logic**
7. Is Google Calendar the single source of truth, or is there a separate booking system?
8. What is slot granularity and buffer time?

**D. Bilingual**
9. What is the language detection strategy?

**E. Latency** (flagged as the biggest architectural decision)
10. Sequential vs. streaming pipeline?

**F. Error Handling**
11. When a service fails mid-call — transfer, callback, or take a message?

**G. First Client**
12. What specific business type is the first real client?

---

## Phase 3: Parviz's answers

- **A1:** Sofia introduces herself by name, mentions services, asks how she can help
- **A2:** MVP scope — book an appointment, ask about hours, leave a message
- **A3:** Sofia asks about follow-up preference; captures phone + summary as a LEAD
- **B4:** 3 pilot clients, approximately 10 callers/day
- **B5:** Full config set from each client (name, number, services, hours, language, calendar ID)
- **B6:** Something LLM-friendly and easy to edit — Markdown + YAML preferred
- **C7:** Open to anything for calendar
- **C8:** Adjustable per client
- **D9:** Bilingual greeting (announce both languages up front)
- **E10:** Sequential for MVP (simpler to build and debug)
- **F11:** Take a message + SMS the business owner
- **G12:** Open to all business types

---

## Phase 4: Architect blueprint v1

Initial architecture based on Parviz's answers:

- **Custom sequential pipeline:** Twilio → Whisper (STT) → Claude (LLM) → ElevenLabs (TTS)
- **Multi-tenant routing** via Twilio phone number → client lookup
- **Lead capture** on every call (SQLite)
- **Client config:** Markdown + YAML frontmatter files
- **Hosting:** Fly.io Toronto

---

## Phase 5: DECISION #1 resolved — Config storage

**Decision:** Option 3 — Markdown + YAML frontmatter for client config, SQLite for leads and logs.

Rationale: LLM-readable, human-editable, no database overhead for config. SQLite handles structured data (leads, bookings, call logs) with WAL mode for concurrent writes.

---

## Phase 6: Devil's Advocate stress test v1

Reviewed all 10 initial decisions. Key findings:

- **RECONSIDER:** CalDAV via tsdav — library has known bugs and poor maintenance. Switch to Google Calendar API directly.
- **RECONSIDER:** ElevenLabs — 5x more expensive than alternatives, untested at scale with Twilio latency.
- **PROCEED WITH CAUTION:** Sequential latency — 2–3s may feel slow to callers; revisit quickly after first pilot call.

Filed DECISION #2 (TTS provider), DECISION #3 (Calendar), DECISION #4 (Voice pipeline).

---

## Phase 7: Decisions resolved

### DECISION #2: TTS provider
**Resolved:** Option 1 — ElevenLabs. Voice quality is the product differentiator. Accepted the cost premium for MVP.

### DECISION #3: Calendar integration
**Resolved:** Option 3 — Google Calendar API directly, behind a `CalendarProvider` interface so alternative backends can be swapped in later.

### DECISION #4: Voice pipeline — THE BIG DECISION
**Resolved:** Option 2 — OpenAI Realtime API.

This was the session's pivotal moment. The OpenAI Realtime API is a single persistent WebSocket that handles STT, LLM, and TTS in one connection with native audio streaming. Benefits:
- Sub-200ms latency (vs 2–3s sequential)
- Native Twilio Media Streams / SIP integration
- Eliminates Whisper, Claude, and ElevenLabs as separate services
- One API key, one connection, one billing line
- Tool calling built in

This decision made DECISION #2 (ElevenLabs vs other TTS) moot — OpenAI Realtime API has built-in voices. Filed DECISION #5 (ElevenLabs status).

---

## Phase 8: Architect blueprint v2 (revised architecture)

Completely new architecture built around OpenAI Realtime API:

```
Twilio (telephony + SMS + Media Streams)
  → Node.js WebSocket Relay (Fastify + ws)
  → OpenAI Realtime API (STT + GPT-4o brain + TTS — single WebSocket)
  → Google Calendar API (booking via CalendarProvider interface)
  → SQLite (leads, call logs, bookings — WAL mode)
  → Fly.io Toronto (hosting)
```

**Tool calls defined:**
- `check_availability` — query Google Calendar for open slots
- `book_appointment` — create calendar event, write to SQLite
- `capture_lead` — save caller phone + summary to SQLite
- `send_sms` — send SMS via Twilio to caller or business owner

**Audio transcoding required:** Twilio sends mulaw 8kHz; OpenAI Realtime API expects PCM16 24kHz. The relay must transcode in both directions.

**Multi-tenant routing:** Twilio `To` phone number → load client YAML config → inject into system prompt.

---

## Phase 9: Devil's Advocate + Critic review v2 (parallel)

### Devil's Advocate
PROCEED WITH CAUTION on all 7 areas — no STOP or RECONSIDER flags.

Key callouts:
- Audio transcoding is real work — do not skip or stub. mulaw↔pcm16 must be correct before any voice test.
- Start with full `gpt-4o` model, not `gpt-4o-mini`. Optimize cost later after behavior is proven.
- WebSocket reconnection strategy needed for OpenAI connection drops.

### Critic
NEEDS WORK — 4 critical issues identified:

**Critical (blocking):**
- C1: DECISION #5 unresolved (ElevenLabs status) — blocking
- C2: WebSocket auth gap — no Twilio webhook signature validation documented
- C3: No OpenAI WebSocket reconnection strategy documented
- C4: `.env.example` and `CLAUDE.md` reference old stack (Anthropic key, ElevenLabs key)

**Major (non-blocking but important):**
- M1: SQLite WAL mode must be explicitly enabled in schema
- M2: Google Calendar race condition on double-booking — need conflict detection
- M3: Tool call silence — if a tool errors, OpenAI continues speaking; need error handling
- M4: Bilingual system prompt needs testing — GPT-4o language detection not guaranteed
- M5: Fly.io cold start will cause first call of the day to drop
- M6: No call duration cap — runaway calls will spike costs

---

## Phase 10: DECISION #5 resolved + cleanup

### DECISION #5: ElevenLabs status
**Resolved:** Option 1 — Drop ElevenLabs entirely. Use OpenAI Realtime API's built-in voices.

Rationale: ElevenLabs is now fully redundant. Built-in voices are good enough for MVP. Eliminates one API key, one cost line, and one potential failure point.

### Cleanup completed
- `CLAUDE.md` updated: new stack documented, cost model updated (OpenAI Realtime ~$24/client/month), ElevenLabs removed
- `.env.example` updated: removed `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY`, relabeled `OPENAI_API_KEY`

---

## Final resolved stack

```
Twilio (telephony + SMS + Media Streams)
  → Node.js WebSocket Relay (Fastify + ws)
  → OpenAI Realtime API (STT + GPT-4o brain + TTS — single WebSocket)
  → Google Calendar API (booking via CalendarProvider interface)
  → SQLite (leads, call logs, bookings — WAL mode)
  → Fly.io Toronto (hosting)
```

---

## All 5 decisions — resolved

| # | Topic | Decision |
|---|-------|----------|
| 1 | Config storage | Markdown + YAML frontmatter (client configs) + SQLite (leads, logs, bookings) |
| 2 | TTS provider | ElevenLabs — later superseded by Decision #5 |
| 3 | Calendar integration | Google Calendar API directly, behind CalendarProvider interface |
| 4 | Voice pipeline | OpenAI Realtime API (replaces Whisper + Claude + ElevenLabs) |
| 5 | ElevenLabs status | Dropped — use Realtime API built-in voices |

---

## Open issues carried forward (from Critic)

These were surfaced but not resolved this session — they become spec requirements:

- WebSocket auth: Twilio webhook signature validation must be implemented
- OpenAI WebSocket reconnection strategy must be documented in spec
- SQLite WAL mode must be explicit in schema DDL
- Google Calendar conflict detection (double-booking guard)
- Tool call error handling — Sofia must handle silently-failing tool calls gracefully
- Fly.io cold start mitigation (keep-alive ping or warm instance)
- Call duration cap to prevent runaway cost

---

## Next steps

- [ ] Designer produces SPEC_voice_backend.md based on blueprint v2
- [ ] Spec must address all 7 open issues from Critic
- [ ] Principal Engineer reviews spec before any code is written
- [ ] Coder implements on a feature branch
- [ ] Critic reviews code before merge
- [ ] First voice test with real Twilio number
