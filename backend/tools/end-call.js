// end_call — gracefully hang up via Twilio REST Status=completed.
// Waits for final audio to flush, then closes local sockets.
//
// Spec: SPEC_sofia_inbound_agent.md §3.3.

export const endCallTool = {
  type: 'function',
  name: 'end_call',
  description:
    'End the phone call gracefully. Call only AFTER saying goodbye AND after submit_lead has returned. Never call mid-conversation.',
  parameters: { type: 'object', properties: {}, required: [] },
};

const FLUSH_DELAY_MS = 500;

/**
 * @param {object} _args
 * @param {object} callState - must have callSid, twilioWs, openaiWs, responseInFlightWaiters
 * @param {object} deps - { log, callsClient }
 */
export async function end_call(_args, callState, deps) {
  const { log, callsClient } = deps;

  if (callState.endCallRequested === true) {
    return { ok: true };
  }
  callState.endCallRequested = true;
  log.info({ reqId: callState.reqId, event: 'tool_fired', toolName: 'end_call' }, 'end_call invoked');

  // Fire-and-forget teardown so the model's tool output returns promptly.
  setImmediate(() => {
    teardown(callState, deps).catch((err) => {
      log.error(
        { err: err.message, reqId: callState.reqId, event: 'twilio_end_call_failed' },
        'Teardown threw'
      );
    });
  });

  return { ok: true };
}

async function teardown(callState, deps) {
  const { log, callsClient } = deps;

  // Wait for OpenAI to finish its current response (if any), then explicitly
  // cancel any further generation so a late `response.created` cannot start
  // a new audio burst inside the FLUSH_DELAY_MS window. Without this, a new
  // response that begins between waitForResponseDone() resolving and the
  // Twilio Status=completed call would be cut off mid-utterance.
  await waitForResponseDone(callState, 3000);
  try {
    if (callState.openaiWs && callState.openaiWs.readyState === 1) {
      callState.openaiWs.send(JSON.stringify({ type: 'response.cancel' }));
    }
  } catch (_err) {
    // swallow — best-effort cancellation
  }
  await sleep(FLUSH_DELAY_MS);

  if (!callState.callSid) {
    log.error(
      { reqId: callState.reqId, event: 'twilio_end_call_failed', reason: 'missing_call_sid' },
      'Cannot complete call — no callSid captured from Twilio start event'
    );
  } else {
    await callsClient.completeCall(callState.callSid);
  }

  // Close local sockets regardless of Twilio REST outcome — Twilio will
  // time out on its side within ~30s if the API call failed.
  try {
    callState.openaiWs?.close();
  } catch (_err) {
    // swallow
  }
  try {
    callState.twilioWs?.close();
  } catch (_err) {
    // swallow
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForResponseDone(callState, timeoutMs) {
  return new Promise((resolve) => {
    if (!callState.openaiResponseInFlight) return resolve();
    const timer = setTimeout(() => {
      callState.onResponseDone = null;
      resolve();
    }, timeoutMs);
    callState.onResponseDone = () => {
      clearTimeout(timer);
      callState.onResponseDone = null;
      resolve();
    };
  });
}

// Exposed for tests
export const _internal = { teardown, waitForResponseDone, sleep, FLUSH_DELAY_MS };
