# Blueprint: Sofia Voice Backend → Fly.io Deployment

**Status:** Pending (blocked on 1 DECISION.md item + 1 hard prerequisite)
**Author:** Architect
**Date:** 2026-04-13
**Initiative:** Move `backend/` from `ngrok + node server.js` on laptop to production Fly.io, because the Twilio number `+1 (873) 736-0217` is now public on callsofia.ca.

---

## What we are building

A production deployment of Sofia's voice backend on Fly.io. The backend is a Fastify + `ws` relay that bridges Twilio Media Streams to OpenAI's Realtime API. Today it runs on Parviz's laptop behind ngrok; after this blueprint it runs on a Fly Machine in Toronto with a stable HTTPS/WSS URL that Twilio webhooks point to permanently.

## Why this matters

The phone number is live on the homepage as the primary CTA. A laptop going to sleep or an ngrok session dropping now means callers hit silence — that is a credibility-destroying event before the first paying client. Fly deployment is the minimum bar for "Sofia is a real business."

## System impact

- **Twilio console**: Voice webhook URL must be reconfigured post-deploy (manual, Parviz).
- **`backend/server.js`**: **Does NOT implement Twilio signature validation today.** CLAUDE.md declares this non-negotiable. This is a hard prerequisite — ship this fix before or in the same deploy.
- **Secrets**: `.env` moves from laptop disk to `fly secrets`. Nothing else reads from the secret store yet, so the surface is contained.
- **Cold path**: Homepage CTA → phone call → Fly Machine → OpenAI. If the machine is stopped or unreachable, the caller hears dead air. Health posture is load-bearing.

Nothing in the frontend or Netlify pipeline is affected.

---

## Technical approach

### 1. Region — Fly.io `yyz` (Toronto)

Confirmed correct. Rationale:
- Twilio's Canadian POP is Toronto (`us1-tnx` routes through Toronto/Virginia; Twilio Media Streams egress from the nearest region). `yyz` puts us on the same metro.
- OpenAI Realtime API has no Canadian endpoint; it terminates in US regions (primarily `us-east-1`). Toronto → Virginia is ~15ms RTT. Moving to a US region to chase OpenAI would save ~10ms on the OpenAI hop but add ~20–40ms on the Twilio hop for Canadian callers, which is the user-facing leg.
- Target market is Laval/Montreal. Toronto is the closest Fly PoP to Quebec.
- Verdict: `yyz` is the right choice. Do not second-guess this.

### 2. Container approach — Dockerfile spec (coder writes it)

- **Base image**: `node:20-alpine` (Node 20 LTS — current package.json has no engines field; standardize on 20). Alpine for size; the backend has no native deps that hate musl (`ws`, `fastify`, `dotenv` are pure JS).
- **Multi-stage**: Overkill for this app. There's no build step (pure ESM, no TypeScript, no bundler). A single-stage image is ~80MB and simpler to reason about. Skip multi-stage.
- **Layer order**: `COPY package*.json` → `npm ci --omit=dev` → `COPY . .` → `CMD ["node", "server.js"]`. Dependency install layer cached separately from source.
- **User**: Run as non-root (`USER node`). Alpine's `node` image already has the user; just `USER node` before `CMD`.
- **Port**: Expose `3000` (matches `server.js` default). Fly maps 80/443 externally to the internal port.
- **Healthcheck — the tricky part**:
  - HTTP `/health` already exists and returns `{status: 'ok'}`. Fly's built-in TCP/HTTP healthcheck can hit that. But this only proves Fastify is up, not that the WebSocket upgrade path works.
  - **Recommendation**: Extend `/health` to also return the count of active WS connections and a boolean `ws_registered` flag (i.e., the Fastify websocket plugin registered successfully at boot). The coder spec should add this — it's a 5-line change. Fly healthcheck still hits `/health`; a 200 is sufficient for liveness.
  - Do **not** try to healthcheck the OpenAI Realtime connection from `/health` — it only opens per-call. An unreachable OpenAI would flap the healthcheck and kill the machine during a real outage when we actually want to stay up and log.
  - Fly config: `[[services.http_checks]]` with `/health`, interval 15s, grace 10s.

### 3. `fly.toml` shape (coder writes it)

- **App name**: `sofia-voice` (or similar — Parviz picks at `fly launch`).
- **Primary region**: `yyz`.
- **One service, two endpoints, same port**: Fastify with `@fastify/websocket` handles both HTTP (`/twiml`, `/health`) and WS (`/twilio-media`) on port 3000. Fly's HTTP service with `handlers = ["tls", "http"]` passes WebSocket upgrades through transparently — no separate service block needed. This is the common source of confusion: you don't need a `[[services]]` per protocol, you need one service that forwards raw HTTP/1.1 with upgrade support.
- **Force HTTPS**: `force_https = true` on the HTTP service. Twilio requires WSS anyway, and `server.js` already derives `wss://` from the non-localhost host header.
- **Concurrency**: `type = "connections"`, `hard_limit = 50`, `soft_limit = 25`. Voice calls are long-lived WS connections; concurrency per machine is the right scaling signal.
- **Auto-stop**: **See DECISION.md #1.** This is the single call Parviz must make.
- **VM size**: `shared-cpu-1x`, 512MB RAM. The relay is I/O-bound, not CPU-bound. 256MB is risky with Node's V8 baseline; 512MB is the safe floor.
- **Release command**: None — no migrations yet.

