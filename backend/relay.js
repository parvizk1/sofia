import WebSocket from 'ws';
import { validateStreamAuth } from './middleware/ws-auth.js';

const getOpenAIKey = () => process.env.OPENAI_API_KEY;
const getOpenAIModel = () => process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';

const SYSTEM_PROMPT = `You are Sofia, a friendly AI receptionist assistant.

START every call with: "Bonjour, hi! Je suis Sofia, votre assistante virtuelle. I'm Sofia, your virtual assistant. Comment puis-je vous aider? How can I help you?"

After greeting, your job is simple:
1. Ask what SERVICE they're looking for
2. Ask for their PHONE NUMBER (to call them back)
3. Ask what TIME works best for a callback

Keep responses SHORT and natural — this is a phone call, not a chat.
Match the caller's language (French or English) after they respond.
Be warm and professional.

If they ask what you can do: explain you're an AI receptionist who helps businesses answer calls 24/7, book appointments, and never miss a lead.`;

export function handleTwilioConnection(twilioWs, log, context = {}) {
  const {
    sourceIp = null,
    reqId = null,
    counters = { authRejectionsTotal: 0 },
    expectedToken = process.env.STREAM_AUTH_TOKEN,
  } = context;

  let openaiWs = null;
  let streamSid = null;
  let authed = false;

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
          // ws-auth validator already logged + incremented the counter.
          // Close with 1008 Policy Violation, empty reason string.
          try {
            twilioWs.close(1008, '');
          } catch (_err) {
            // swallow — socket may already be closing
          }
          return;
        }
        authed = true;
        streamSid = msg.start.streamSid;
        log.info({ streamSid, reqId }, 'Twilio stream started');
        openaiWs = connectToOpenAI(twilioWs, streamSid, log);
        break;
      }

      case 'media':
        // Belt-and-suspenders: drop any audio that arrives before auth.
        // Twilio always sends `start` before `media` in practice, but we
        // refuse to forward audio to OpenAI until we've explicitly validated.
        if (!authed) return;
        if (openaiWs?.readyState === WebSocket.OPEN) {
          sendAudioToOpenAI(openaiWs, msg.media.payload);
        }
        break;

      case 'stop':
        log.info({ reqId }, 'Twilio stream stopped');
        openaiWs?.close();
        break;
    }
  });

  twilioWs.on('close', () => {
    log.info({ reqId }, 'Twilio WebSocket closed');
    openaiWs?.close();
  });

  twilioWs.on('error', (err) => {
    log.error({ err, reqId }, 'Twilio WebSocket error');
    openaiWs?.close();
  });
}

function connectToOpenAI(twilioWs, streamSid, log) {
  const url = `wss://api.openai.com/v1/realtime?model=${getOpenAIModel()}`;

  const ws = new WebSocket(url, {
    headers: {
      'Authorization': `Bearer ${getOpenAIKey()}`,
      'OpenAI-Beta': 'realtime=v1'
    }
  });

  ws.on('open', () => {
    log.info('Connected to OpenAI Realtime API');
    configureSession(ws);
  });

  ws.on('message', (data) => {
    const event = JSON.parse(data);
    handleOpenAIEvent(event, twilioWs, streamSid, log);
  });

  ws.on('close', () => {
    log.info('OpenAI WebSocket closed');
  });

  ws.on('error', (err) => {
    log.error({ err }, 'OpenAI WebSocket error');
  });

  return ws;
}

function configureSession(ws) {
  ws.send(JSON.stringify({
    type: 'session.update',
    session: {
      modalities: ['text', 'audio'],
      instructions: SYSTEM_PROMPT,
      voice: 'alloy',
      input_audio_format: 'g711_ulaw',
      output_audio_format: 'g711_ulaw',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      }
    }
  }));
}

function sendAudioToOpenAI(ws, base64Audio) {
  ws.send(JSON.stringify({
    type: 'input_audio_buffer.append',
    audio: base64Audio
  }));
}

function handleOpenAIEvent(event, twilioWs, streamSid, log) {
  switch (event.type) {
    case 'session.created':
      log.info('OpenAI session created');
      break;

    case 'session.updated':
      log.info('OpenAI session configured');
      break;

    case 'response.audio.delta':
      if (twilioWs.readyState === WebSocket.OPEN) {
        twilioWs.send(JSON.stringify({
          event: 'media',
          streamSid,
          media: { payload: event.delta }
        }));
      }
      break;

    case 'response.audio_transcript.delta':
      log.info({ text: event.delta }, 'Sofia says');
      break;

    case 'conversation.item.input_audio_transcription.completed':
      log.info({ text: event.transcript }, 'Caller said');
      break;

    case 'error':
      log.error({ error: event.error }, 'OpenAI error');
      break;
  }
}
