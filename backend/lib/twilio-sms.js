// Twilio SMS client — direct REST via fetch (no twilio SDK).
//
// Exports createSmsClient({ env, log }) which returns:
//   - send({ to, body })            → low-level, returns { ok, sid?, error? }
//   - sendLeadSms(payload, opts)    → formats body via buildLeadSmsBody and posts to LEAD_NOTIFICATION_PHONE
//   - sendRaw(to, body)             → untyped passthrough for transcript fallback
//
// Never throws. Never logs the auth header, TWILIO_AUTH_TOKEN, or full account SID.
// Spec: SPEC_sofia_inbound_agent.md §6.

function maskSid(sid) {
  if (!sid || typeof sid !== 'string' || sid.length < 8) return '<invalid>';
  return sid.slice(0, 4) + '...';
}

function last4(phone) {
  if (!phone || typeof phone !== 'string') return '????';
  return phone.slice(-4);
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTimestamp(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // YYYY-MM-DD HH:mm in UTC (consistent, not locale-dependent)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function buildLeadSmsBody(payload, { partial } = {}) {
  const isPartial = partial === true || payload.partial === true;
  const ts = formatTimestamp(payload.timestamp_iso || new Date().toISOString());
  const partialSuffix = isPartial ? ' [PARTIAL]' : '';
  const name = payload.caller_name && String(payload.caller_name).trim()
    ? String(payload.caller_name).trim()
    : '(no name)';
  const phone = payload.caller_phone || '(no phone)';
  const service = payload.service_interest || 'not_sure';
  const window = payload.callback_window || 'flexible';
  let websiteSuffix = '';
  if (payload.has_website === true) websiteSuffix = ' · has website';
  else if (payload.has_website === false) websiteSuffix = ' · no website';
  const businessType = payload.business_type || 'unknown';
  const notes = payload.notes || '';
  const linkSuffix = payload.link_sent ? 'link sent ✓' : 'link not sent';
  return [
    `📞 Sofia lead · ${ts}${partialSuffix}`,
    `${name} · ${phone}`,
    `${service} · ${window}${websiteSuffix}`,
    `${businessType}`,
    `"${notes}"`,
    `${linkSuffix}`,
  ].join('\n');
}

export function createSmsClient({ env, log, counters, fetchImpl } = {}) {
  const doFetch = fetchImpl || globalThis.fetch;

  async function send({ to, body }) {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_FROM_NUMBER;
    if (!accountSid || !authToken || !from) {
      log.error(
        { event: 'sms_failed', reason: 'missing_twilio_env', accountSidMasked: maskSid(accountSid) },
        'Twilio SMS env not configured'
      );
      if (counters) counters.smsFailuresTotal += 1;
      return { ok: false, error: 'missing_twilio_env' };
    }
    if (!to || !body) {
      log.error({ event: 'sms_failed', reason: 'missing_to_or_body' }, 'Twilio SMS missing to/body');
      if (counters) counters.smsFailuresTotal += 1;
      return { ok: false, error: 'missing_to_or_body' };
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const form = new URLSearchParams({ From: from, To: to, Body: body });
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
          {
            event: 'sms_failed',
            status: resp.status,
            bodyPreview: text.slice(0, 200),
            toLast4: last4(to),
          },
          'Twilio SMS failed'
        );
        if (counters) counters.smsFailuresTotal += 1;
        return { ok: false, error: `twilio_${resp.status}` };
      }
      const json = await resp.json().catch(() => ({}));
      log.info({ event: 'sms_sent', sid: json.sid, toLast4: last4(to) }, 'SMS sent');
      return { ok: true, sid: json.sid };
    } catch (err) {
      log.error({ event: 'sms_failed', err: err.message, toLast4: last4(to) }, 'Twilio SMS threw');
      if (counters) counters.smsFailuresTotal += 1;
      return { ok: false, error: 'fetch_failed' };
    }
  }

  async function sendLeadSms(payload, opts = {}) {
    const to = env.LEAD_NOTIFICATION_PHONE;
    if (!to) {
      log.error({ event: 'sms_failed', reason: 'missing_lead_notification_phone' }, 'LEAD_NOTIFICATION_PHONE not set');
      if (counters) counters.smsFailuresTotal += 1;
      return { ok: false, error: 'missing_lead_notification_phone' };
    }
    const body = buildLeadSmsBody(payload, opts);
    return send({ to, body });
  }

  async function sendRaw(to, body) {
    return send({ to, body });
  }

  return { send, sendLeadSms, sendRaw };
}

// Exposed for tests
export const _internal = { formatTimestamp, maskSid, last4, buildLeadSmsBody };
