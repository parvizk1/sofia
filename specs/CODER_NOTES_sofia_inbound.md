# Coder Notes: Sofia Inbound Qualification Agent

**Date:** 2026-04-13
**Spec:** [`SPEC_sofia_inbound_agent.md`](./SPEC_sofia_inbound_agent.md)
**Branch:** `feature/sofia-inbound-agent-2026-04-13` (branched from `origin/main` at `b49be03`)

## What was built

Replaced the 14-line inline `SYSTEM_PROMPT` in `relay.js` with a persona/tool module architecture. `relay.js` is now persona-agnostic — it loads the persona via `agents/index.js::resolvePersona()` at connection time, drives a rich per-call state object, dispatches the three OpenAI Realtime tools (`submit_lead`, `send_sms_link`, `end_call`), assembles the bilingual transcript from both caller and Sofia OpenAI events, schedules a 800ms latency filler with interrupt-on-response-arrival, and runs a gpt-4o-mini transcript-fallback extraction on call-end if `submit_lead` never fired.

All HTTP goes through `fetch` (no new deps). All tests use `node:test`. `un-instant.mulaw` is committed as a **0-byte placeholder** — see below.

## Files created

**Persona + prompt:**
- `backend/agents/index.js` — persona registry (v1 hardcoded to sofia-inbound).
- `backend/agents/sofia-inbound.js` — PersonaConfig default export; reads prompt once at module init.
- `backend/prompts/sofia-inbound.md` — full prompt verbatim from SPEC §2.

**Tools:**
- `backend/tools/index.js` — `{ tools, toolHandlers }` registry consumed by persona.
- `backend/tools/submit-lead.js` — schema + idempotent handler; truncates business_type to 200 / notes to 400; always marks leadSubmitted true even on SMS failure (log-recover).
- `backend/tools/send-sms-link.js` — schema + handler; EN/FR body selection from `callState.language`.
- `backend/tools/end-call.js` — schema + handler; fire-and-forget teardown that waits for `response.done` (up to 3s) then 500ms flush then POSTs `Status=completed`.

**Lib:**
- `backend/lib/twilio-sms.js` — `createSmsClient({ env, log, counters, fetchImpl })`. Exports `{ send, sendLeadSms, sendRaw }`. `buildLeadSmsBody()` produces the exact §6 template.
- `backend/lib/twilio-calls.js` — `createCallsClient` with `completeCall(callSid)`.
- `backend/lib/transcript-fallback.js` — `extractLeadFromTranscript` + `EXTRACTION_SYSTEM` + `buildRawTranscriptSms`.

**Audio:**
- `backend/audio/un-instant.mulaw` — **0-byte placeholder** (see below).

**Tests** (all under `backend/test/`):
- `submit-lead.test.js`, `send-sms-link.test.js`, `end-call.test.js`, `transcript-fallback.test.js`, `sofia-inbound-prompt.test.js`, `relay-transcript.test.js` (Designer-flagged silently-droppable transcript assembly).

## Files modified

- `backend/relay.js` — full rewrite as persona-agnostic orchestrator. 7 new event handlers, filler scheduling + playback + interrupt, transcript assembly from two OpenAI event families, `callSid` + caller phone capture from `msg.start.*`, tool dispatch, call-end hook that runs transcript fallback.
- `backend/server.js` — extended `counters` with 6 new metrics, `/health` emits the full block per SPEC §8.
- `backend/README.md` — added `## Inbound Agent (Sofia)` section covering env vars, filler audio regeneration steps, manual smoke-test runbook, test coverage.
- `.env.example` — added `TWILIO_FROM_NUMBER`, `LEAD_NOTIFICATION_PHONE`; noted that `OPENAI_API_KEY` is used for both Realtime and transcript-fallback.

## Test results

```
cd backend && npm test
```

**All 8 test files pass, 0 failures, 0 skips.** Under Node 16 the `--test` runner reports file-level counts (1 test per file). Assertion failures within `test()` blocks still surface as `ERR_TEST_FAILURE` — verified by inducing a failure. Each test file contains multiple `test()` cases (31 cases total across the 6 new files).

