// WebSocket auth validator for the Twilio Media Stream.
//
// The token arrives as a custom parameter on Twilio's `start` event
// (delivered via <Stream><Parameter name="auth_token" value="..."/>). Pure
// validator — caller is responsible for closing the WS (code 1008, empty
// reason) on failure and incrementing the rejection counter.
//
// Spec: /home/parviz/sofia/specs/SPEC_twilio_security.md (section 2)

import crypto from 'node:crypto';

function getParam(customParameters, name) {
  if (!customParameters || typeof customParameters !== 'object') return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(customParameters)) {
    if (typeof k === 'string' && k.toLowerCase() === target) {
      return typeof v === 'string' ? v : undefined;
    }
  }
  return undefined;
}

function safeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on unequal lengths — short-circuit explicitly.
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function validateStreamAuth({
  customParameters,
  expectedToken,
  log,
  counters,
  reqId,
  sourceIp,
}) {
  if (!expectedToken || typeof expectedToken !== 'string') {
    if (log && counters) {
      counters.authRejectionsTotal += 1;
      log.warn(
        { reqId, route: '/twilio-media', reason: 'server-misconfigured', sourceIp },
        'Auth rejected'
      );
    }
    return { ok: false, reason: 'server-misconfigured' };
  }

  const token = getParam(customParameters, 'auth_token');
  if (!token) {
    if (log && counters) {
      counters.authRejectionsTotal += 1;
      log.warn(
        { reqId, route: '/twilio-media', reason: 'no-token', sourceIp },
        'Auth rejected'
      );
    }
    return { ok: false, reason: 'no-token' };
  }

  if (!safeEqualStr(token, expectedToken)) {
    if (log && counters) {
      counters.authRejectionsTotal += 1;
      log.warn(
        { reqId, route: '/twilio-media', reason: 'bad-token', sourceIp },
        'Auth rejected'
      );
    }
    return { ok: false, reason: 'bad-token' };
  }

  return { ok: true };
}

// Exported for tests.
export const _internal = { getParam, safeEqualStr };
