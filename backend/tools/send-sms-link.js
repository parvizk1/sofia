// send_sms_link — text the caller the callsofia.ca link.
// Idempotent. No arguments from the model — server owns the recipient number.
//
// Spec: SPEC_sofia_inbound_agent.md §3.2.

export const sendSmsLinkTool = {
  type: 'function',
  name: 'send_sms_link',
  description:
    'Text the caller the callsofia.ca link. Call only when the caller says yes to the SMS offer. The server uses the Twilio caller ID — no arguments needed.',
  parameters: { type: 'object', properties: {}, required: [] },
};

const BODIES = {
  fr: 'Voici le lien : https://callsofia.ca — Parviz vous rappelle bientôt. -Sofia',
  en: "Here's the link: https://callsofia.ca — Parviz will call you back soon. -Sofia",
};

/**
 * @param {object} _args - unused (schema has no properties)
 * @param {object} callState
 * @param {object} deps - { log, smsClient }
 */
export async function send_sms_link(_args, callState, deps) {
  const { log, smsClient } = deps;

  if (!callState.callerPhone) {
    log.error(
      { reqId: callState.reqId, event: 'tool_handler_error', toolName: 'send_sms_link', reason: 'no_caller_phone' },
      'send_sms_link: no caller phone'
    );
    return { ok: false, error: 'no_caller_phone' };
  }

  if (callState.linkSent === true) {
    log.info(
      { reqId: callState.reqId, event: 'send_sms_link_already_sent' },
      'send_sms_link: already sent'
    );
    return { ok: true, note: 'already_sent' };
  }

  const lang = callState.language === 'fr' ? 'fr' : 'en';
  const body = BODIES[lang];

  let smsResult;
  try {
    smsResult = await smsClient.send({ to: callState.callerPhone, body });
  } catch (err) {
    log.error(
      { err: err.message, reqId: callState.reqId, event: 'tool_handler_error', toolName: 'send_sms_link' },
      'send_sms_link threw'
    );
    return { ok: false, error: 'sms_failed' };
  }

  if (!smsResult || !smsResult.ok) {
    log.error(
      { reqId: callState.reqId, event: 'sms_failed', error: smsResult ? smsResult.error : 'unknown' },
      'send_sms_link SMS failed'
    );
    return { ok: false, error: 'sms_failed' };
  }

  callState.linkSent = true;
  log.info({ reqId: callState.reqId, event: 'link_sent', lang }, 'SMS link sent');
  return { ok: true };
}
