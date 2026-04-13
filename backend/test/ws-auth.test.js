// Tests for backend/middleware/ws-auth.js
//
// Uses node:test / node:assert — no extra deps. Spec: SPEC_twilio_security.md §2.7.
// ws-auth is a pure synchronous validator — no network, no sockets.

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateStreamAuth, _internal } from '../middleware/ws-auth.js';

const TOKEN = 'k3Jq8vR2mN7pX9wQ5tY1aB4cD6eF0gHz'; // 32 chars, fixture

function silentLog() {
  return { warn: () => {}, info: () => {}, error: () => {} };
}

test('valid token accepts', () => {
  const counters = { authRejectionsTotal: 0 };
  const res = validateStreamAuth({
    customParameters: { auth_token: TOKEN },
    expectedToken: TOKEN,
    log: silentLog(),
    counters,
    reqId: 'MZ123',
    sourceIp: '1.2.3.4',
  });
  assert.deepEqual(res, { ok: true });
  assert.equal(counters.authRejectionsTotal, 0);
});

test('undefined customParameters rejects with no-token and increments counter', () => {
  const counters = { authRejectionsTotal: 0 };
  const res = validateStreamAuth({
    customParameters: undefined,
    expectedToken: TOKEN,
    log: silentLog(),
    counters,
    reqId: 'MZ123',
    sourceIp: '1.2.3.4',
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-token');
  assert.equal(counters.authRejectionsTotal, 1);
});

test('customParameters without auth_token key rejects with no-token', () => {
  const counters = { authRejectionsTotal: 0 };
  const res = validateStreamAuth({
    customParameters: { other: 'x' },
    expectedToken: TOKEN,
    log: silentLog(),
    counters,
    reqId: 'MZ123',
    sourceIp: '1.2.3.4',
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'no-token');
  assert.equal(counters.authRejectionsTotal, 1);
});

test('wrong token (same length) rejects with bad-token', () => {
  const counters = { authRejectionsTotal: 0 };
  // Build a string of the same length as TOKEN but different content.
  const wrong = 'X'.repeat(TOKEN.length);
  const res = validateStreamAuth({
    customParameters: { auth_token: wrong },
    expectedToken: TOKEN,
    log: silentLog(),
    counters,
    reqId: 'MZ123',
    sourceIp: '1.2.3.4',
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'bad-token');
  assert.equal(counters.authRejectionsTotal, 1);
});

test('token length mismatch short-circuits to bad-token without throwing', () => {
  const counters = { authRejectionsTotal: 0 };
  const res = validateStreamAuth({
    customParameters: { auth_token: 'short' },
    expectedToken: TOKEN,
    log: silentLog(),
    counters,
    reqId: 'MZ123',
    sourceIp: '1.2.3.4',
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'bad-token');
  assert.equal(counters.authRejectionsTotal, 1);
});

test('case-insensitive key lookup (Auth_Token matches auth_token)', () => {
  const counters = { authRejectionsTotal: 0 };
  const res = validateStreamAuth({
    customParameters: { Auth_Token: TOKEN },
    expectedToken: TOKEN,
    log: silentLog(),
    counters,
    reqId: 'MZ123',
    sourceIp: '1.2.3.4',
  });
  assert.deepEqual(res, { ok: true });
  assert.equal(counters.authRejectionsTotal, 0);
});

test('missing expectedToken is server-misconfigured (defensive)', () => {
  const counters = { authRejectionsTotal: 0 };
  const res = validateStreamAuth({
    customParameters: { auth_token: TOKEN },
    expectedToken: '',
    log: silentLog(),
    counters,
    reqId: 'MZ123',
    sourceIp: '1.2.3.4',
  });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'server-misconfigured');
  assert.equal(counters.authRejectionsTotal, 1);
});

test('internal safeEqualStr: constant-time compare with length check', () => {
  assert.equal(_internal.safeEqualStr('a', 'a'), true);
  assert.equal(_internal.safeEqualStr('a', 'b'), false);
  assert.equal(_internal.safeEqualStr('a', 'aa'), false); // no throw on unequal length
  assert.equal(_internal.safeEqualStr(null, 'a'), false);
});
