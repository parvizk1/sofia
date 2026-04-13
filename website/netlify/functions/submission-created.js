/**
 * Netlify Function: submission-created
 *
 * Triggered automatically by Netlify Forms when a `lead-capture` form
 * submission is received. Routes Pro and Complete leads to SMS via the
 * Twilio REST API (no SDK dependency — direct fetch).
 *
 * Starter and "unsure" leads stay in the default Netlify email inbox
 * and trigger no SMS.
 *
 * Required env vars (configured in Netlify dashboard, mirrored in .env.example):
 *   - TWILIO_ACCOUNT_SID
 *   - TWILIO_AUTH_TOKEN
 *   - TWILIO_FROM_NUMBER       (e.g. +18737360217 — the number SMS is sent FROM)
 *   - LEAD_NOTIFICATION_PHONE  (e.g. +18737360217 — destination for Pro/Complete leads)
 *
 * Failure mode: any Twilio error or missing config logs and returns 200 so
 * Netlify does not retry-storm the function. The lead is still captured
 * in the Netlify Forms UI regardless.
 */

const HIGH_VALUE_BUNDLES = new Set(['pro', 'complete']);

exports.handler = async function (event) {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}').payload || {};
  } catch (err) {
    console.error('submission-created: failed to parse payload', { err: err.message });
    return { statusCode: 200, body: 'ignored: bad payload' };
  }

  const formName = payload.form_name;
  if (formName !== 'lead-capture') {
    return { statusCode: 200, body: `ignored: form=${formName}` };
  }

  const data = payload.data || {};
  const bundle = (data.bundle || '').toLowerCase().trim();

  if (!HIGH_VALUE_BUNDLES.has(bundle)) {
    console.log('submission-created: low-priority bundle, no SMS sent', { bundle });
    return { statusCode: 200, body: `ok: bundle=${bundle || 'unset'} (no SMS)` };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const toNumber = process.env.LEAD_NOTIFICATION_PHONE;

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.error('submission-created: missing Twilio config', {
      hasSid: !!accountSid,
      hasToken: !!authToken,
      hasFrom: !!fromNumber,
      hasTo: !!toNumber
    });
    return { statusCode: 200, body: 'ok: SMS skipped (missing config)' };
  }

  const lang = (data.lang || 'fr').toLowerCase();
  const name = data.name || '(no name)';
  const business = data.business || '(no business)';
  const phone = data.phone || '(no phone)';
  const email = data.email || '(no email)';
  const message = (data.message || '').trim();

  const bundleLabel = bundle.toUpperCase();
  const header = lang === 'en'
    ? `Sofia lead — ${bundleLabel}`
    : `Lead Sofia — ${bundleLabel}`;

  const smsBody = [
    header,
    `${name} / ${business}`,
    `${phone}`,
    `${email}`,
    message ? `Note: ${message.slice(0, 200)}` : null
  ].filter(Boolean).join('\n');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const body = new URLSearchParams({
    To: toNumber,
    From: fromNumber,
    Body: smsBody
  });
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString(),
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('submission-created: Twilio non-2xx', { status: res.status, text });
      return { statusCode: 200, body: 'ok: SMS attempted (Twilio error logged)' };
    }

    const json = await res.json();
    console.log('submission-created: SMS sent', { sid: json.sid, bundle, to: toNumber });
    return { statusCode: 200, body: `ok: SMS sent sid=${json.sid}` };
  } catch (err) {
    console.error('submission-created: fetch failed', { err: err.message });
    return { statusCode: 200, body: 'ok: SMS attempted (fetch error logged)' };
  }
};
