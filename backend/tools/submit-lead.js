// submit_lead — idempotent; fires once per call, assembles the full payload
// (server-derived caller_phone + link_sent + partial=false), and SMSes Parviz.
//
// Spec: SPEC_sofia_inbound_agent.md §3.1.

export const submitLeadTool = {
  type: 'function',
  name: 'submit_lead',
  description:
    'Submit the qualified lead to Parviz via SMS. Call EXACTLY ONCE per call, at the end after gathering the seven qualification points (soft name ask included). Never call twice. The server auto-populates caller_phone from Twilio caller ID — do not pass it.',
  parameters: {
    type: 'object',
    properties: {
      caller_name: {
        type: ['string', 'null'],
        description: 'Caller first name from the soft end-of-call ask. Null if caller declined or did not provide.',
      },
      language: {
        type: 'string',
        enum: ['fr', 'en', 'unknown'],
        description: 'Detected language of the conversation.',
      },
      service_interest: {
        type: 'string',
        enum: ['starter', 'pro', 'complete', 'not_sure'],
        description: 'Which service tier the caller expressed interest in.',
      },
      has_website: {
        type: ['boolean', 'null'],
        description: 'True if caller has an existing website, false if not, null if unknown or not asked.',
      },
      callback_window: {
        type: 'string',
        enum: ['morning', 'afternoon', 'evening', 'flexible'],
        description: 'Preferred callback window. Map "anytime"/"whenever" to flexible.',
      },
      business_type: {
        type: 'string',
        description: 'Free text: salon, clinic, dealership, café, etc. Include city if mentioned. Max 200 chars.',
      },
      notes: {
        type: 'string',
        description:
          'One or two short sentences summarizing anything notable the caller said, including questions they want Parviz to answer. Max 400 chars.',
      },
    },
    required: ['language', 'service_interest', 'callback_window', 'business_type', 'notes'],
  },
};

function truncate(s, max) {
  if (typeof s !== 'string') return '';
  return s.length <= max ? s : s.slice(0, max);
}

/**
 * @param {object} args - validated function call arguments from the model
 * @param {object} callState - per-call state
 * @param {object} deps - { log, env, smsClient, counters? }
 * @returns {Promise<{ ok: true } | { ok: true, warning: string }>}
 */
export async function submit_lead(args, callState, deps) {
  const { log, smsClient, counters } = deps;

  if (callState.leadSubmitted === true) {
    log.info(
      { reqId: callState.reqId, event: 'submit_lead_duplicate_discarded' },
      'Duplicate submit_lead invocation ignored'
    );
    return { ok: true };
  }

  const callDurationSec = Math.max(
    0,
    Math.round((Date.now() - (callState.startedAtMs || Date.now())) / 1000)
  );

  const payload = {
    caller_phone: callState.callerPhone || null,
    caller_name: args.caller_name ?? null,
    language: args.language || callState.language || 'unknown',
    service_interest: args.service_interest,
    has_website: args.has_website ?? null,
    callback_window: args.callback_window,
    business_type: truncate(args.business_type || '', 200),
    link_sent: callState.linkSent === true,
    notes: truncate(args.notes || '', 400),
    partial: false,
    timestamp_iso: new Date().toISOString(),
    call_duration_sec: callDurationSec,
    req_id: callState.reqId,
  };

  // Optionally propagate language back to callState best-effort.
  if (payload.language && payload.language !== 'unknown') {
    callState.language = payload.language;
  }

  // Mark leadSubmitted BEFORE the SMS await: a mid-flight hangup must not let
  // handleCallEnd's transcript-fallback path fire and produce a duplicate SMS.
  // The payload is preserved in logs below if Twilio fails.
  callState.leadSubmitted = true;

  let smsResult;
  try {
    smsResult = await smsClient.sendLeadSms(payload, { partial: false });
  } catch (err) {
    log.error(
      { err: err.message, reqId: callState.reqId, event: 'tool_handler_error', toolName: 'submit_lead' },
      'submit_lead SMS threw'
    );
    smsResult = { ok: false, error: 'sms_threw' };
  }

  if (smsResult && smsResult.ok) {
    log.info(
      {
        reqId: callState.reqId,
        event: 'lead_submitted',
        service_interest: payload.service_interest,
        callback_window: payload.callback_window,
        partial: false,
      },
      'Lead submitted'
    );
    if (counters) counters.leadsSubmittedTotal = (counters.leadsSubmittedTotal || 0) + 1;
    return { ok: true };
  }

  // SMS failed. Log full payload so operator can recover by hand.
  log.error(
    {
      reqId: callState.reqId,
      event: 'sms_failed',
      error: smsResult ? smsResult.error : 'unknown',
      payload: { ...payload, caller_phone_last4: payload.caller_phone ? payload.caller_phone.slice(-4) : null },
    },
    'submit_lead SMS failed — lead preserved in logs'
  );
  return { ok: true, warning: 'sms_failed_logged' };
}
