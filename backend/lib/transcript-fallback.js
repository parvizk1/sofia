// Transcript fallback — when the call ended without submit_lead firing,
// run gpt-4o-mini over the transcript and SMS Parviz with [PARTIAL] tag.
// If extraction itself fails, SMS the raw transcript with [PARTIAL-RAW].
// Never silently drop a lead.
//
// Spec: SPEC_sofia_inbound_agent.md §4.

export const EXTRACTION_SYSTEM = `You are a lead-extraction parser. You will receive the transcript of a phone call between Sofia (an AI receptionist) and a prospect. Your job is to extract a structured lead summary as strict JSON. Follow this schema exactly and output JSON only, no prose:

{
  "caller_name": string | null,
  "language": "fr" | "en" | "unknown",
  "service_interest": "starter" | "pro" | "complete" | "not_sure",
  "has_website": boolean | null,
  "callback_window": "morning" | "afternoon" | "evening" | "flexible",
  "business_type": string,
  "notes": string
}

Rules:
- If a field wasn't covered in the transcript, use null (for nullable fields) or the closest default: service_interest="not_sure", callback_window="flexible", business_type="unknown", notes="Call ended before full qualification.".
- language: detect from transcript; "unknown" if too short to tell.
- notes: 1-2 short sentences summarizing what the caller wanted. Include any questions they asked. Max 400 chars.
- Output valid JSON only. No markdown fences, no commentary.`;

export function buildExtractionPrompt(transcript) {
  const lines = transcript
    .map((t) => `${t.role === 'sofia' ? 'Sofia' : 'Caller'}: ${t.text}`)
    .join('\n');
  return `Transcript:\n\n${lines}\n\nExtract the lead as JSON per the schema.`;
}

export function buildRawTranscriptSms(transcript, callState) {
  const last = callState.callerPhone ? callState.callerPhone.slice(-4) : '????';
  const lines = transcript
    .map((t) => `${t.role === 'sofia' ? 'S' : 'C'}: ${t.text}`)
    .join('\n')
    .slice(0, 1200);
  return `[PARTIAL-RAW] Sofia call ${new Date().toISOString()} caller ...${last}\nExtraction failed — raw transcript:\n${lines}`;
}

/**
 * Run the fallback pipeline.
 * @param {Array<{role:'caller'|'sofia',text:string,tMs?:number}>} transcript
 * @param {object} callState - per-call state (see relay.js)
 * @param {object} deps - { log, env, smsClient, fetchImpl?, counters? }
 * @returns {Promise<{ ok: boolean, mode: 'extract'|'raw'|'none', error?: string }>}
 */
export async function extractLeadFromTranscript(transcript, callState, deps) {
  const { log, env, smsClient, counters } = deps;
  const doFetch = deps.fetchImpl || globalThis.fetch;

  if (!Array.isArray(transcript) || transcript.length === 0) {
    log.info(
      { reqId: callState.reqId, event: 'transcript_fallback_skipped', reason: 'empty_transcript' },
      'Transcript fallback skipped: empty transcript'
    );
    return { ok: false, mode: 'none', error: 'empty_transcript' };
  }

  const userPrompt = buildExtractionPrompt(transcript);
  try {
    const resp = await doFetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 400,
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) {
      throw new Error(`openai_${resp.status}`);
    }
    const json = await resp.json();
    const content = json?.choices?.[0]?.message?.content;
    if (!content) throw new Error('empty_openai_response');
    const extracted = JSON.parse(content);
    const payload = {
      caller_name: extracted.caller_name ?? null,
      language: extracted.language || callState.language || 'unknown',
      service_interest: extracted.service_interest || 'not_sure',
      has_website: extracted.has_website ?? null,
      callback_window: extracted.callback_window || 'flexible',
      business_type: extracted.business_type || 'unknown',
      notes: extracted.notes || 'Call ended before full qualification.',
      caller_phone: callState.callerPhone,
      link_sent: callState.linkSent === true,
      partial: true,
      timestamp_iso: new Date().toISOString(),
      req_id: callState.reqId,
    };
    log.info(
      {
        reqId: callState.reqId,
        event: 'transcript_fallback_success',
        service_interest: payload.service_interest,
        callback_window: payload.callback_window,
      },
      'Partial lead extracted'
    );
    if (counters) counters.leadsPartialTotal = (counters.leadsPartialTotal || 0) + 1;
    await smsClient.sendLeadSms(payload, { partial: true });
    return { ok: true, mode: 'extract' };
  } catch (err) {
    log.error(
      { err: err.message, reqId: callState.reqId, event: 'transcript_fallback_failed' },
      'Extraction failed — falling back to raw transcript SMS'
    );
    if (counters) counters.transcriptFallbackFailuresTotal = (counters.transcriptFallbackFailuresTotal || 0) + 1;
    const rawBody = buildRawTranscriptSms(transcript, callState);
    const to = env.LEAD_NOTIFICATION_PHONE;
    if (!to) {
      log.error(
        { reqId: callState.reqId, event: 'raw_transcript_sms_failed', reason: 'no_lead_notification_phone' },
        'Cannot send raw transcript — LEAD_NOTIFICATION_PHONE missing'
      );
      return { ok: false, mode: 'raw', error: 'no_lead_notification_phone' };
    }
    try {
      const smsRes = await smsClient.sendRaw(to, rawBody);
      if (!smsRes.ok) {
        log.error(
          { reqId: callState.reqId, event: 'raw_transcript_sms_failed', error: smsRes.error },
          'Raw transcript SMS also failed'
        );
        return { ok: false, mode: 'raw', error: smsRes.error };
      }
      return { ok: true, mode: 'raw' };
    } catch (smsErr) {
      log.error(
        { err: smsErr.message, reqId: callState.reqId, event: 'raw_transcript_sms_failed' },
        'Raw transcript SMS threw'
      );
      return { ok: false, mode: 'raw', error: 'fetch_failed' };
    }
  }
}
