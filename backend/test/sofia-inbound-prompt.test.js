// Grep-assertion test on the Sofia inbound prompt.
// Fails the build if required phrases drift. Spec: SPEC_sofia_inbound_agent.md §2.

import test from 'node:test';
import assert from 'node:assert/strict';

import sofiaInbound from '../agents/sofia-inbound.js';

const prompt = sofiaInbound.instructions;

const REQUIRED_PHRASES = [
  "I'm Sofia, an AI assistant", // upfront disclosure EN
  'je suis Sofia, une assistante virtuelle', // upfront disclosure FR
  'Starter',
  'Pro',
  'Complete',
  'morning',
  'afternoon',
  'evening',
  'flexible',
  "Avant qu'on raccroche", // soft name ask
  'let me have Parviz answer that', // no-invent guardrail
  'submit_lead',
  'send_sms_link',
  'end_call',
];

for (const phrase of REQUIRED_PHRASES) {
  test(`prompt contains: ${phrase}`, () => {
    assert.ok(
      prompt.includes(phrase),
      `Sofia inbound prompt is missing required phrase: "${phrase}"`
    );
  });
}

test('prompt is loaded at module init as a non-empty string', () => {
  assert.equal(typeof prompt, 'string');
  assert.ok(prompt.length > 500, `prompt suspiciously short: ${prompt.length}`);
});

test('persona config shape', () => {
  assert.equal(sofiaInbound.voice, 'shimmer');
  assert.equal(sofiaInbound.key, 'sofia-inbound');
  assert.ok(Array.isArray(sofiaInbound.tools));
  assert.equal(sofiaInbound.tools.length, 3);
  assert.equal(typeof sofiaInbound.toolHandlers.submit_lead, 'function');
  assert.equal(typeof sofiaInbound.toolHandlers.send_sms_link, 'function');
  assert.equal(typeof sofiaInbound.toolHandlers.end_call, 'function');
  assert.equal(sofiaInbound.vad.silence_duration_ms, 600);
  assert.equal(sofiaInbound.maxResponseOutputTokens, 180);
  assert.equal(sofiaInbound.temperature, 0.7);
});
