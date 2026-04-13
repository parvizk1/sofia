import Fastify from 'fastify';
import fastifyWebsocket from '@fastify/websocket';
import { config } from 'dotenv';
import { handleTwilioConnection } from './relay.js';
import { makeTwilioSignatureHook } from './middleware/twilio-signature.js';

config();

// ---- Boot-time secret assertions --------------------------------------------
// Hard-fail if required secrets are missing or obviously empty. See
// SPEC_twilio_security.md §1.5. `length < 16` catches placeholders like empty
// strings and obvious typos; real Twilio Auth Tokens are 32 hex chars and our
// generated stream token is ≥32 chars.
for (const key of ['TWILIO_AUTH_TOKEN', 'STREAM_AUTH_TOKEN', 'OPENAI_API_KEY']) {
  const value = process.env[key];
  if (!value || typeof value !== 'string' || value.length < 16) {
    // Pino isn't constructed yet; write a JSON line Fly's log drain will
    // still capture on stderr. Do NOT print the secret value.
    process.stderr.write(
      JSON.stringify({
        level: 'fatal',
        key,
        msg: 'Required secret missing or too short; refusing to start',
        time: new Date().toISOString(),
      }) + '\n'
    );
    process.exit(1);
  }
}

const fastify = Fastify({ logger: true, trustProxy: true });

await fastify.register(fastifyWebsocket);

fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (req, body, done) => {
  done(null, body);
});

// In-memory counters for /health reporting. Resets on process restart.
const counters = { authRejectionsTotal: 0 };

// Track WebSocket registration state + active connection count for /health.
const wsState = { registered: true, activeConnections: 0 };

// Signature hook (scoped to /twiml only — not global).
const twilioSigHook = makeTwilioSignatureHook({
  authToken: process.env.TWILIO_AUTH_TOKEN,
  log: fastify.log,
  counters,
});

fastify.get('/health', async () => ({
  status: 'ok',
  ws_registered: wsState.registered,
  active_ws_connections: wsState.activeConnections,
  metrics: {
    auth_rejections_total: counters.authRejectionsTotal,
  },
}));

// XML attribute escape — defensive; current token format (URL-safe base64)
// contains no XML special chars, but a future format change must remain safe.
function xmlAttrEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

fastify.post('/twiml', { preValidation: twilioSigHook }, async (req, reply) => {
  const xfHost = req.headers['x-forwarded-host'];
  const host = xfHost || req.headers.host;
  const xfProto = req.headers['x-forwarded-proto'];
  const protocol = xfProto === 'https' ? 'wss' : (xfProto === 'http' ? 'ws' : (host?.includes('localhost') ? 'ws' : 'wss'));
  const wsUrl = xmlAttrEscape(`${protocol}://${host}/twilio-media`);
  const token = xmlAttrEscape(process.env.STREAM_AUTH_TOKEN);

  fastify.log.info({ wsUrl }, 'Returning TwiML');

  reply.type('text/xml');
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}">
      <Parameter name="auth_token" value="${token}"/>
    </Stream>
  </Connect>
</Response>`;
});

fastify.get('/twilio-media', { websocket: true }, (socket, req) => {
  const sourceIp = req.ip;
  const reqId = req.id;
  wsState.activeConnections += 1;
  fastify.log.info({ reqId, sourceIp }, 'Twilio Media Stream connected');
  socket.on('close', () => {
    wsState.activeConnections = Math.max(0, wsState.activeConnections - 1);
  });
  handleTwilioConnection(socket, fastify.log, {
    sourceIp,
    reqId,
    counters,
    expectedToken: process.env.STREAM_AUTH_TOKEN,
  });
});

const port = process.env.PORT || 3000;
const host = '0.0.0.0';

try {
  await fastify.listen({ port, host });
  fastify.log.info(`Sofia backend listening on ${host}:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