### 4. Secrets management

Every env var goes through `fly secrets set KEY=value` — never baked into the image, never committed. Full list to set:

```
OPENAI_API_KEY
OPENAI_REALTIME_MODEL        # optional, defaults to gpt-4o-realtime-preview in code
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
TWILIO_FROM_NUMBER
TWILIO_WEBHOOK_SECRET        # used for signature validation once implemented
LEAD_NOTIFICATION_PHONE
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REFRESH_TOKEN
GOOGLE_CALENDAR_ID
NODE_ENV=production
LOG_LEVEL=info
```

`PORT` is set automatically by Fly — do not override.

`DATABASE_PATH` is deferred: SQLite will need a Fly Volume when the booking layer lands. Not in scope for this deploy; the current code does no DB writes. Note it for the next blueprint.

Operational command (no values echoed):
```
fly secrets set OPENAI_API_KEY=... TWILIO_ACCOUNT_SID=... [rest]
```

Parviz runs this from his laptop against the Fly app — the secrets never touch git.

### 5. Twilio webhook reconfiguration — manual runbook

**Coder cannot automate this.** Parviz does it in the Twilio console after `fly deploy` succeeds:

1. Log in to Twilio Console → Phone Numbers → Manage → Active Numbers → `+1 (873) 736-0217`.
2. Under **Voice Configuration**:
   - **A call comes in**: Webhook, `https://<app>.fly.dev/twiml`, HTTP POST.
   - **Primary handler fails**: leave blank for now (add later if we add a secondary).
3. Save.
4. **No separate WebSocket config needed** — the TwiML response from `/twiml` contains the `<Stream url="wss://<app>.fly.dev/twilio-media" />`, which Twilio dials automatically. The WS URL is derived from `req.headers.host` in `server.js`, so it picks up the Fly hostname with zero code changes.
5. Test call from a cell phone. Verify logs in `fly logs` show `Twilio stream started` and `OpenAI session created`.
6. Only after a successful end-to-end test: remove ngrok, shut down the laptop server.

SMS (if/when the Netlify lead function starts sending): those webhooks are outbound from Twilio's side, not inbound to our server, so no change here.

### 6. Cost estimate

Fly.io pricing as of 2026 (shared-cpu-1x, 512MB, `yyz`):

