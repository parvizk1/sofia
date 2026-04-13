// Tool registry — name → { schema, handler }.
// Personas compose their tool list from this module.
// Spec: SPEC_sofia_inbound_agent.md §1 + §3.

import { submitLeadTool, submit_lead } from './submit-lead.js';
import { sendSmsLinkTool, send_sms_link } from './send-sms-link.js';
import { endCallTool, end_call } from './end-call.js';

export const tools = [submitLeadTool, sendSmsLinkTool, endCallTool];

export const toolHandlers = {
  submit_lead,
  send_sms_link,
  end_call,
};

export { submitLeadTool, submit_lead };
export { sendSmsLinkTool, send_sms_link };
export { endCallTool, end_call };
