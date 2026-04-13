// Twilio Calls client — direct REST via fetch.
//
// Exports createCallsClient({ env, log, fetchImpl? }) with:
//   - completeCall(callSid) → POST …/Calls/{CallSid}.json with Status=completed
//
// Spec: SPEC_sofia_inbound_agent.md §3.3 + §1 (end_call).

export function createCallsClient({ env, log, fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;

  async function completeCall(callSid) {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      log.error({ event: 'twilio_end_call_failed', reason: 'missing_twilio_env' }, 'Twilio env not set');
      return { ok: false, error: 'missing_twilio_env' };
    }
    if (!callSid) {
      log.error({ event: 'twilio_end_call_failed', reason: 'missing_call_sid' }, 'missing callSid');
      return { ok: false, error: 'missing_call_sid' };
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const form = new URLSearchParams({ Status: 'completed' });
    try {
      const resp = await doFetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        log.error(
          { event: 'twilio_end_call_failed', status: resp.status, bodyPreview: text.slice(0, 200) },
          'Twilio complete-call failed'
        );
        return { ok: false, error: `twilio_${resp.status}` };
      }
      log.info({ event: 'twilio_call_completed', callSidMasked: callSid.slice(0, 6) + '...' }, 'Call completed');
      return { ok: true };
    } catch (err) {
      log.error({ event: 'twilio_end_call_failed', err: err.message }, 'Twilio complete-call threw');
      return { ok: false, error: 'fetch_failed' };
    }
  }

  return { completeCall };
}
