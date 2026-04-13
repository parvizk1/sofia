// Sofia voice relay — persona-agnostic orchestrator.
//
// Keeps:
//   - Twilio WebSocket handshake + validateStreamAuth()
//   - OpenAI Realtime WebSocket lifecycle
//   - Audio forwarding in both directions
//
// Delegates to persona module:
//   - System prompt, voice, VAD, tool schemas
//   - Tool handler dispatch
//   - Transcript-fallback + filler audio are owned by relay.js using persona + lib modules
//
// Spec: SPEC_sofia_inbound_agent.md §1.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import WebSocket from 'ws';

import { validateStreamAuth } from './middleware/ws-auth.js';
import { resolvePersona } from './agents/index.js';
import { createSmsClient } from './lib/twilio-sms.js';
import { createCallsClient } from './lib/twilio-calls.js';
import { extractLeadFromTranscript } from './lib/transcript-fallback.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const MULAW_FRAME_SIZE = 160; // 20ms at 8kHz μ-law
const FILLER_TRIGGER_MS = 800;

// Load filler audio once at module init. If missing, filler is disabled but
// the call still works. Pre-chunk into base64-encoded 20ms frames.
const fillerFrames = loadFillerFrames();

function loadFillerFrames() {
  try {
    const path = join(__dirname, 'audio/un-instant.mulaw');
    const buf = readFileSync(path);
    if (buf.length === 0) {
      // Placeholder committed before real audio was generated.
      return null;
    }
    const frames = [];
    for (let i = 0; i < buf.length; i += MULAW_FRAME_SIZE) {
      const slice = buf.subarray(i, Math.min(i + MULAW_FRAME_SIZE, buf.length));
      frames.push(slice.toString('base64'));
    }
    return frames;
  } catch (_err) {
    return null;
  }
}

const getOpenAIKey = () => process.env.OPENAI_API_KEY;

