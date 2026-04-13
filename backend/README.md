# Sofia Voice Backend

Fastify + `ws` relay that bridges Twilio Media Streams to OpenAI's Realtime API. See root `README.md` for the big picture; this file covers only the backend service.

## Run locally

```bash
cd backend
cp ../.env.example ../.env    # fill in real values (see "Secrets" below)
npm install
npm start                     # or: npm run dev  for --watch mode
```

Exposes on `PORT` (default 3000):

- `GET  /health`          — liveness + metrics JSON
- `POST /twiml`           — Twilio Voice webhook (signature-validated)
- `GET  /twilio-media`    — Twilio Media Stream WebSocket (token-authed)

For local Twilio testing, front this with `ngrok http 3000` and point the Twilio Voice webhook at the ngrok URL's `/twiml`.

## Tests

```bash
npm test
```

Uses Node's built-in `node:test` runner — no Jest, no extra deps. Coverage:

- `test/twilio-signature.test.js` — HMAC-SHA1 validator, X-Forwarded-Proto handling, duplicate-key params.
- `test/ws-auth.test.js` — Media Stream token validator, case-insensitive key lookup, timing-safe compare.

## Security

Both endpoints are authenticated. **Do not deploy without both secrets set** — the server refuses to start without them.

- `POST /twiml` is HMAC-SHA1 signature-validated using `TWILIO_AUTH_TOKEN`. URL reconstruction respects `X-Forwarded-Proto` / `X-Forwarded-Host` so it works behind the Fly proxy. Failures return 403 with an empty body and log `{ reqId, route, reason, sourceIp }` — never the signature or token itself.
- The Twilio Media Stream WebSocket is authenticated via a shared secret (`STREAM_AUTH_TOKEN`) delivered by Twilio on the `start` frame as a custom parameter, embedded in the TwiML `<Stream><Parameter>` element. Mismatch closes the WS with code `1008` and an empty reason string before any audio is forwarded to OpenAI.

Full design rationale and acceptance criteria: **[`specs/SPEC_twilio_security.md`](../specs/SPEC_twilio_security.md)**.

Every auth rejection increments the in-memory `auth_rejections_total` counter exposed on `/health`. Counter resets on process restart.

## Deployment (Fly.io)

