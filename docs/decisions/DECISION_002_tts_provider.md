DECISION #2 — TTS Provider: ElevenLabs vs OpenAI TTS
Status: RESOLVED — Option 1 (ElevenLabs). Voice quality is the product.

Context: The blueprint chose ElevenLabs for TTS without comparing alternatives. OpenAI TTS is 5-10x cheaper per character and already in the stack (you need an OpenAI key for Whisper). ElevenLabs has better Quebec French voices but the cost difference at 200 calls/month is significant: ~$10/client/month (ElevenLabs Scale) vs ~$1.50/client/month (OpenAI TTS).

Options:
  1. ElevenLabs (Multilingual v2, Scale plan) — Superior voice quality, proven Quebec French voices (Thomas, Amelie), $0.18/1K chars overage on Scale. | Tradeoff: ~$10/client/month TTS cost, separate vendor to manage, but best-in-class quality for the "secretary that sounds human" pitch.
  2. OpenAI TTS (tts-1) — $0.015/1K chars, already authenticated via Whisper key, one fewer vendor. | Tradeoff: ~$1.50/client/month TTS cost, but French Canadian accent quality is unverified and likely inferior. Test before committing.
  3. Start with OpenAI TTS, switch to ElevenLabs if quality fails Parviz's ear test — Ship faster, save money at MVP, upgrade if clients complain. | Tradeoff: Requires building the TTS layer as a swappable interface (30 min extra work), but gives you data before spending.

Architect recommendation: Option 1 (ElevenLabs)
Voice quality is the product — callers must believe Sofia is professional.

Devil's Advocate recommendation: Option 3 (Start cheap, upgrade with data)
At 3 clients, spend 30 minutes building a TTS interface, test both, decide with your ears not assumptions. The $8.50/client/month savings x 3 clients = $25.50/month is real at this stage.

Your call (reply with a number):