export function handleTwilioConnection(twilioWs, log, context = {}) {
  const {
    sourceIp = null,
    reqId = null,
    counters = { authRejectionsTotal: 0 },
    expectedToken = process.env.STREAM_AUTH_TOKEN,
    env = process.env,
    smsClient = createSmsClient({ env: process.env, log, counters }),
    callsClient = createCallsClient({ env: process.env, log }),
  } = context;

  // Per-call state (closure-local, never global).
  const callState = {
    reqId,
    streamSid: null,
    callSid: null,
    callerPhone: null,
    startedAtMs: Date.now(),
    persona: null,
    leadSubmitted: false,
    linkSent: false,
    transcript: [], // [{ role, text, tMs }]
    language: 'unknown',
    fillerTimer: null,
    fillerInterval: null,
    fillerPlaying: false,
    openaiResponseInFlight: false,
    endCallRequested: false,
    wrapWarningSent: false,
    authed: false,
    twilioWs,
    openaiWs: null,
    onResponseDone: null, // one-shot hook used by end_call teardown
    _smsClient: smsClient,
    _callsClient: callsClient,
    _counters: counters,
    _deps: { log, env, smsClient, callsClient, counters },
  };

  // Assemble caller-side partial transcript pieces safely. OpenAI emits
  // `conversation.item.input_audio_transcription.completed` per turn for the
  // caller; we append whole utterances there.
  // We collect Sofia's audio_transcript.delta pieces per response and flush
  // on response.audio_transcript.done (or on response.done if we missed it).
  const sofiaAudioBuffers = new Map(); // response_id → [text, text]

  twilioWs.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (err) {
      log.warn({ err, reqId }, 'Twilio WS non-JSON frame');
      return;
    }

    switch (msg.event) {
      case 'connected':
        log.info({ reqId }, 'Twilio stream connected');
        break;

      case 'start': {
        const authResult = validateStreamAuth({
          customParameters: msg.start?.customParameters,
          expectedToken,
          log,
          counters,
          reqId: msg.start?.streamSid || reqId,
          sourceIp,
        });
        if (!authResult.ok) {
          try {
            twilioWs.close(1008, '');
          } catch (_err) {
            // swallow
          }
          return;
        }

        callState.authed = true;
        callState.streamSid = msg.start.streamSid;
        callState.callSid = msg.start.callSid || null;
        // Twilio Media Streams `start` includes `start.customParameters` + `start.accountSid`
        // but NOT typically the caller E.164 directly. The From number is on the
        // parent call; we surface it via Twilio's `start` when available.
        const fromCandidate =
          msg.start?.from ||
          (msg.start?.customParameters && pickFrom(msg.start.customParameters)) ||
          null;
        callState.callerPhone = normalizeE164(fromCandidate);

        const persona = resolvePersona({
          toNumber: msg.start?.to || null,
          streamSid: callState.streamSid,
          reqId,
        });
        callState.persona = persona;

        if (counters) counters.inboundCallsTotal = (counters.inboundCallsTotal || 0) + 1;

        log.info(
          {
            event: 'call_start',
            reqId,
            streamSid: callState.streamSid,
            callSid: callState.callSid ? callState.callSid.slice(0, 6) + '...' : null,
            callerPhoneLast4: callState.callerPhone ? callState.callerPhone.slice(-4) : null,
            persona: persona.key,
          },
          'Call started'
        );

        callState.openaiWs = connectToOpenAI(callState, log);
        break;
      }

      case 'media':
        if (!callState.authed) return;
        if (callState.openaiWs?.readyState === WebSocket.OPEN) {
          sendAudioToOpenAI(callState.openaiWs, msg.media.payload);
        }
        break;

      case 'stop':
        log.info({ reqId }, 'Twilio stream stopped');
        handleCallEnd(callState, { log, env, smsClient, counters }).catch((err) => {
          log.error(
            { err: err.message, reqId, event: 'call_end_handler_error' },
            'Call-end handler threw'
          );
        });
        try {
          callState.openaiWs?.close();
        } catch (_err) {
          // swallow
        }
        break;
    }
  });

  twilioWs.on('close', () => {
    log.info(
      {
        event: 'call_end',
        reqId,
        durationSec: Math.round((Date.now() - callState.startedAtMs) / 1000),
        leadSubmitted: callState.leadSubmitted,
        linkSent: callState.linkSent,
      },
      'Twilio WebSocket closed'
    );
    // If `stop` wasn't seen (abrupt hangup), still run the fallback.
    handleCallEnd(callState, { log, env, smsClient, counters }).catch((err) => {
      log.error(
        { err: err.message, reqId, event: 'call_end_handler_error' },
        'Call-end handler threw'
      );
    });
    try {
      callState.openaiWs?.close();
    } catch (_err) {
      // swallow
    }
    clearFiller(callState);
  });

  twilioWs.on('error', (err) => {
    log.error({ err: err.message, reqId }, 'Twilio WebSocket error');
    try {
      callState.openaiWs?.close();
    } catch (_err) {
      // swallow
    }
    clearFiller(callState);
  });
}

