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
