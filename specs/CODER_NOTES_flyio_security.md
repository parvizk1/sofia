# Coder Notes: Fly.io Deploy + Twilio Security

**Date:** 2026-04-13
**Specs:**
- `/home/parviz/sofia/specs/SPEC_twilio_security.md`
- `/home/parviz/sofia/specs/BLUEPRINT_flyio_deployment.md`

**Branch:** `feature/flyio-deploy-with-security-2026-04-13` (from `main`)

## What was built

Implemented the Twilio signature + WebSocket auth layer and the Fly.io deployment artifacts in one branch, per Architect's non-negotiable rule that security lands in the same PR as the deploy. Two small Fastify middlewares (HMAC-SHA1 signature on `/twiml`, token check on `/twilio-media` start frame) gate the existing relay, with a hard-fail boot check if either secret is missing. Dockerfile + fly.toml + .dockerignore complete the deploy posture (always-on, `yyz`, 512MB, concurrency hard_limit 25).

## Files created

- `backend/middleware/twilio-signature.js` — Fastify `preValidation` hook factory. Manual HMAC-SHA1; `URLSearchParams.getAll()` for duplicate keys; dedupes+sorts keys; constant-time compare; rejects 403 empty body.
- `backend/middleware/ws-auth.js` — pure validator; case-insensitive key lookup; length-check short-circuit; `crypto.timingSafeEqual`.
- `backend/test/twilio-signature.test.js` — 7 cases (valid pass, bad sig, no header, XFP drives URL reconstruction, duplicate keys, internal signer fixture, safeEqual edge cases).
- `backend/test/ws-auth.test.js` — 8 cases (valid, no customParameters, no key, wrong same-length, length-mismatch, case-insensitive, server-misconfigured, internal safeEqualStr).
- `backend/Dockerfile` — `node:20-alpine`, non-root, single-stage, deps layer before source, HEALTHCHECK via `wget /health`, `USER node`.
- `backend/fly.toml` — app `sofia-backend`, region `yyz`, always-on (`auto_stop_machines = false`, `min_machines_running = 1`), one tcp service with both http/443 ports (handles WS upgrade transparently), `force_https`, concurrency connections 20/25, `shared-cpu-1x` 512MB, `/health` http_check every 15s.
- `backend/.dockerignore` — excludes node_modules, .env*, .git, logs, test/, coverage.
- `backend/README.md` — includes `## Security` (links to spec) + `## Deployment` with full runbook: `fly secrets set`, `fly deploy`, `/health` verification, manual Twilio-console step (flagged as unautomatable), test call, rollback via `fly releases`.
- `specs/CODER_NOTES_flyio_security.md` — this file.

## Files modified

- `backend/server.js` — boot-time secret assertions (process.exit(1) on missing/short `TWILIO_AUTH_TOKEN` or `STREAM_AUTH_TOKEN`, logged as stderr JSON before Pino is constructed); `Fastify({ trustProxy: true })`; route changed from `fastify.all('/twiml', ...)` to `fastify.post('/twiml', ...)` with `preValidation: twilioSigHook`; `/twiml` response embeds `<Parameter name="auth_token" value="..."/>`, XML-escaped; `/health` extended with `ws_registered`, `active_ws_connections`, `metrics.auth_rejections_total`; `/twilio-media` passes `sourceIp`, `reqId`, counters, and `expectedToken` into `handleTwilioConnection`.
- `backend/relay.js` — `handleTwilioConnection(twilioWs, log, context)` now validates the `start` frame via `validateStreamAuth` before opening the OpenAI relay; mismatch closes WS with 1008 empty reason; pre-auth `media` frames are dropped defensively; structured logs include `reqId`.
- `backend/package.json` — added `"test": "node --test test/"` script. **No new dependencies.**
- `.env.example` — added `TWILIO_AUTH_TOKEN` documentation comment, added `STREAM_AUTH_TOKEN` with generation instructions, removed `TWILIO_WEBHOOK_SECRET` (renamed per spec).
- `.gitignore` — added `.secrets`.

## Spec ambiguities resolved (with reasoning)

1. **Boot-time logging before Pino exists.** Spec says "log fatal ... and `process.exit(1)`". Pino isn't constructed yet at that point. I write a JSON line to `stderr` with the same keys (`level: "fatal"`, `key`, `msg`, `time`) so Fly's log drain still captures it in the same shape. No secret value is emitted.
2. **`request.routerPath` in rejection log.** Fastify may not have set `routerPath` at `preValidation` for an unmatched route (e.g., a 403 from `no-header`). I fall back to `request.url` when `routerPath` is unset.
3. **`active_ws_connections` counting.** Spec section 4.2 mentions "active_connections". I named the field `active_ws_connections` to match the rubric in this task's Section A bullet. Counter increments on upgrade handler entry, decrements on socket `close` — includes unauthenticated sockets that were closed with 1008, which is the honest surface to expose.
4. **Belt-and-suspenders on pre-auth media frames.** Twilio always sends `start` before `media`, but I added a `if (!authed) return;` guard in the `media` branch so a hypothetical reorder or injection can't push audio to OpenAI before validation. Spec said "no audio forwarded until validated" and this is the most defensive reading.
5. **`fly.toml` single service for HTTP+WS.** Spec/blueprint explicitly say one service, two ports (80/443), WS upgrade passes through `handlers = ["tls", "http"]`. I put `force_https = true` on port 80 so plain HTTP redirects up to 443; the 443 port does TLS termination and http upgrade. This matches blueprint §3.
6. **Token generation command.** Spec says `openssl rand -base64 32`; README mentions `openssl rand -hex 32`. I documented both in `.env.example`, with the runbook using `openssl rand -hex 32 ` because the 64 hex chars are unambiguous as an env var value (no `+` or `/` to worry about).