function connectToOpenAI(callState, log) {
  const persona = callState.persona;
  const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(persona.model)}`;
  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${getOpenAIKey()}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  ws.on('open', () => {
    log.info({ reqId: callState.reqId }, 'Connected to OpenAI Realtime API');
    configureSession(ws, persona);
  });

  ws.on('message', (data) => {
    let event;
    try {
      event = JSON.parse(data);
    } catch (err) {
      log.warn({ err: err.message, reqId: callState.reqId }, 'OpenAI non-JSON frame');
      return;
    }
    handleOpenAIEvent(event, callState, log);
  });

  ws.on('close', () => {
    log.info({ reqId: callState.reqId }, 'OpenAI WebSocket closed');
  });

  ws.on('error', (err) => {
    log.error({ err: err.message, reqId: callState.reqId, event: 'openai_error' }, 'OpenAI WebSocket error');
  });

  return ws;
}

function configureSession(ws, persona) {
  ws.send(
    JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: persona.instructions,
        voice: persona.voice,
        input_audio_format: persona.audioFormats.input,
        output_audio_format: persona.audioFormats.output,
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: persona.vad,
        tools: persona.tools,
        tool_choice: 'auto',
        temperature: persona.temperature,
        max_response_output_tokens: persona.maxResponseOutputTokens,
      },
    })
  );
}

function sendAudioToOpenAI(ws, base64Audio) {
  ws.send(
    JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    })
  );
}

export function handleOpenAIEvent(event, callState, log) {
  const openaiWs = callState.openaiWs;
  const twilioWs = callState.twilioWs;

  switch (event.type) {
    case 'session.created':
      log.info({ reqId: callState.reqId }, 'OpenAI session created');
      break;

    case 'session.updated':
      log.info({ reqId: callState.reqId }, 'OpenAI session configured');
      break;

    case 'input_audio_buffer.speech_started':
      // Caller resumed speaking — cancel any pending filler.
      clearFiller(callState);
      break;

    case 'input_audio_buffer.speech_stopped':
      callState.openaiResponseInFlight = false;
      scheduleFiller(callState, log);
      break;

    case 'response.created':
      callState.openaiResponseInFlight = true;
      break;

    case 'response.audio.delta':
      // Interrupt filler on first real audio chunk.
      if (callState.fillerPlaying || callState.fillerTimer) {
        clearFiller(callState);
        // Flush Twilio-side buffer so filler+response don't overlap.
        if (twilioWs && twilioWs.readyState === WebSocket.OPEN && callState.streamSid) {
          try {
            twilioWs.send(JSON.stringify({ event: 'clear', streamSid: callState.streamSid }));
          } catch (_err) {
            // swallow
          }
        }
      }
      if (twilioWs && twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.send(
          JSON.stringify({
            event: 'media',
            streamSid: callState.streamSid,
            media: { payload: event.delta },
          })
        );
      }
      break;

    case 'response.audio_transcript.delta': {
      const id = event.response_id || event.item_id || 'unknown';
      if (!callState._sofiaAudioBuffers) callState._sofiaAudioBuffers = new Map();
      const prev = callState._sofiaAudioBuffers.get(id) || '';
      callState._sofiaAudioBuffers.set(id, prev + (event.delta || ''));
      break;
    }

    case 'response.audio_transcript.done': {
      const id = event.response_id || event.item_id || 'unknown';
      const text = (event.transcript && String(event.transcript)) ||
        (callState._sofiaAudioBuffers && callState._sofiaAudioBuffers.get(id)) ||
        '';
      if (text && text.trim().length > 0) {
        callState.transcript.push({
          role: 'sofia',
          text: text.trim(),
          tMs: Date.now() - callState.startedAtMs,
        });
      }
      if (callState._sofiaAudioBuffers) callState._sofiaAudioBuffers.delete(id);
      break;
    }

    case 'conversation.item.input_audio_transcription.completed': {
      const text = event.transcript && String(event.transcript);
      if (text && text.trim().length > 0) {
        callState.transcript.push({
          role: 'caller',
          text: text.trim(),
          tMs: Date.now() - callState.startedAtMs,
        });
      }
      break;
    }

    case 'response.function_call_arguments.done': {
      const { name, call_id, arguments: argsJson } = event;
      dispatchTool(name, call_id, argsJson, callState, log).catch((err) => {
        log.error(
          { err: err.message, reqId: callState.reqId, event: 'tool_handler_error', toolName: name },
          'Tool dispatch threw'
        );
      });
      break;
    }

    case 'response.done':
      callState.openaiResponseInFlight = false;
      if (typeof callState.onResponseDone === 'function') {
        try {
          callState.onResponseDone();
        } catch (_err) {
          // swallow
        }
      }
      break;

    case 'error':
      log.error({ error: event.error, reqId: callState.reqId, event: 'openai_error' }, 'OpenAI error');
      break;
  }
}

async function dispatchTool(name, callId, argsJson, callState, log) {
  const persona = callState.persona;
  const handler = persona?.toolHandlers?.[name];
  const openaiWs = callState.openaiWs;
  if (!handler) {
    log.error({ reqId: callState.reqId, toolName: name, event: 'tool_handler_error' }, 'Unknown tool call');
    sendFunctionCallOutput(openaiWs, callId, { ok: false, error: 'unknown_tool' });
    return;
  }
  let args = {};
  if (argsJson && argsJson.length > 0) {
    try {
      args = JSON.parse(argsJson);
    } catch (err) {
      log.error(
        { reqId: callState.reqId, toolName: name, err: err.message, event: 'tool_handler_error' },
        'Tool args JSON parse failed'
      );
      sendFunctionCallOutput(openaiWs, callId, { ok: false, error: 'invalid_args' });
      return;
    }
  }
  log.info({ reqId: callState.reqId, event: 'tool_fired', toolName: name }, 'Tool fired');
  let result;
  try {
    result = await handler(args, callState, callState._deps || {
      log,
      env: process.env,
      smsClient: callState._smsClient,
      callsClient: callState._callsClient,
      counters: callState._counters,
    });
  } catch (err) {
    log.error(
      { err: err.message, reqId: callState.reqId, toolName: name, event: 'tool_handler_error' },
      'Tool handler threw'
    );
    result = { ok: false, error: 'handler_threw' };
  }
  sendFunctionCallOutput(openaiWs, callId, result);
  // Nudge the model to keep speaking.
  if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
    openaiWs.send(JSON.stringify({ type: 'response.create' }));
  }
}

function sendFunctionCallOutput(ws, callId, output) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(output),
      },
    })
  );
}

// -------- Filler audio --------

function scheduleFiller(callState, log) {
  if (!fillerFrames || fillerFrames.length === 0) {
    // Filler disabled — no audio loaded.
    return;
  }
  if (callState.fillerTimer) {
    clearTimeout(callState.fillerTimer);
  }
  callState.fillerTimer = setTimeout(() => {
    callState.fillerTimer = null;
    playFiller(callState, log);
  }, FILLER_TRIGGER_MS);
}

function playFiller(callState, log) {
  if (!fillerFrames || fillerFrames.length === 0) return;
  if (callState.openaiResponseInFlight) return; // response arrived between schedule and fire
  const twilioWs = callState.twilioWs;
  if (!twilioWs || twilioWs.readyState !== WebSocket.OPEN) return;

  callState.fillerPlaying = true;
  if (callState._counters) {
    callState._counters.fillerPlaysTotal = (callState._counters.fillerPlaysTotal || 0) + 1;
  }
  log.info({ reqId: callState.reqId, event: 'filler_played' }, 'Filler playback started');

  let i = 0;
  callState.fillerInterval = setInterval(() => {
    if (!callState.fillerPlaying) {
      // Interrupted by clearFiller()
      clearInterval(callState.fillerInterval);
      callState.fillerInterval = null;
      return;
    }
    if (i >= fillerFrames.length) {
      clearInterval(callState.fillerInterval);
      callState.fillerInterval = null;
      callState.fillerPlaying = false;
      return;
    }
    if (twilioWs.readyState === WebSocket.OPEN) {
      try {
        twilioWs.send(
          JSON.stringify({
            event: 'media',
            streamSid: callState.streamSid,
            media: { payload: fillerFrames[i] },
          })
        );
      } catch (_err) {
        clearInterval(callState.fillerInterval);
        callState.fillerInterval = null;
        callState.fillerPlaying = false;
        return;
      }
    }
    i += 1;
  }, 20);
}

function clearFiller(callState) {
  // Flip the flag FIRST: any in-flight 20ms interval tick reads this on entry
  // and short-circuits before sending another frame. Otherwise a tick already
  // queued on the event loop can send one extra filler frame after the Twilio
  // `clear` event, producing a ~20ms stutter at the start of Sofia's response.
  callState.fillerPlaying = false;
  if (callState.fillerTimer) {
    clearTimeout(callState.fillerTimer);
    callState.fillerTimer = null;
  }
  if (callState.fillerInterval) {
    clearInterval(callState.fillerInterval);
    callState.fillerInterval = null;
  }
}

// -------- Call-end / transcript fallback --------

let callEndRan = new WeakSet();

async function handleCallEnd(callState, deps) {
  if (callEndRan.has(callState)) return;
  callEndRan.add(callState);

  const { log, env, smsClient, counters } = deps;
  clearFiller(callState);
  if (!callState.leadSubmitted && Array.isArray(callState.transcript) && callState.transcript.length > 0) {
    await extractLeadFromTranscript(callState.transcript, callState, {
      log,
      env,
      smsClient,
      counters,
    });
  }
}

// -------- helpers --------

function normalizeE164(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return trimmed;
  // Defensive: Twilio typically sends E.164 already. If not, return raw.
  return trimmed;
}

function pickFrom(customParameters) {
  if (!customParameters || typeof customParameters !== 'object') return null;
  for (const [k, v] of Object.entries(customParameters)) {
    if (typeof k === 'string' && k.toLowerCase() === 'from' && typeof v === 'string') {
      return v;
    }
  }
  return null;
}

// Exposed for tests
export const _internal = {
  loadFillerFrames,
  normalizeE164,
  pickFrom,
  handleOpenAIEvent,
  handleCallEnd,
  MULAW_FRAME_SIZE,
  FILLER_TRIGGER_MS,
};
