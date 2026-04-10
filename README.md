# Sofia AI

Freelance AI secretary for local businesses — voice, booking, SMS, calendar. See **`CLAUDE.md`** for stack, business context, multi-agent protocol, and **how this repo relates to future per-area private repos (submodules)**. Agent definitions are in **`.claude/agents/`**. Last session state: **`HANDOFF.md`**.

**Layout:** this repository stays the place for **agents and decisions**. Website, backend, marketing, LinkedIn, and similar work live in **named top-level folders** for now; later each can move to its **own private repo** and link back here as a **git submodule** without changing where agents run.

---

## What Sofia does

Sofia answers phone calls for local businesses (salons, clinics, restaurants, etc.) 24/7 in French and English. She books appointments, confirms via SMS, captures leads, and logs every call.

---

## Current stack (as of 2026-04-10)

```
Twilio (telephony + SMS + Media Streams)
  → Node.js WebSocket Relay (Fastify + ws)
  → OpenAI Realtime API (STT + GPT-4o brain + TTS — single WebSocket)
  → Google Calendar API (booking via CalendarProvider interface)
  → SQLite (leads, call logs, bookings — WAL mode)
  → Fly.io Toronto (hosting)
```

**Client config:** Markdown + YAML frontmatter per client (in `backend/clients/`)  
**Frontend:** Static HTML/CSS/JS — Netlify  
**Agents:** Claude Code multi-agent system (see `CLAUDE.md`)

---

## Architecture summary

A call arrives at Twilio → Twilio opens a Media Stream (mulaw audio over WebSocket) → Node.js relay transcodes audio (mulaw 8kHz ↔ PCM16 24kHz) and proxies it to the OpenAI Realtime API → OpenAI handles speech recognition, reasoning, and speech synthesis in one WebSocket → tool calls from OpenAI trigger calendar lookups, lead saves, and SMS sends → audio response streams back to the caller in real time.

Multi-tenant routing: Twilio's `To` phone number identifies the client. The relay loads that client's YAML config and injects it into the OpenAI system prompt.

---

## Tool calls Sofia can make

| Tool | What it does |
|------|-------------|
| `check_availability` | Query Google Calendar for open slots |
| `book_appointment` | Create calendar event, write booking to SQLite |
| `capture_lead` | Save caller phone + summary to SQLite leads table |
| `send_sms` | Send SMS via Twilio to caller or business owner |

---

## All decisions resolved (2026-04-10)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Config storage | Markdown + YAML (client configs) + SQLite (leads, logs, bookings) |
| 2 | TTS provider | ElevenLabs — superseded by Decision #5 |
| 3 | Calendar | Google Calendar API, behind CalendarProvider interface |
| 4 | Voice pipeline | OpenAI Realtime API (replaces Whisper + Claude + ElevenLabs) |
| 5 | ElevenLabs status | Dropped — use Realtime API built-in voices |

---

## Cost model (per client per month, ~200 calls, 3 min avg)

| Service | Cost |
|---------|------|
| Twilio telephony | ~$6 |
| OpenAI Realtime API (gpt-4o, STT+brain+TTS) | ~$24 |
| Twilio SMS | ~$2 |
| Google Calendar API | free |
| Fly.io hosting (shared across clients) | ~$5 |
| **Total** | **~$32–37/client/month** |

Charge clients $149–299/month. Target 75%+ margin.

---

## Project status

| Area | Status |
|------|--------|
| Agent system | Done — 8 agents defined in `.claude/agents/` |
| Marketing website | Built — ready to deploy to Netlify |
| System architecture | Done — all 5 decisions resolved |
| Backend spec | Not started — next up |
| Backend code | Not started |
| Twilio integration | Not started |
| Google Calendar integration | Not started |
| SQLite schema | Not started |
| First live test | Not started |

---

## What's next

1. **Designer** produces `specs/SPEC_voice_backend.md` based on blueprint v2
2. Spec must address: WebSocket auth (Twilio sig validation), OpenAI reconnection, SQLite WAL, calendar conflict detection, tool error handling, Fly.io cold start, call duration cap
3. **Principal Engineer** reviews spec
4. **Coder** implements on a feature branch
5. **Critic** reviews code before merge
6. First live voice test with a real Twilio number

---

## Open threads (non-blocking)

- Website needs to be deployed to Netlify
- LinkedIn profile + Sofia AI company page to be created
- FB Marketplace ad to be posted and boosted

---

## Repository layout

```
sofia/
├── CLAUDE.md              ← rules, stack, multi-agent protocol
├── README.md              ← this file (note taker maintains)
├── DECISION.md            ← active decision (none currently)
├── HANDOFF.md             ← current session state (secretary maintains)
├── .env.example           ← all environment variables documented
├── specs/                 ← designer specs (SPEC_[slug].md)
├── docs/
│   ├── notes/             ← session notes (YYYY-MM-DD-slug.md)
│   └── decisions/         ← resolved decisions (archived DECISION.md files)
├── website/               ← marketing / Netlify static site
├── backend/               ← Node server, WebSocket relay, booking, SMS
│   ├── relay/             ← Twilio ↔ OpenAI Realtime WebSocket relay
│   ├── tools/             ← Tool call handlers (calendar, leads, SMS)
│   ├── booking/           ← Google Calendar integration (CalendarProvider)
│   ├── clients/           ← Per-client Markdown+YAML config files
│   └── db/                ← SQLite schema, migrations, queries
├── marketing/             ← ads, marketplace copy, campaigns
├── linkedin/              ← profile / company page drafts
└── .claude/
    └── agents/            ← agent definitions
```