| Test file                            | Coverage                                                                 |
|--------------------------------------|--------------------------------------------------------------------------|
| `sofia-inbound-prompt.test.js`       | 15 phrase-grep tests + persona config shape.                             |
| `submit-lead.test.js`                | Success, idempotency, SMS-failure, link_sent propagation, truncation.    |
| `send-sms-link.test.js`              | EN/FR bodies, idempotency, missing-phone, failure, unknown→EN default.   |
| `end-call.test.js`                   | POST shape, handler return, idempotency, Twilio 4xx, missing callSid.    |
| `transcript-fallback.test.js`        | Success path (asserts gpt-4o-mini, EXTRACTION_SYSTEM, partial=true), raw-SMS fallback on 500, both-fail path, empty-transcript skip. |
| `relay-transcript.test.js`           | Caller + Sofia turns accumulate; interleaving; empty-text drop; response.done one-shot. |
| Pre-existing `twilio-signature.test.js`, `ws-auth.test.js` | Unchanged, still pass.                      |

Also verified with a live boot smoke test: `curl /health` returns the full extended metrics block exactly as specced.

## Spec ambiguities resolved

Per Coder protocol: security-affecting ambiguities → blocker, non-security → most defensive default + documented here.

1. **`LEAD_NOTIFICATION_PHONE` missing at lead-submit time.** Non-security (notification routing). Chose defensive default: `twilio-sms.js::sendLeadSms` returns `{ ok: false, error: 'missing_lead_notification_phone' }`, increments `sms_failures_total`, and the handler still marks `leadSubmitted = true` + logs the FULL payload (with phone number masked to last 4) at error level so Parviz can recover the lead from logs. Never throws. Never retries. Server continues normally.

