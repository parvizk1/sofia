# HANDOFF — 2026-04-10

## Session summary

Full system architecture session. Started with 12 blocking questions from the Architect, ended with a completely resolved stack and 5 decisions locked. The pivotal shift: replaced the planned Whisper → Claude → ElevenLabs sequential pipeline with the **OpenAI Realtime API** — a single WebSocket that handles STT, LLM reasoning, and TTS together at sub-200ms latency.

Agents that ran this session: Secretary, Architect, Devil's Advocate (×2), Critic, Note Taker.

## Current state

**Branch:** main  
**Repo strategy:** Monorepo for now (`website/`, `backend/`, `marketing/`, `linkedin/` at top level); each area may later become its own private repo submodule'd here — see `CLAUDE.md` → Repository strategy.  
**Specs in progress:** None — architecture is approved, spec work is next  
**Code written:** None  
**DECISION.md:** No active decision (all 5 resolved)

## Resolved stack

```
Twilio (telephony + SMS + Media Streams)
  → Node.js WebSocket Relay (Fastify + ws)
  → OpenAI Realtime API (STT + GPT-4o brain + TTS — single WebSocket)
  → Google Calendar API (booking via CalendarProvider interface)
  → SQLite (leads, call logs, bookings — WAL mode)
  → Fly.io Toronto (hosting)
```

## All 5 decisions — resolved

| # | Topic | Decision |
|---|-------|----------|
| 1 | Config storage | Markdown + YAML (client configs) + SQLite (leads, logs, bookings) |
| 2 | TTS provider | ElevenLabs — superseded by Decision #5 |
| 3 | Calendar | Google Calendar API, behind CalendarProvider interface |
| 4 | Voice pipeline | OpenAI Realtime API (replaces Whisper + Claude + ElevenLabs) |
| 5 | ElevenLabs status | Dropped — use Realtime API built-in voices |

## Files updated this session

- `CLAUDE.md` — new stack documented, cost model updated, old stack references removed
- `.env.example` — removed ANTHROPIC_API_KEY and ELEVENLABS_API_KEY, relabeled OPENAI_API_KEY
- `docs/notes/2026-04-10-system-design-kickoff.md` — full session captured
- `README.md` — updated to reflect new stack and project status
- `HANDOFF.md` — this file

## Next session — pick up here

**Invoke the Designer agent.** Ask it to produce `specs/SPEC_voice_backend.md` based on blueprint v2 (OpenAI Realtime API architecture).

The spec must address these open issues surfaced by the Critic:
1. WebSocket auth — Twilio webhook signature validation
2. OpenAI WebSocket reconnection strategy (connection drops mid-call)
3. SQLite WAL mode — must be explicit in schema DDL
4. Google Calendar conflict detection (double-booking guard)
5. Tool call error handling — Sofia must not go silent if a tool fails
6. Fly.io cold start mitigation (keep-alive or warm instance strategy)
7. Call duration cap to prevent runaway cost

Once the Designer produces the spec, the **Principal Engineer** reviews before any code is written.

## Open threads (carry forward, non-blocking)

- Website needs to be deployed to Netlify (drag and drop `website/index.html`)
- LinkedIn profile + Sofia AI company page need to be created
- FB Marketplace ad needs to be posted and boosted

## Key context for next session

- Audio transcoding is real work: Twilio sends mulaw 8kHz; OpenAI Realtime API expects PCM16 24kHz. The relay must transcode in both directions.
- Start with full `gpt-4o` model — do not use `gpt-4o-mini` until behavior is proven and cost is a measured problem.
- Multi-tenant routing: Twilio `To` phone number → load client YAML config → inject into system prompt.
- Tool calls: `check_availability`, `book_appointment`, `capture_lead`, `send_sms`.
