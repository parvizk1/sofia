// Transcript-assembly correctness test.
// Feeds fake OpenAI events through handleOpenAIEvent and asserts both caller
// and sofia turns accumulate on callState.transcript.
// Designer flagged this as silently-droppable: if either role mis-wires,
// the transcript-fallback extractor runs on empty array and loses leads.

import test from 'node:test';
import assert from 'node:assert/strict';

import { _internal } from '../relay.js';

const { handleOpenAIEvent } = _internal;

function makeCallState() {
  return {
    reqId: 'r1',
    startedAtMs: Date.now(),
    transcript: [],
    openaiResponseInFlight: false,
    fillerTimer: null,
    fillerInterval: null,
    fillerPlaying: false,
    streamSid: 'MZ1',
    // These need readyState to match ws.OPEN (1). Stub with send no-op.
    twilioWs: { readyState: 0, send: () => {} },
    openaiWs: { readyState: 0, send: () => {} },
    persona: { toolHandlers: {} },
    _sofiaAudioBuffers: new Map(),
  };
}

function silentLog() {
  return { info: () => {}, warn: () => {}, error: () => {} };
}

test('caller turns accumulate from input_audio_transcription.completed', () => {
  const state = makeCallState();
  const log = silentLog();
  handleOpenAIEvent(
    {
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'Hi, I want the Pro plan.',
    },
    state,
    log
  );
  handleOpenAIEvent(
    {
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'Morning callback please.',
    },
    state,
    log
  );
  assert.equal(state.transcript.length, 2);
  assert.equal(state.transcript[0].role, 'caller');
  assert.equal(state.transcript[0].text, 'Hi, I want the Pro plan.');
  assert.equal(state.transcript[1].role, 'caller');
});

test('sofia turns accumulate from audio_transcript.delta + done', () => {
  const state = makeCallState();
  const log = silentLog();
  handleOpenAIEvent(
    { type: 'response.audio_transcript.delta', response_id: 'resp1', delta: 'Hi, ' },
    state,
    log
  );
  handleOpenAIEvent(
    { type: 'response.audio_transcript.delta', response_id: 'resp1', delta: 'I am Sofia.' },
    state,
    log
  );
  handleOpenAIEvent(
    { type: 'response.audio_transcript.done', response_id: 'resp1' },
    state,
    log
  );
  assert.equal(state.transcript.length, 1);
  assert.equal(state.transcript[0].role, 'sofia');
  assert.equal(state.transcript[0].text, 'Hi, I am Sofia.');
});

test('sofia turns accept direct transcript on .done event (no deltas needed)', () => {
  const state = makeCallState();
  const log = silentLog();
  handleOpenAIEvent(
    {
      type: 'response.audio_transcript.done',
      response_id: 'resp2',
      transcript: 'Goodbye.',
    },
    state,
    log
  );
  assert.equal(state.transcript.length, 1);
  assert.equal(state.transcript[0].role, 'sofia');
  assert.equal(state.transcript[0].text, 'Goodbye.');
});

test('interleaved caller + sofia produces correctly-ordered transcript', () => {
  const state = makeCallState();
  const log = silentLog();
  handleOpenAIEvent(
    { type: 'response.audio_transcript.done', response_id: 'r1', transcript: 'Hi I am Sofia.' },
    state,
    log
  );
  handleOpenAIEvent(
    { type: 'conversation.item.input_audio_transcription.completed', transcript: 'Hello.' },
    state,
    log
  );
  handleOpenAIEvent(
    { type: 'response.audio_transcript.done', response_id: 'r2', transcript: 'How can I help?' },
    state,
    log
  );
  assert.equal(state.transcript.length, 3);
  assert.equal(state.transcript[0].role, 'sofia');
  assert.equal(state.transcript[1].role, 'caller');
  assert.equal(state.transcript[2].role, 'sofia');
});

test('empty transcripts are not pushed (whitespace/null)', () => {
  const state = makeCallState();
  const log = silentLog();
  handleOpenAIEvent(
    { type: 'conversation.item.input_audio_transcription.completed', transcript: '' },
    state,
    log
  );
  handleOpenAIEvent(
    { type: 'conversation.item.input_audio_transcription.completed', transcript: '   ' },
    state,
    log
  );
  handleOpenAIEvent(
    { type: 'response.audio_transcript.done', response_id: 'r1', transcript: '' },
    state,
    log
  );
  assert.equal(state.transcript.length, 0);
});

test('response.created / response.done toggle openaiResponseInFlight', () => {
  const state = makeCallState();
  const log = silentLog();
  assert.equal(state.openaiResponseInFlight, false);
  handleOpenAIEvent({ type: 'response.created' }, state, log);
  assert.equal(state.openaiResponseInFlight, true);
  handleOpenAIEvent({ type: 'response.done' }, state, log);
  assert.equal(state.openaiResponseInFlight, false);
});

test('response.done fires onResponseDone one-shot', () => {
  const state = makeCallState();
  state.openaiResponseInFlight = true;
  let fired = 0;
  state.onResponseDone = () => { fired += 1; };
  handleOpenAIEvent({ type: 'response.done' }, state, silentLog());
  assert.equal(fired, 1);
});