- **Always-on (1 machine)**: ~$3.89/mo compute + ~$0.50 bandwidth at zero traffic = **~$4–5/mo idle**.
- **Autostop enabled (1 machine)**: Compute billed only when running. At 0 traffic, ~$0/mo compute, but a minimum ~$0.02/GB bandwidth. **~$0–1/mo idle.**
- **At 5 clients, 1,000 calls/mo × 3 min = 3,000 machine-minutes = 50 compute-hours**:
  - Always-on: still ~$4–5/mo (billed by wall-clock, traffic doesn't change it).
  - Autostop: ~$0.50/mo compute + egress. Egress: Twilio media is μ-law at 64 kbps × 2 directions × 3000 min = ~2.8 GB out. At Fly's ~$0.02/GB North America egress = **~$0.06/mo egress**. Total autostop at 5 clients: **~$0.50–1/mo**.
- **Verdict**: Fly hosting is negligible at this scale either way. The cost-driver is the latency/cold-start tradeoff, not dollars. See DECISION.md #1.

CLAUDE.md's "~$5/mo Fly.io shared across clients" line stays accurate.

### 7. Logging / observability

- Backend already uses Pino via `Fastify({ logger: true })`. Pino writes JSON to stdout by default — Fly's log drain captures stdout/stderr natively. **Zero changes needed.**
- `fly logs` for live tailing. `fly logs --ship-to <drain>` later if we want Logtail/Datadog — not now.
- One gap worth flagging for the next iteration (not this deploy): structured log fields for `callSid` and `streamSid` so calls are greppable. Noted for the principal engineer's follow-up, not a blocker.

### 8. Rollback plan

`fly releases` lists every deploy by number. To roll back immediately:

```
fly releases       # find the last good release number, e.g. v42
fly deploy --image-label v42
```

One line, ~30 seconds. If the deploy itself is broken (machine won't boot), `fly machine restart <id>` against a known-good image is the faster path. Parviz should rehearse this once before relying on it — the first rollback in the middle of an incident is not the time to read docs.

### 9. Webhook signature validation — HARD PREREQUISITE

**Checked `server.js` and `relay.js`. Signature validation is not present.**

- `fastify.all('/twiml', ...)` accepts any POST from the internet with zero verification.
- `TWILIO_WEBHOOK_SECRET` exists in `.env.example` but is not referenced in code.
- The `/twilio-media` WS endpoint has no auth either — anyone who knows the URL can open a stream.

CLAUDE.md states: *"Twilio webhook signature validation is always required. Non-negotiable security rule."* Exposing `+1 (873) 736-0217`'s webhook publicly without validation means a drive-by attacker could hit `/twiml` and burn OpenAI Realtime credits by opening rogue WS sessions.

**Action**: Before `fly deploy` goes live with real Twilio traffic, Coder must add:
1. Twilio signature middleware on `/twiml` (validate `X-Twilio-Signature` against `TWILIO_AUTH_TOKEN`).
2. A signed token check on `/twilio-media` upgrade (the `<Stream>` TwiML can pass a custom parameter that the WS handler validates against `TWILIO_WEBHOOK_SECRET`, HMAC-style).

This is a Designer + Coder task, separate from the deployment mechanics. It must land **before or in the same PR** as the Fly deploy. No exceptions.

### 10. Teaching moment — WebSocket idle timeout & voice cold-start

Fly's proxy idle-closes WebSocket connections after 60 seconds of no frames by default. Twilio Media Streams send ~50 audio frames/sec while a call is live, so this never fires during a real call — but it matters in two silent cases: (1) if OpenAI stops sending audio (e.g., caller is silent longer than VAD's `silence_duration_ms`, Sofia is thinking), the Twilio leg still streams silence packets, so we're fine; (2) **if the machine is auto-stopped**, the next call's WS handshake has to wait for the Fly Machine to boot Node — typically 2–8 seconds. On a phone call, that 2–8 seconds is the caller listening to nothing after answering "Bonjour, hi!" — it's the difference between "professional AI receptionist" and "broken robot."

The parallel from your CV/ML background: this is the same class of problem as a warm vs. cold GPU inference pod. You don't pay for idle GPU when nothing is happening, but the first request after idle eats the kernel load + model weight hydration cost. Sofia's equivalent is Node startup + OpenAI WS handshake. For a voice agent the user-perceived tail latency matters more than the idle dollar savings — which is why the recommendation below leans toward always-on, but I'm surfacing it as a decision since $4/mo is still $4/mo and it's your call.

---

## Agent delegation

1. **Parviz** → resolve DECISION.md #1 (autostop vs always-on).
2. **Designer** → spec the Twilio signature validation middleware for `/twiml` and the signed-token scheme for `/twilio-media` WS upgrade. Reference `TWILIO_WEBHOOK_SECRET`. Deliverable: `specs/SPEC_twilio_signature_validation.md`.
3. **Principal Engineer** → review designer spec, oversee coder, enforce that signature validation lands in the same PR as the Fly deploy (not a follow-up).
4. **Coder** → produce `backend/Dockerfile`, `backend/fly.toml`, `backend/.dockerignore`, signature-validation middleware per designer spec, and extended `/health` endpoint (adds `ws_registered` boolean + active connection count).
5. **Critic** → review Dockerfile + fly.toml + signature middleware. Specifically: non-root user, no secrets in image, healthcheck works, signature validation rejects bad signatures with 403, WS rejects bad tokens on upgrade.
6. **Devil's Advocate** → skip. Direction is standard; no novel architecture. Runs again if Parviz picks autostop and we want to stress-test cold-start UX.
7. **Note Taker** → record this blueprint, link to the DECISION outcome once resolved, update README to reflect "backend hosted on Fly.io Toronto."
8. **Secretary** → next session opens with HANDOFF pointing at DECISION.md if unresolved, or at the Designer spec task if resolved.

## Open questions for Parviz

One genuine decision: autostop vs always-on. Written to `DECISION.md`.

Everything else in this blueprint is an architect call and is already made.

---

## Deployment runbook summary (for reference once unblocked)

1. Resolve DECISION.md #1.
2. Designer writes `SPEC_twilio_signature_validation.md`.
3. Coder implements signature validation + extended `/health`.
4. Coder writes `backend/Dockerfile`, `backend/.dockerignore`, `backend/fly.toml`.
5. Critic reviews.
6. Parviz runs: `fly launch --no-deploy` (accepts generated settings or overrides), `fly secrets set ...` (full list above), `fly deploy`.
7. Parviz tests with `fly logs` + a curl to `https://<app>.fly.dev/health`.
8. Parviz updates Twilio console Voice webhook to `https://<app>.fly.dev/twiml`.
9. Parviz places a real test call from his phone.
10. Once verified: shut down ngrok + laptop server. Sofia is live.