## Acceptance criteria

### HTTP signature validation
- [x] Valid `X-Twilio-Signature` → 200 TwiML (test 1 passes).
- [x] Invalid signature → 403 empty body, counter increments (test 2).
- [x] Missing header → 403 (test 3).
- [x] `X-Forwarded-Proto: https` drives URL reconstruction (test 4).
- [x] `GET /twiml` → 404 (route is POST-only; Fastify handles this automatically).
- [x] No log line contains signature/token/Auth Token values — all log statements emit only `reqId`, `route`, `reason`, `sourceIp`.
- [x] Missing `TWILIO_AUTH_TOKEN` at boot → exit 1 (verified in smoke test: produces `{"level":"fatal","key":"TWILIO_AUTH_TOKEN",...}`).
- [x] Missing `STREAM_AUTH_TOKEN` at boot → exit 1.
- [x] `Fastify({ trustProxy: true })`.

### TwiML response
- [x] `/twiml` response contains `<Parameter name="auth_token" value="..."/>` inside `<Stream>`.
- [x] `value` is XML-escaped.
- [x] `wss://` when Host is not localhost, `ws://` when it is.

### WebSocket auth
- [x] Valid token proceeds to OpenAI session (test 8 — valid token accepts).
- [x] Missing `customParameters` closes 1008 (test 9 — logic returns before `connectToOpenAI` is called).
- [x] Wrong token closes 1008 (test 11).
- [x] Case-insensitive key lookup (test 13).
- [x] `crypto.timingSafeEqual` with length-mismatch short-circuit (test 12, 15).

### Observability
- [x] `/health` returns `metrics.auth_rejections_total` (verified via smoke-test curl).
- [x] Each rejection increments the counter by exactly 1 (asserted in tests 2, 3, 4 + 9/10/11/12).
- [x] Every rejection log contains `reqId`, `route`, `reason`, `sourceIp` only.

### Tests
- [x] `npm test` runs node:test and all 15 cases pass locally (node 20.11.0).
- [x] No network, no real Twilio/OpenAI credentials used.

### Deployment artifacts
- [x] `backend/Dockerfile` — node:20-alpine, non-root, single-stage, layer-cached, HEALTHCHECK on `/health`.
- [x] `backend/fly.toml` — sofia-backend, yyz, always-on, min_machines_running=1, internal_port 3000, force_https, concurrency connections 20/25, 512MB, http_check `/health`.
- [x] `backend/.dockerignore` — excludes node_modules, .env, .git, logs.
- [x] `backend/README.md` — Security + Deployment sections with full runbook, manual Twilio step flagged.

## Test results

```
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 230.3
```

Ran under Node v20.11.0 (an unofficial glibc-217 build had to be used locally because this WSL machine is on glibc 2.27; `fly.toml`/Dockerfile target the official `node:20-alpine` image which is unaffected).

Boot smoke-test:
- With both secrets set → `{"msg":"Sofia backend listening on 0.0.0.0:..."}` and `GET /health` → `{"status":"ok","ws_registered":true,"active_ws_connections":0,"metrics":{"auth_rejections_total":0}}`.
- With `TWILIO_AUTH_TOKEN` unset → stderr fatal JSON + exit 1 before Fastify starts. Confirmed.

## Blockers

None. All specced work implemented; tests pass; boot smoke-test clean.

## Notes for Critic

Hardest thing to get right — and therefore the thing the Critic should stare at the longest — is **`middleware/twilio-signature.js`'s URL reconstruction and duplicate-key handling**. Those are the two places where an incorrect manual HMAC silently accepts a non-Twilio request or silently rejects a legit one. The fixture test (`computeSignature` fixture) locks down the algorithm byte-for-byte against a reproducible HMAC, and the `X-Forwarded-Proto` test confirms we use the forwarded proto not `request.protocol`. Also worth double-checking: the decision to bind `request.body` as a raw string (body parser was already this way — I did not change it) means the signature middleware uses `new URLSearchParams(request.body)`, which URL-decodes values; that matches what Twilio signs. If a future PR swaps the body parser to return parsed objects, the middleware must be updated or it will silently 403 everything.

Secondary watch items: (1) fly.toml's single-service-two-ports shape for WS upgrades (Fly proxy behavior is where silent breakage lurks); (2) the XML-escape on the `<Parameter>` value — correct now, must stay correct if token format ever changes.

## Out of scope (not implemented — by spec)

- IP allowlist.
- Replay protection on `/twiml`.
- Per-call unique tokens.
- Monitoring/alerting beyond in-memory counter.
- Automatic secret rotation.

## How Parviz verifies locally

```bash
cd backend
npm install
TWILIO_AUTH_TOKEN=$(openssl rand -hex 16) STREAM_AUTH_TOKEN=$(openssl rand -hex 32) npm start
# separate terminal:
curl http://localhost:3000/health
# should return: {"status":"ok","ws_registered":true,...}

# run tests:
npm test
```
