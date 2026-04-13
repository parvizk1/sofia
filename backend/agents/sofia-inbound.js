// Sofia inbound qualification persona.
// Spec: SPEC_sofia_inbound_agent.md §1.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { tools, toolHandlers } from '../tools/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read the prompt ONCE at module init. Not re-read per call.
const instructions = readFileSync(
  join(__dirname, '../prompts/sofia-inbound.md'),
  'utf8'
);

const sofiaInbound = {
  key: 'sofia-inbound',
  model: process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview',
  voice: 'shimmer',
  instructions,
  tools,
  toolHandlers,
  audioFormats: { input: 'g711_ulaw', output: 'g711_ulaw' },
  vad: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 600 },
  maxCallSeconds: 360,
  maxResponseOutputTokens: 180,
  temperature: 0.7,
  metadata: { phoneNumber: '+18737360217', businessId: null },
};

export default sofiaInbound;
