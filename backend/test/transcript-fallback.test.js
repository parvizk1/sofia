// Tests for the transcript-fallback extractor.
// Spec: SPEC_sofia_inbound_agent.md §9.4.

import test from 'node:test';
import assert from 'node:assert/strict';

import { extractLeadFromTranscript, EXTRACTION_SYSTEM } from '../lib/transcript-fallback.js';

function silentLog() {
  const errors = [];
  const infos = [];
  return {
    info: (obj, msg) => infos.push({ obj, msg }),
    warn: () => {},
    error: (obj, msg) => errors.push({ obj, msg }),
    _errors: errors,
    _infos: infos,
  };
}

const sampleTranscript = [
  { role: 'sofia', text: 'Hi, I am Sofia.' },
  { role: 'caller', text: 'I want the Pro plan. I run a salon in Laval.' },
  { role: 'sofia', text: 'Got it. Morning callback?' },
  { role: 'caller', text: 'Yes morning.' },
];

function callState(overrides = {}) {
  return {
    reqId: 'r1',
    callerPhone: '+15145550199',
    linkSent: false,
    language: 'en',
    ...overrides,
  };
}

test('extraction success: uses gpt-4o-mini + EXTRACTION_SYSTEM + sends partial=true SMS', async () => {
  let fetchArgs = null;
  const fetchImpl = async (url, opts) => {
    fetchArgs = { url, opts };
    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                caller_name: null,
                language: 'en',
                service_interest: 'pro',
                has_website: null,
                callback_window: 'morning',
                business_type: 'salon (Laval)',
                notes: 'Wants Pro plan, morning callback.',
              }),
            },
          },
        ],
      }),
      text: async () => '',
    };
  };
  let smsPayload = null;
  let smsOpts = null;
  const smsClient = {
    sendLeadSms: async (p, o) => {
      smsPayload = p;
      smsOpts = o;
      return { ok: true };
    },
    sendRaw: async () => ({ ok: true }),
  };
  const counters = {};
  const log = silentLog();
  const res = await extractLeadFromTranscript(sampleTranscript, callState(), {
    log,
    env: { OPENAI_API_KEY: 'k', LEAD_NOTIFICATION_PHONE: '+15145550000' },
    smsClient,
    fetchImpl,
    counters,
  });
  assert.deepEqual(res, { ok: true, mode: 'extract' });
  assert.ok(fetchArgs.url.includes('chat/completions'));
  const body = JSON.parse(fetchArgs.opts.body);
  assert.equal(body.model, 'gpt-4o-mini');
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.messages[0].role, 'system');
  assert.equal(body.messages[0].content, EXTRACTION_SYSTEM);
  assert.equal(smsPayload.partial, true);
  assert.equal(smsOpts.partial, true);
  assert.equal(smsPayload.service_interest, 'pro');
  assert.equal(smsPayload.caller_phone, '+15145550199');
  assert.equal(counters.leadsPartialTotal, 1);
});

test('extraction failure → raw transcript SMS with [PARTIAL-RAW]', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => 'oops' });
  let rawArgs = null;
  const smsClient = {
    sendLeadSms: async () => ({ ok: true }),
    sendRaw: async (to, body) => {
      rawArgs = { to, body };
      return { ok: true };
    },
  };
  const counters = {};
  const res = await extractLeadFromTranscript(sampleTranscript, callState(), {
    log: silentLog(),
    env: { OPENAI_API_KEY: 'k', LEAD_NOTIFICATION_PHONE: '+15145550000' },
    smsClient,
    fetchImpl,
    counters,
  });
  assert.equal(res.ok, true);
  assert.equal(res.mode, 'raw');
  assert.ok(rawArgs);
  assert.equal(rawArgs.to, '+15145550000');
  assert.ok(rawArgs.body.startsWith('[PARTIAL-RAW]'));
  assert.equal(counters.transcriptFallbackFailuresTotal, 1);
});

test('raw fallback also fails: two error logs, no throw', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => '' });
  const smsClient = {
    sendLeadSms: async () => ({ ok: true }),
    sendRaw: async () => ({ ok: false, error: 'twilio_500' }),
  };
  const log = silentLog();
  const res = await extractLeadFromTranscript(sampleTranscript, callState(), {
    log,
    env: { OPENAI_API_KEY: 'k', LEAD_NOTIFICATION_PHONE: '+15145550000' },
    smsClient,
    fetchImpl,
  });
  assert.equal(res.ok, false);
  assert.equal(res.mode, 'raw');
  // 2 errors: transcript_fallback_failed + raw_transcript_sms_failed
  const events = log._errors.map((e) => e.obj?.event);
  assert.ok(events.includes('transcript_fallback_failed'));
  assert.ok(events.includes('raw_transcript_sms_failed'));
});

test('empty transcript skipped (no SMS, no fetch)', async () => {
  let fetchCalls = 0;
  let smsCalls = 0;
  const fetchImpl = async () => { fetchCalls += 1; return { ok: true, json: async () => ({}) }; };
  const smsClient = {
    sendLeadSms: async () => { smsCalls += 1; return { ok: true }; },
    sendRaw: async () => { smsCalls += 1; return { ok: true }; },
  };
  const res = await extractLeadFromTranscript([], callState(), {
    log: silentLog(),
    env: { OPENAI_API_KEY: 'k', LEAD_NOTIFICATION_PHONE: '+15145550000' },
    smsClient,
    fetchImpl,
  });
  assert.equal(res.ok, false);
  assert.equal(res.mode, 'none');
  assert.equal(fetchCalls, 0);
  assert.equal(smsCalls, 0);
});
