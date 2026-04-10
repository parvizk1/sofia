# Sofia AI — Project Rules

## What is this

Sofia AI is a freelance AI secretary service for local businesses in Laval and Montreal. 
Built by Parviz — senior software engineer, 10+ years experience — as a side business.

Sofia answers phone calls, books appointments, sends SMS confirmations, and manages 
Google Calendar. All automatically. 24/7. Bilingual French and English.

## Stack

```
Twilio (telephony + SMS)
  → Whisper (speech-to-text)
  → Claude (AI brain)
  → ElevenLabs (text-to-speech)
  → Google Calendar API (booking)
```

Backend: Node.js  
Frontend: Static HTML/CSS/JS (Netlify)  
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

## File structure

```
sofia/
├── CLAUDE.md              ← this file
├── README.md              ← living project overview (note taker maintains)
├── DECISION.md            ← active decision (archived when resolved)
├── HANDOFF.md             ← current session state (secretary maintains)
├── .env.example           ← all environment variables documented
├── specs/                 ← designer specs (SPEC_[slug].md)
├── docs/
│   ├── notes/             ← session notes (YYYY-MM-DD-slug.md)
│   └── decisions/         ← resolved decisions (archived DECISION.md files)
├── src/                   ← source code
│   ├── server.js          ← entry point
│   ├── webhooks/          ← Twilio webhook handlers
│   ├── voice/             ← Whisper + ElevenLabs pipeline
│   ├── booking/           ← Google Calendar integration
│   └── sms/               ← Twilio SMS confirmations
└── .claude/
    └── agents/            ← agent definitions
```

## Per-client cost target

API costs per client per month should stay under $50 at 200 calls/month, 3 min avg.
- Twilio telephony: ~$6
- Whisper STT: ~$4
- Claude LLM: ~$14
- ElevenLabs TTS: ~$10
- Twilio SMS: ~$2
- **Total: ~$36/client/month**

Charge clients $149–299/month. Target 75%+ margin.

## Business context

Parviz works on Sofia in focused sessions alongside his day job at Ubicquia.
Sessions are typically 1–3 hours. He needs to context-switch in fast.
The secretary agent manages session state so nothing is lost between sessions.
