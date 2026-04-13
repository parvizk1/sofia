// Fastify preValidation hook factory for Twilio webhook signature validation.
//
// Implements Twilio's published HMAC-SHA1 algorithm manually:
//   1. Take the full request URL as Twilio sees it (reconstructed from
//      X-Forwarded-Proto / X-Forwarded-Host / Host when behind the Fly proxy).
//   2. Sort POST form parameters alphabetically by key. For duplicate keys,
//      each occurrence's value is appended in order.
//   3. Concatenate `key + value` onto the URL (no separator).
//   4. HMAC-SHA1 with TWILIO_AUTH_TOKEN as the key.
//   5. Base64-encode the digest.
//   6. Constant-time-compare against the X-Twilio-Signature header.
//
// On any failure: HTTP 403, empty body, one structured warn log. Never logs
// the signature, token, Auth Token, or raw body.
//
// Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
// Spec: /home/parviz/sofia/specs/SPEC_twilio_security.md (section 1)

import crypto from 'node:crypto';

function reconstructUrl(request) {
  const xfProto = request.headers['x-forwarded-proto'];
  const xfHost = request.headers['x-forwarded-host'];
  const host = xfHost || request.headers.host;
  const proto = xfProto || request.protocol;
  return `${proto}://${host}${request.url}`;
}

function computeSignature({ authToken, url, bodyString }) {
  const params = new URLSearchParams(bodyString || '');
  // Dedupe keys (URLSearchParams.keys() yields duplicates), then sort.
  const sortedKeys = [...new Set(params.keys())].sort();
  let payload = url;
  for (const key of sortedKeys) {
    for (const val of params.getAll(key)) {
      payload += key + val;
    }
  }
  return crypto
    .createHmac('sha1', authToken)
    .update(payload, 'utf8')
    .digest('base64');
}

function safeEqual(a, b) {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function reject({ reply, request, log, counters, reason }) {
  counters.authRejectionsTotal += 1;
  log.warn(
    {
      reqId: request.id,
      route: request.routerPath || request.url,
      reason,
      sourceIp: request.ip,
    },
    'Auth rejected'
  );
  reply.code(403).header('Content-Length', '0').send();
}

export function makeTwilioSignatureHook({ authToken, log, counters }) {
  if (!authToken || typeof authToken !== 'string') {
    // Should be caught at boot. Keep a defensive runtime guard so a misconfigured
    // deploy fails closed rather than open.
    return async (request, reply) => {
      reject({ reply, request, log, counters, reason: 'server-misconfigured' });
    };
  }

  return async (request, reply) => {
    const header = request.headers['x-twilio-signature'];
    if (!header || typeof header !== 'string') {
      return reject({ reply, request, log, counters, reason: 'no-header' });
    }
    if (typeof request.body !== 'string') {
      return reject({ reply, request, log, counters, reason: 'body-not-string' });
    }
    const url = reconstructUrl(request);
    const expected = computeSignature({
      authToken,
      url,
      bodyString: request.body,
    });
    if (!safeEqual(expected, header)) {
      return reject({ reply, request, log, counters, reason: 'bad-sig' });
    }
    // Success: fall through to route handler.
  };
}

// Exported for tests.
export const _internal = { computeSignature, reconstructUrl, safeEqual };