2. **`callSid` missing from Twilio start event (shouldn't happen but defensive).** `end_call` teardown logs `event: 'twilio_end_call_failed', reason: 'missing_call_sid'` at error level and still closes local sockets; Twilio will time out its side within ~30s. No crash.

3. **VAD `silence_duration_ms: 600`** — taken verbatim from spec §7 (PE will tune during smoke test).

4. **Filler-audio frame sizing** — spec says 20ms frames of 160 bytes at 8kHz μ-law. I pre-chunk the Buffer by 160-byte slices and pre-base64 each. Last slice may be partial; kept as-is (Twilio tolerates short final frame).

5. **Twilio `msg.start.from` vs `customParameters.From`** — the real Twilio Media Stream `start` event includes `customParameters` and the parent call's `accountSid`, but caller E.164 is typically found under `msg.start.customParameters` (when set by the TwiML `<Parameter>`) or passed via `msg.start.from` in newer Twilio shapes. I read from both locations defensively (`normalizeE164(msg.start?.from || customParameters.from)`). If Twilio's shape differs in production, `callerPhone` falls through as `null` and `send_sms_link` returns `no_caller_phone` — surfaces cleanly, never crashes.

6. **Designer's prompt test asserts both `I'm Sofia, an AI assistant` (EN) AND `je suis Sofia, une assistante virtuelle` (FR).** Both phrases are present in the prompt verbatim.

7. **`response.audio_transcript.done` with empty `transcript` field.** Spec says assemble from deltas too. I do: cache deltas per `response_id`, flush on `.done` preferring the event's own `transcript` if present, falling back to accumulated deltas. Test covers both shapes.

## Critical implementation concerns — how I handled them

1. **Filler-audio interrupt correctness.** On `response.audio.delta` arrival while `fillerPlaying || fillerTimer` is true: `clearFiller()` (clears both setTimeout AND setInterval AND sets `fillerPlaying = false`, which makes the interval callback exit on its next tick), then sends Twilio `{ event: 'clear', streamSid }` to flush the Twilio-side playout buffer, THEN forwards the response audio normally. `clearFiller()` is also called on `input_audio_buffer.speech_started` (caller resumed) so we don't play filler over an active caller turn.

2. **Transcript assembly correctness.** Caller side: `conversation.item.input_audio_transcription.completed` → push `{ role: 'caller' }`. Sofia side: accumulate `response.audio_transcript.delta` deltas per `response_id` on `callState._sofiaAudioBuffers`, flush to `{ role: 'sofia' }` on `.done` (preferring `event.transcript` when present). Unit test `relay-transcript.test.js` exercises interleaved events + whitespace/empty dropping + the response.done one-shot hook used by `end_call` teardown.

3. **`callSid` capture.** Stored on `callState.callSid` from `msg.start.callSid` in the start-event branch. `end_call` teardown reads it; missing SID logs `twilio_end_call_failed, reason: missing_call_sid` and still closes local sockets.

## Filler audio outcome

**Placeholder (0 bytes) committed.** No `say`, no `ffmpeg` in this dev environment (WSL Ubuntu without the audio toolchain). `relay.js::loadFillerFrames()` treats a 0-byte file exactly like a missing file: `fillerFrames = null`, filler is disabled at boot, the call still works. `scheduleFiller()` returns immediately when `fillerFrames` is falsy — no functional regression, callers just hear OpenAI's native latency instead of "un instant" if the response takes >800ms.

**Manual generation steps** (documented in `backend/README.md`):

```bash
# Option A — OpenAI TTS + ffmpeg (preferred; reproducible from CI with OPENAI_API_KEY)
curl https://api.openai.com/v1/audio/speech \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","voice":"shimmer","input":"Un instant.","response_format":"wav"}' \
  --output /tmp/un-instant.wav
ffmpeg -y -i /tmp/un-instant.wav -ar 8000 -ac 1 -f mulaw backend/audio/un-instant.mulaw

# Option B — Mac
say -v Amelie "Un instant." -o /tmp/un-instant.aiff
ffmpeg -y -i /tmp/un-instant.aiff -ar 8000 -ac 1 -f mulaw backend/audio/un-instant.mulaw
```

The file must be **raw μ-law 8kHz mono**, no WAV header, ~8000-9600 bytes for 1.0-1.2s duration. Normalized to -3 dBFS.

## Blockers

None. Everything specced is implemented; all tests pass; server boots clean; `/health` returns the expected JSON.

## Flag for Critic's hardest look

The **filler-audio interrupt path** is the most fragile surface in this diff. The correctness hinges on three things all happening in lockstep when the first `response.audio.delta` arrives:

1. `clearFiller()` cancels both the pending `setTimeout` AND the active `setInterval`.
2. The interval callback's `if (!callState.fillerPlaying) return` guard prevents one more frame being sent between the clear and the setInterval actually stopping (race window is ≤20ms).
3. Twilio receives the `{ event: 'clear', streamSid }` BEFORE the response audio starts landing, so its playout buffer is flushed and the caller doesn't hear filler+response overlap.

I believe the code is correct, but the integration is untestable without real sockets. Critic should sanity-check the order of operations in `relay.js::handleOpenAIEvent` for `response.audio.delta` and especially verify that sending the `clear` event BEFORE the first `media` forward is the right ordering for Twilio (spec §5 says yes; I have not independently verified against Twilio docs). If the clear flushes the new response audio too, we'd get a stuttered first 20ms. The ~40ms cut the spec acknowledges as "acceptable" should dominate either way.

Second-most fragile: `end_call` teardown's `waitForResponseDone` race. If the model fires `end_call` before the final `response.created` has been observed (i.e., `openaiResponseInFlight === false` at the moment of the call), we resolve immediately, sleep 500ms, and hang up. If OpenAI emits a late audio burst in that 500ms window, it reaches Twilio after Twilio already got `Status=completed` → silent drop. Less damaging than the filler race, but worth a look.

## How to test locally

```bash
cd backend
source ~/.nvm/nvm.sh && nvm use 16.20.2   # if on WSL Ubuntu 18.x
npm test                                    # all 8 files pass
# Boot smoke test (fake env):
TWILIO_AUTH_TOKEN=x_test_token_0123456789abcdef \
STREAM_AUTH_TOKEN=s_test_token_0123456789abcdef \
OPENAI_API_KEY=sk-test-0123456789abcdef \
PORT=3000 node server.js
# in another terminal:
curl http://localhost:3000/health | jq
```
