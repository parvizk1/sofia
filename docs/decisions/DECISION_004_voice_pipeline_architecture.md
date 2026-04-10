DECISION #4 — Voice Pipeline: Build Custom Sequential vs OpenAI Realtime API
Status: RESOLVED — Option 2 (OpenAI Realtime API with native Twilio SIP integration)

Context: The blueprint proposes a custom sequential pipeline (Twilio -> Whisper -> Claude -> ElevenLabs) with 3.5-4.5s latency masked by filler phrases. Since the blueprint was written, OpenAI's Realtime API has matured significantly: it now supports SIP integration with Twilio, tool calling, and achieves ~200ms response latency at ~$0.04/min. This is a fundamentally different architecture that eliminates the STT/TTS hops entirely. The cost tradeoff is real: custom pipeline ~$0.05/min vs Realtime API ~$0.04/min, but the latency difference (3.5s vs 0.2s) is the difference between "please hold" and a real conversation.

Options:
  1. Custom sequential pipeline (Whisper + Claude + ElevenLabs) — Full control over each component, uses Claude as the brain (smarter than GPT-4o-mini for complex booking logic), known costs. | Tradeoff: 3.5-4.5s latency per turn is noticeable. Filler phrases are a band-aid. 4 API calls per turn = 4 failure points. But you keep Claude, which matters for nuanced bilingual booking conversations.
  2. OpenAI Realtime API (gpt-realtime or gpt-realtime-mini) — Sub-200ms latency, native Twilio SIP integration, single API call per turn, built-in tool calling. | Tradeoff: ~$0.04/min ($24/client/month at 200 calls x 3 min). Replaces Claude with GPT-4o for reasoning. French Canadian quality unknown. Vendor lock-in to OpenAI for the entire voice layer. Less control over individual components.
  3. Custom pipeline for MVP, evaluate Realtime API for v2 — Ship the thing you understand now, benchmark Realtime API in parallel. | Tradeoff: You eat the latency penalty for v1 but don't block on learning a new paradigm. Risk: if Realtime API is clearly better, you've built throwaway code.

Architect recommendation: Option 1 (Custom sequential pipeline)
Simpler to understand, debug, and teach. Claude is the better brain.

Devil's Advocate recommendation: Option 3, but with a hard evaluation deadline
The custom pipeline is fine for MVP if you accept the latency. But OpenAI Realtime API with Twilio SIP is now production-ready and the latency advantage is massive. Set a 2-week deadline after MVP launch to benchmark it. If you skip this evaluation entirely, you risk building a product that feels sluggish compared to competitors who ship Realtime API agents.

Your call (reply with a number):