Blueprint: [`specs/BLUEPRINT_flyio_deployment.md`](../specs/BLUEPRINT_flyio_deployment.md). Always-on posture per [DECISION #1](../docs/decisions/2026-04-13-flyio-autostop.md).

### One-time setup

```bash
cd backend
fly launch --no-deploy --copy-config --name sofia-backend --region yyz
# Accept the generated fly.toml if prompted, or let it use the one in-repo.
```

### Set secrets

Secrets never go in the image. Set all of these before the first deploy (the backend refuses to start without `TWILIO_AUTH_TOKEN` and `STREAM_AUTH_TOKEN`):

```bash
fly secrets set \
  OPENAI_API_KEY=...                       \
  OPENAI_REALTIME_MODEL=gpt-4o-realtime-preview \
  TWILIO_ACCOUNT_SID=...                   \
  TWILIO_AUTH_TOKEN=...                    \
  TWILIO_PHONE_NUMBER=+18737360217         \
  TWILIO_FROM_NUMBER=+18737360217          \
  STREAM_AUTH_TOKEN="$(openssl rand -hex 32)" \
  LEAD_NOTIFICATION_PHONE=+1XXXXXXXXXX     \
  GOOGLE_CLIENT_ID=...                     \
  GOOGLE_CLIENT_SECRET=...                 \
  GOOGLE_REFRESH_TOKEN=...                 \
  GOOGLE_CALENDAR_ID=...                   \
  LOG_LEVEL=info
```

Google secrets can be set with empty strings for now if the calendar integration is not yet wired — the relay in its current state does not read them. `DATABASE_PATH` is not needed yet (no DB writes).

### Deploy

```bash
fly deploy
```

### Verify

1. `curl https://sofia-backend.fly.dev/health` should return:
   ```json
   { "status": "ok", "ws_registered": true, "active_ws_connections": 0,
     "metrics": { "auth_rejections_total": 0 } }
   ```
2. `fly logs` — tail to watch the boot sequence. You should see the `listening on 0.0.0.0:3000` line, and no fatal secret-missing errors.

### Manual step — Twilio console (Parviz only, cannot be automated)

Reconfigure the phone number's Voice webhook in the Twilio Console:

1. Twilio Console → Phone Numbers → Manage → Active Numbers → **+1 (873) 736-0217**.
2. Voice Configuration → **A call comes in**: Webhook, `https://sofia-backend.fly.dev/twiml`, HTTP **POST**.
3. Save.

### End-to-end smoke test

1. Call `+1 (873) 736-0217` from any phone.
2. In a second terminal: `fly logs` — look for `Twilio stream started`, `Connected to OpenAI Realtime API`, and `OpenAI session configured`.
3. You should hear Sofia's bilingual greeting on the line.
4. After a successful test, shut down the ngrok + laptop server — Sofia is live.

### Rollback

```bash
fly releases                 # find last good version, e.g. v42
fly deploy --image-label v42 # or: fly machine restart <id>
```

## Environment variables

See `/.env.example` at the repo root for the full list and per-var documentation. The two non-negotiable ones:

| Variable            | Required at boot | Purpose                                                        |
|---------------------|------------------|----------------------------------------------------------------|
| `TWILIO_AUTH_TOKEN` | yes              | HMAC key for `X-Twilio-Signature` validation on `/twiml`.       |
| `STREAM_AUTH_TOKEN` | yes              | Shared secret for `/twilio-media` WS auth. `openssl rand -hex 32`. |

Missing either one → process exits 1 at boot with a fatal log line.

## Inbound Agent (Sofia)

The relay answers `+1 (873) 736-0217` (the callsofia.ca hero CTA) with the **Sofia inbound qualification agent**. Design + behavior live in:

- Spec: [`specs/SPEC_sofia_inbound_agent.md`](../specs/SPEC_sofia_inbound_agent.md)
- Blueprint: [`specs/BLUEPRINT_sofia_inbound_agent.md`](../specs/BLUEPRINT_sofia_inbound_agent.md)
- Decision (voice/disclosure/name): [`docs/decisions/2026-04-13-sofia-first-10-seconds.md`](../docs/decisions/2026-04-13-sofia-first-10-seconds.md)

Persona module: `backend/agents/sofia-inbound.js` (prompt in `backend/prompts/sofia-inbound.md`, tools in `backend/tools/`). `relay.js` is persona-agnostic — it loads the persona via `resolvePersona()` at connection time.

### Extended env vars

| Variable                    | Required for                                             |
|-----------------------------|----------------------------------------------------------|
| `TWILIO_FROM_NUMBER`        | Outbound SMS FROM (usually same as TWILIO_PHONE_NUMBER). |
| `LEAD_NOTIFICATION_PHONE`   | Where lead SMS notifications land (Parviz's cell).       |
| `TWILIO_ACCOUNT_SID`        | Twilio REST auth for SMS + end-call.                     |
| `OPENAI_API_KEY`            | Used for BOTH Realtime and transcript-fallback (gpt-4o-mini). |

All already listed in `.env.example`.

### `un-instant.mulaw` filler audio

The relay plays `backend/audio/un-instant.mulaw` (~1.0s, 8kHz μ-law raw, no WAV header) if no OpenAI response arrives within 800ms of the caller's turn-end. The file is loaded once at process start. **If the file is empty or missing the filler is silently disabled — calls still work.**

To regenerate the real audio:

```bash
# Option A — OpenAI TTS + ffmpeg (recommended)
curl https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","voice":"shimmer","input":"Un instant.","response_format":"wav"}' \
  --output /tmp/un-instant.wav
ffmpeg -y -i /tmp/un-instant.wav -ar 8000 -ac 1 -f mulaw backend/audio/un-instant.mulaw

# Option B — Mac say + ffmpeg
say -v Amelie "Un instant." -o /tmp/un-instant.aiff
ffmpeg -y -i /tmp/un-instant.aiff -ar 8000 -ac 1 -f mulaw backend/audio/un-instant.mulaw
```

### Manual smoke-test runbook

1. `fly deploy` and verify `/health` returns the full extended metrics block.
2. Call `+1 (873) 736-0217` from a Québec cell.
3. Exercise three scripts:
   - **EN-only:** "Hi, I run a salon in Laval, I want the Pro plan."
   - **FR-only:** "Bonjour, j'ai un café à Montréal, je cherche l'offre Starter."
   - **Code-switched:** "OK donc je veux le Pro chatbot for my clinic."
4. For each script:
   - Sofia opens with the exact bilingual greeting.
   - She follows the 7-point qualification arc (see prompt).
   - She offers to text the callsofia.ca link; say yes on one call, verify SMS arrives within 10s.
   - She soft-asks for name at the end.
   - She says goodbye and the call terminates (Twilio-side hangup) within ~1s.
   - Parviz's phone receives the lead SMS within 10s of the goodbye line.
5. `fly logs` (or equivalent):
   - Look for `event: call_start`, `event: tool_fired` (submit_lead), `event: lead_submitted`, `event: sms_sent`, `event: call_end`.
   - No `error`-level lines expected on happy path.
6. **Transcript-fallback test:** On one call, hang up mid-sentence after Sofia's first question. Verify a `[PARTIAL]` lead SMS arrives within 15s.
7. **Hostile-caller test:** On one call, say "leave me alone". Verify Sofia says goodbye, submits the lead with `notes` indicating caller asked to end, and fires `end_call`.

### Tests

```bash
npm test
```

Covers:

- `test/twilio-signature.test.js`, `test/ws-auth.test.js` — security middleware (pre-existing).
- `test/sofia-inbound-prompt.test.js` — grep assertions on the prompt (guardrails, bilingual, tool names, 7-point arc).
- `test/submit-lead.test.js` — idempotency, SMS-failure path, payload shape.
- `test/send-sms-link.test.js` — EN/FR bodies, idempotency, missing-phone, failure.
- `test/end-call.test.js` — REST POST shape, idempotency, 4xx handling, missing callSid.
- `test/transcript-fallback.test.js` — gpt-4o-mini extraction + raw-SMS fallback + both-failed path.
- `test/relay-transcript.test.js` — both caller (`conversation.item.input_audio_transcription.completed`) and sofia (`response.audio_transcript.delta` + `.done`) turns accumulate on `callState.transcript`.
