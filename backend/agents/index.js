// Persona registry. Future: lookup by toNumber → client config.
// v1: hardcoded default = sofia-inbound.
// Spec: SPEC_sofia_inbound_agent.md §1 (out-of-scope §10).

import sofiaInbound from './sofia-inbound.js';

export function resolvePersona(_context) {
  // _context: { toNumber, streamSid, reqId } — unused in v1
  return sofiaInbound;
}

export { sofiaInbound };
