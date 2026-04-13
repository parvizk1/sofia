// Tests for end_call handler.
// Spec: SPEC_sofia_inbound_agent.md §9.3.

import test from 'node:test';
import assert from 'node:assert/strict';

import { end_call, _internal } from '../tools/end-call.js';
import { createCallsClient } from '../lib/twilio-calls.js';

function silentLog() {
  const errors = [];
  return {
    info: () => {},
    warn: () => {},
    error: (obj, msg) => errors.push({ obj, msg }),
    _errors: errors,
  };
}

function makeCallState() {
  let twilioClosed = false;
  let openaiClosed = false;
  return {
    state: {
      reqId: 'r1',
      callSid: 'CA123456789abcdef',
      endCallRequested: false,
      openaiResponseInFlight: false,
      twilioWs: { close: () => { twilioClosed = true; } },
      openaiWs: { close: () => { openaiClosed = true; } },
    },
    get twilioClosed() { return twilioClosed; },
    get openaiClosed() { return openaiClosed; },
  };
}

test('success: POSTs Status=completed and closes sockets', async () => {
  const harness = makeCallState();
  const fetchCalls = [];
  const fetchImpl = async (url, opts) => {
    fetchCalls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
    };
  };
  const env = { TWILIO_ACCOUNT_SID: 'AC1234567890', TWILIO_AUTH_TOKEN: 'tok' };
  const callsClient = createCallsClient({ env, log: silentLog(), fetchImpl });

  // Use internal teardown directly to avoid the setImmediate timing
  await _internal.teardown(harness.state, { log: silentLog(), callsClient });

  assert.equal(fetchCalls.length, 1);
  assert.ok(fetchCalls[0].url.includes('/Calls/CA123456789abcdef.json'));
  assert.ok(fetchCalls[0].opts.body.includes('Status=completed'));
  assert.equal(harness.twilioClosed, true);
  assert.equal(harness.openaiClosed, true);
});

test('handler returns ok immediately, schedules teardown', async () => {
  const harness = makeCallState();
  const callsClient = { completeCall: async () => ({ ok: true }) };
  const res = await end_call({}, harness.state, { log: silentLog(), callsClient });
  assert.deepEqual(res, { ok: true });
  assert.equal(harness.state.endCallRequested, true);
});

test('idempotency: second invocation no-ops', async () => {
  const harness = makeCallState();
  harness.state.endCallRequested = true;
  let completeCalls = 0;
  const callsClient = { completeCall: async () => { completeCalls += 1; return { ok: true }; } };
  const res = await end_call({}, harness.state, { log: silentLog(), callsClient });
  assert.deepEqual(res, { ok: true });
  // teardown not scheduled on duplicate
  await new Promise((r) => setImmediate(r));
  assert.equal(completeCalls, 0);
});

test('Twilio 4xx: still closes sockets', async () => {
  const harness = makeCallState();
  const fetchImpl = async () => ({
    ok: false,
    status: 400,
    json: async () => ({}),
    text: async () => 'bad',
  });
  const env = { TWILIO_ACCOUNT_SID: 'AC1234567890', TWILIO_AUTH_TOKEN: 'tok' };
  const log = silentLog();
  const callsClient = createCallsClient({ env, log, fetchImpl });
  await _internal.teardown(harness.state, { log, callsClient });
  assert.equal(harness.twilioClosed, true);
  assert.equal(harness.openaiClosed, true);
  assert.ok(log._errors.some((e) => e.obj && e.obj.event === 'twilio_end_call_failed'));
});

test('missing callSid: logs error, closes sockets', async () => {
  const harness = makeCallState();
  harness.state.callSid = null;
  let fetchCalls = 0;
  const fetchImpl = async () => { fetchCalls += 1; return { ok: true, status: 200, json: async () => ({}), text: async () => '' }; };
  const env = { TWILIO_ACCOUNT_SID: 'AC1234567890', TWILIO_AUTH_TOKEN: 'tok' };
  const log = silentLog();
  const callsClient = createCallsClient({ env, log, fetchImpl });
  await _internal.teardown(harness.state, { log, callsClient });
  // No fetch since we didn't have a callSid
  assert.equal(fetchCalls, 0);
  assert.equal(harness.twilioClosed, true);
  assert.equal(harness.openaiClosed, true);
});
