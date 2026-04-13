// Tests for submit_lead handler.
// Spec: SPEC_sofia_inbound_agent.md §9.1.

import test from 'node:test';
import assert from 'node:assert/strict';

import { submit_lead } from '../tools/submit-lead.js';

function silentLog() {
  const calls = { info: [], warn: [], error: [] };
  return {
    info: (obj, msg) => calls.info.push({ obj, msg }),
    warn: (obj, msg) => calls.warn.push({ obj, msg }),
    error: (obj, msg) => calls.error.push({ obj, msg }),
    _calls: calls,
  };
}

function baseState() {
  return {
    reqId: 'req-test',
    startedAtMs: Date.now() - 60000,
    callerPhone: '+15145550199',
    linkSent: false,
    leadSubmitted: false,
    language: 'en',
  };
}

function baseArgs() {
  return {
    caller_name: 'Martin',
    language: 'en',
    service_interest: 'pro',
    has_website: true,
    callback_window: 'morning',
    business_type: 'salon (Laval)',
    notes: 'Wants to replace voicemail.',
  };
}

test('success path: sends SMS and marks leadSubmitted', async () => {
  const state = baseState();
  const args = baseArgs();
  let smsArgs = null;
  const smsClient = {
    sendLeadSms: async (payload, opts) => {
      smsArgs = { payload, opts };
      return { ok: true, sid: 'SM1' };
    },
  };
  const counters = { leadsSubmittedTotal: 0 };
  const log = silentLog();
  const res = await submit_lead(args, state, { log, smsClient, counters });
  assert.deepEqual(res, { ok: true });
  assert.equal(state.leadSubmitted, true);
  assert.equal(counters.leadsSubmittedTotal, 1);
  assert.ok(smsArgs);
  assert.equal(smsArgs.opts.partial, false);
  assert.equal(smsArgs.payload.partial, false);
  assert.equal(smsArgs.payload.caller_phone, '+15145550199');
  assert.equal(smsArgs.payload.link_sent, false);
  assert.equal(smsArgs.payload.req_id, 'req-test');
  assert.ok(typeof smsArgs.payload.timestamp_iso === 'string');
  assert.equal(smsArgs.payload.service_interest, 'pro');
});

test('idempotency: second invocation is no-op, no SMS sent', async () => {
  const state = baseState();
  state.leadSubmitted = true;
  let smsCalls = 0;
  const smsClient = {
    sendLeadSms: async () => {
      smsCalls += 1;
      return { ok: true };
    },
  };
  const log = silentLog();
  const res = await submit_lead(baseArgs(), state, { log, smsClient });
  assert.deepEqual(res, { ok: true });
  assert.equal(smsCalls, 0);
});

test('SMS failure: returns ok with warning, marks leadSubmitted anyway', async () => {
  const state = baseState();
  const smsClient = {
    sendLeadSms: async () => ({ ok: false, error: 'twilio_500' }),
  };
  const log = silentLog();
  const res = await submit_lead(baseArgs(), state, { log, smsClient });
  assert.equal(res.ok, true);
  assert.equal(res.warning, 'sms_failed_logged');
  assert.equal(state.leadSubmitted, true);
  assert.ok(
    log._calls.error.some((e) => e.obj && e.obj.event === 'sms_failed'),
    'error log with event=sms_failed missing'
  );
});

test('payload propagates link_sent from callState', async () => {
  const state = baseState();
  state.linkSent = true;
  let smsArgs = null;
  const smsClient = {
    sendLeadSms: async (payload) => {
      smsArgs = payload;
      return { ok: true };
    },
  };
  await submit_lead(baseArgs(), state, { log: silentLog(), smsClient });
  assert.equal(smsArgs.link_sent, true);
});

test('truncates overly long business_type / notes', async () => {
  const state = baseState();
  const args = baseArgs();
  args.business_type = 'x'.repeat(250);
  args.notes = 'y'.repeat(500);
  let smsArgs = null;
  const smsClient = {
    sendLeadSms: async (payload) => {
      smsArgs = payload;
      return { ok: true };
    },
  };
  await submit_lead(args, state, { log: silentLog(), smsClient });
  assert.equal(smsArgs.business_type.length, 200);
  assert.equal(smsArgs.notes.length, 400);
});
