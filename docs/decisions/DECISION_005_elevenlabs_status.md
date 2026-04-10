DECISION #5 — ElevenLabs Status: Keep, Drop, or Defer Given Realtime API
Status: RESOLVED — Option 1 (Drop ElevenLabs, use Realtime API built-in voices)

Context: DECISION #2 chose ElevenLabs for TTS (voice quality is the product). DECISION #4 then chose the OpenAI Realtime API, which has built-in TTS with sub-200ms latency. These two decisions conflict: the Realtime API's native voice output eliminates the need for a separate TTS provider. Using ElevenLabs would require intercepting the Realtime API's text output, routing it to ElevenLabs, and streaming that audio back to Twilio — re-introducing the latency that DECISION #4 was chosen to eliminate.

Options:
  1. Drop ElevenLabs, use Realtime API built-in voices — The Realtime API generates speech natively as part of the same model inference. Zero additional latency. One fewer vendor. One fewer API key. Simpler architecture. The built-in voices are good (not ElevenLabs-tier, but solid). | Tradeoff: You lose ElevenLabs' superior Quebec French voices (Thomas, Amelie). The Realtime API voices may sound slightly less natural for French Canadian. But you gain ~3 seconds of latency reduction per turn. Test the built-in voices before deciding this is a problem.

  2. Keep ElevenLabs as an override layer — Use the Realtime API in text-only output mode, intercept the text responses, send them to ElevenLabs for speech synthesis, stream that audio back to Twilio via Media Streams. | Tradeoff: You keep the best voice quality but re-introduce 500-1500ms of TTS latency per turn, add architectural complexity (text extraction + ElevenLabs streaming + audio injection), add ~$10/client/month in TTS costs, and partially negate the reason you chose the Realtime API. You are essentially rebuilding the custom pipeline with extra steps.

  3. Drop ElevenLabs for MVP, evaluate after launch — Ship with Realtime API built-in voices. If clients or callers complain about voice quality (especially French Canadian), then invest in the ElevenLabs override layer for v2. | Tradeoff: Fastest path to launch. You avoid premature optimization. But if the voices are bad, early clients hear it. Mitigation: test the French Canadian voice quality yourself before any client goes live.

Architect recommendation: Option 3 (Drop for MVP, evaluate after launch)
DECISION #4 was chosen for latency. Adding ElevenLabs back undoes that. Ship with built-in voices, test them yourself in both languages, and only add ElevenLabs if there is a real quality problem — not a hypothetical one.

Your call (reply with a number):
