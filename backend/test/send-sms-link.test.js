// Tests for send_sms_link handler.
// Spec: SPEC_sofia_inbound_agent.md §9.2.

import test from 'node:test';
import assert from 'node:assert/strict';

import { send_sms_link } from '../tools/send-sms-link.js';

function silentLog() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

test('success (EN) sends English body to caller phone', async () => {
  const state = { reqId: 'r1', callerPhone: '+15145550199', language: 'en', linkSent: false };
  let captured = null;
  const smsClient = {
    send: async (args) => {
      captured = args;
      return { ok: true, sid: 'SM2' };
    },
  };
  const res = await send_sms_link({}, state, { log: silentLog(), smsClient });
  assert.deepEqual(res, { ok: true });
  assert.equal(captured.to, '+15145550199');
  assert.ok(captured.body.includes('callsofia.ca'));
  assert.ok(/Here's the link/.test(captured.body));
  assert.equal(state.linkSent, true);
});

test('success (FR) sends French body', async () => {
  const state = { reqId: 'r1', callerPhone: '+15145550199', language: 'fr', linkSent: false };
  let captured = null;
  const smsClient = {
    send: async (args) => {
      captured = args;
      return { ok: true };
    },
  };
  await send_sms_link({}, state, { log: silentLog(), smsClient });
  assert.ok(/Voici le lien/.test(captured.body));
});

test('idempotency: returns already_sent without calling smsClient', async () => {
  const state = { reqId: 'r1', callerPhone: '+15145550199', language: 'en', linkSent: true };
  let called = 0;
  const smsClient = {
    send: async () => {
      called += 1;
      return { ok: true };
    },
  };
  const res = await send_sms_link({}, state, { log: silentLog(), smsClient });
  assert.deepEqual(res, { ok: true, note: 'already_sent' });
  assert.equal(called, 0);
});

test('missing callerPhone returns no_caller_phone', async () => {
  const state = { reqId: 'r1', callerPhone: null, language: 'en', linkSent: false };
  const smsClient = { send: async () => ({ ok: true }) };
  const res = await send_sms_link({}, state, { log: silentLog(), smsClient });
  assert.deepEqual(res, { ok: false, error: 'no_caller_phone' });
});

test('SMS failure returns sms_failed', async () => {
  const state = { reqId: 'r1', callerPhone: '+15145550199', language: 'en', linkSent: false };
  const smsClient = { send: async () => ({ ok: false, error: 'twilio_500' }) };
  const res = await send_sms_link({}, state, { log: silentLog(), smsClient });
  assert.deepEqual(res, { ok: false, error: 'sms_failed' });
  assert.equal(state.linkSent, false);
});

test('unknown language defaults to EN', async () => {
  const state = { reqId: 'r1', callerPhone: '+15145550199', language: 'unknown', linkSent: false };
  let captured = null;
  const smsClient = {
    send: async (args) => {
      captured = args;
      return { ok: true };
    },
  };
  await send_sms_link({}, state, { log: silentLog(), smsClient });
  assert.ok(/Here's the link/.test(captured.body));
});
