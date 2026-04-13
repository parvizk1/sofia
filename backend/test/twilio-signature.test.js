// Tests for backend/middleware/twilio-signature.js
//
// Uses node:test / node:assert — no Jest, no Mocha, no extra deps.
// Spec: /home/parviz/sofia/specs/SPEC_twilio_security.md §1.7
//
// Strategy: we exercise the middleware via `fastify.inject()` so we get the
// real Fastify hook lifecycle (body parsing, request id, ip, etc.) without
// binding a port. No network calls.

import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import Fastify from 'fastify';
import { makeTwilioSignatureHook, _internal } from '../middleware/twilio-signature.js';

const AUTH_TOKEN = 'test_token_0123456789abcdef'; // fixture, not a real secret

function buildSignature({ authToken, url, body }) {
  return _internal.computeSignature({ authToken, url, bodyString: body });
}

function buildApp({ counters }) {
  const app = Fastify({ logger: false, trustProxy: true });
  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (req, body, done) => done(null, body)
  );
  const hook = makeTwilioSignatureHook({
    authToken: AUTH_TOKEN,
    log: { warn: () => {}, info: () => {}, error: () => {} },
    counters,
  });
  app.post('/twiml', { preValidation: hook }, async () => ({ ok: true }));
  return app;
}

test('valid signature passes and invokes handler', async () => {
  const counters = { authRejectionsTotal: 0 };
  const app = buildApp({ counters });
  const body = 'CallSid=CA123&From=%2B15551234567&To=%2B18737360217';
  // Simulate: request arrives on the public Fly hostname over HTTPS.
  const url = 'https://sofia-backend.fly.dev/twiml';
  const sig = buildSignature({ authToken: AUTH_TOKEN, url, body });

  const res = await app.inject({
    method: 'POST',
    url: '/twiml',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'sofia-backend.fly.dev',
      host: 'sofia-backend.fly.dev',
      'x-twilio-signature': sig,
    },
    payload: body,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).ok, true);
  assert.equal(counters.authRejectionsTotal, 0);
  await app.close();
});

test('invalid signature returns 403 empty body and increments counter', async () => {
  const counters = { authRejectionsTotal: 0 };
  const app = buildApp({ counters });
  const body = 'CallSid=CA123';
  const url = 'https://sofia-backend.fly.dev/twiml';
  const sig = buildSignature({ authToken: AUTH_TOKEN, url, body });
  // Tamper one character.
  const tampered = sig[0] === 'A' ? 'B' + sig.slice(1) : 'A' + sig.slice(1);

  const res = await app.inject({
    method: 'POST',
    url: '/twiml',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'sofia-backend.fly.dev',
      host: 'sofia-backend.fly.dev',
      'x-twilio-signature': tampered,
    },
    payload: body,
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body, '');
  assert.equal(counters.authRejectionsTotal, 1);
  await app.close();
});

test('missing X-Twilio-Signature header returns 403', async () => {
  const counters = { authRejectionsTotal: 0 };
  const app = buildApp({ counters });
  const body = 'CallSid=CA123';

  const res = await app.inject({
    method: 'POST',
    url: '/twiml',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-proto': 'https',
      host: 'sofia-backend.fly.dev',
    },
    payload: body,
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body, '');
  assert.equal(counters.authRejectionsTotal, 1);
  await app.close();
});

test('X-Forwarded-Proto drives URL reconstruction (http-signed rejected when XFP=https)', async () => {
  const counters = { authRejectionsTotal: 0 };
  const app = buildApp({ counters });
  const body = 'CallSid=CA123';
  // Attacker computes signature over http:// even though request arrives via https proxy.
  const httpUrl = 'http://sofia-backend.fly.dev/twiml';
  const sig = buildSignature({ authToken: AUTH_TOKEN, url: httpUrl, body });

  const res = await app.inject({
    method: 'POST',
    url: '/twiml',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'sofia-backend.fly.dev',
      host: 'sofia-backend.fly.dev',
      'x-twilio-signature': sig,
    },
    payload: body,
  });

  assert.equal(res.statusCode, 403);
  assert.equal(counters.authRejectionsTotal, 1);
  await app.close();
});

test('duplicate param keys: getAll loop produces signature Twilio accepts', async () => {
  const counters = { authRejectionsTotal: 0 };
  const app = buildApp({ counters });
  // Two values for `Digit`, one for `CallSid`.
  const body = 'CallSid=CA123&Digit=1&Digit=2';
  const url = 'https://sofia-backend.fly.dev/twiml';
  const sig = buildSignature({ authToken: AUTH_TOKEN, url, body });

  const res = await app.inject({
    method: 'POST',
    url: '/twiml',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'sofia-backend.fly.dev',
      host: 'sofia-backend.fly.dev',
      'x-twilio-signature': sig,
    },
    payload: body,
  });

  assert.equal(res.statusCode, 200);
  assert.equal(counters.authRejectionsTotal, 0);
  await app.close();
});

test('computeSignature: alphabetical key order, key+value concat, base64 output', () => {
  // Locked-down unit test of the internal signer against a known fixture.
  // Reference: Twilio algorithm — we reproduce its output byte-for-byte.
  const url = 'https://example.com/twiml';
  const body = 'B=two&A=one';
  const expected = crypto
    .createHmac('sha1', AUTH_TOKEN)
    .update(url + 'A' + 'one' + 'B' + 'two', 'utf8')
    .digest('base64');
  const got = _internal.computeSignature({ authToken: AUTH_TOKEN, url, bodyString: body });
  assert.equal(got, expected);
});

test('safeEqual: unequal lengths short-circuit to false without throwing', () => {
  assert.equal(_internal.safeEqual('abc', 'abcd'), false);
  assert.equal(_internal.safeEqual('abc', 'abc'), true);
  assert.equal(_internal.safeEqual('abc', 'abd'), false);
});
