# Sofia AI — Project Rules

## What is this

Sofia AI is a freelance AI secretary service for local businesses in Laval and Montreal. 
Built by Parviz — senior software engineer, 10+ years experience — as a side business.

Sofia answers phone calls, books appointments, sends SMS confirmations, and manages 
Google Calendar. All automatically. 24/7. Bilingual French and English.

## Stack

```
Twilio (telephony + SMS + Media Streams)
  → Node.js WebSocket Relay (Fastify + ws)
  → OpenAI Realtime API (STT + GPT-4o brain + TTS — single WebSocket)
  → Google Calendar API (booking via CalendarProvider interface)
  → SQLite (leads, call logs, bookings)
  → Fly.io Toronto (hosting)
```

Backend: Node.js (Fastify + ws)  
Frontend: Static HTML/CSS/JS (Netlify)  
Data: SQLite (WAL mode) + Markdown/YAML client configs  
Agents: Claude Code multi-agent system

## Agent hierarchy

```
Architect           ← top of hierarchy, owns DECISION.md, teaches Parviz
├── Designer        ← specs before code, read-only on existing code
├── Principal Eng   ← active oversight during execution, tiebreaker
│   ├── Coder       ← writes code, never decides, feature branches only
│   ├── Critic      ← read-only review, surfaces issues with fixes
│   └── Devil's Adv ← challenges direction before commitment
├── Note Taker      ← captures sessions, decisions, keeps README current
└── Secretary       ← opens/closes sessions, writes HANDOFF.md
```

## Core protocol

**Automate execution. Escalate decisions.**

- Anything that is *doing* → agents handle autonomously
- Anything that is *deciding* → architect writes DECISION.md, Parviz chooses

## DECISION.md format

When the architect needs Parviz's input, it writes DECISION.md at the repo root:

```
DECISION #[N] — [Short title]
Status: Waiting for Parviz

Context: [3 sentences max]

Options:
  1. [Name] — [one sentence] | Tradeoff: [one line]
  2. [Name] — [one sentence] | Tradeoff: [one line]
  3. Let architect decide [only if genuinely delegatable]

Architect recommendation: Option [N]
[One sentence why]

Your call (reply with a number):
```

Parviz replies with a number. System unblocks.

## Execution rules

- **No code without an approved spec.** Coder waits for designer + principal engineer sign-off.
- **No commits to main.** All work on feature branches. Merge after critic review.
- **No hardcoded secrets.** Everything in `.env`. `.env.example` always up to date.
- **Twilio webhook signature validation is always required.** Non-negotiable security rule.
- **Logging is always in scope.** Sofia runs on client businesses. Debug at 11pm requires logs.
- **Devil's advocate runs before commitment.** Not during. Not after.
- **Architect teaches.** Every blueprint includes a teaching moment for Parviz.

## Repository strategy

This repo is the **Sofia control plane**: agents (`.claude/agents/`), `DECISION.md`, `HANDOFF.md`, specs, and coordination live here permanently.

**Product areas** (website, marketing, LinkedIn/social, frontend, backend API, etc.) should eventually each have **its own private Git repository** and be **attached here as git submodules** (for example `website/` → private `sofia-web`, `backend/` → private `sofia-backend`, `marketing/` → `sofia-marketing`, `linkedin/` → `sofia-linkedin`). That keeps access, history, and deploy hooks scoped per surface while this umbrella repo stays where the multi-agent system and decisions live.

**For now:** keep everything **in this monorepo** under the folders below. Do **not** add submodules until each piece has its own remote and a deliberate cutover (architect documents the move in a blueprint first).

## File structure

```
sofia/
├── CLAUDE.md              ← this file (rules + repo strategy)
├── README.md              ← living project overview (note taker maintains)
├── DECISION.md            ← active decision (archived when resolved)
├── HANDOFF.md             ← current session state (secretary maintains)
├── .env.example           ← all environment variables documented
├── specs/                 ← designer specs (SPEC_[slug].md)
├── docs/
│   ├── notes/             ← session notes (YYYY-MM-DD-slug.md)
│   └── decisions/         ← resolved decisions (archived DECISION.md files)
├── website/               ← marketing / Netlify static site (future: submodule)
├── backend/               ← Node server, WebSocket relay, booking, SMS
│   ├── server.js          ← Fastify entry point (when created)
│   ├── relay/             ← WebSocket relay (Twilio ↔ OpenAI Realtime API)
│   ├── tools/             ← Tool call handlers (calendar, leads, SMS)
│   ├── booking/           ← Google Calendar integration (CalendarProvider)
│   ├── clients/           ← Per-client Markdown+YAML config files
│   └── db/                ← SQLite schema, migrations, queries
├── marketing/             ← ads, marketplace copy, campaigns (future: submodule)
├── linkedin/              ← profile / company page drafts (future: submodule)
└── .claude/
    └── agents/            ← agent definitions
```

## Per-client cost target

API costs per client per month should stay under $50 at 200 calls/month, 3 min avg.
- Twilio telephony: ~$6
- OpenAI Realtime API (gpt-4o, STT+brain+TTS): ~$24
- Twilio SMS: ~$2
- Google Calendar API: free tier
- Fly.io hosting (shared across clients): ~$5 total
- **Total: ~$32–37/client/month** (varies with call duration)

Charge clients $149–299/month. Target 75%+ margin.

**Cost note:** Average call duration is the primary cost lever. At 4.5 min avg 
instead of 3 min, costs rise to ~$47/client/month. Optimize conversation flow 
to keep calls efficient.

## Business context

Parviz works on Sofia in focused sessions alongside his day job at Ubicquia.
Sessions are typically 1–3 hours. He needs to context-switch in fast.
The secretary agent manages session state so nothing is lost between sessions.
