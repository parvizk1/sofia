# Sofia Backend — Minimal Voice Agent

Twilio ↔ OpenAI Realtime API relay. Caller speaks, Sofia responds.

## Setup

```bash
cd backend
npm install
cp ../.env.example .env
# Fill in OPENAI_API_KEY and TWILIO_* values
```

## Run locally

```bash
npm run dev
```

## Test with Twilio

1. **Expose locally with ngrok:**
   ```bash
   ngrok http 3000
   ```

2. **Configure Twilio phone number:**
   - Go to Twilio Console → Phone Numbers → Your number
   - Under "Voice Configuration", set webhook to return TwiML:
   
   ```xml
   <Response>
     <Connect>
       <Stream url="wss://YOUR_NGROK_URL/twilio-media" />
     </Connect>
   </Response>
   ```
   
   Or use a TwiML Bin with this content, pointing to your ngrok URL.

3. **Call your Twilio number** — Sofia should answer!

## What this does

```
Caller → Twilio → /twilio-media (WebSocket) → OpenAI Realtime API
                                            ↓
                        Sofia speaks back ← Audio response
```

- Audio format: g711_ulaw (8kHz) — native Twilio format, no transcoding needed
- VAD: Server-side voice activity detection (OpenAI handles turn-taking)
- Voice: "alloy" (can change to: echo, fable, onyx, nova, shimmer)

## Next steps

- [ ] Add tool calls (check_availability, book_appointment)
- [ ] Add SQLite for leads/logs
- [ ] Add per-client config loading
- [ ] Deploy to Fly.io

## TODO — Sofia inbound qualification script (callsofia.ca hero CTA)

The hero CTA on callsofia.ca routes to Sofia's voice agent at +1 (873) 736-0217.
When the inbound qualification flow is built, the agent must cover these
elements (sourced from the pricing-redesign coordination, 2026-04-13):

1. Greet bilingually FR/EN, ask language preference.
2. Ask which service interests them (Starter / Pro / Complete / not sure).
3. Ask if they have a website already.
4. Ask preferred callback window (morning / afternoon / evening).
5. Offer to text them the callsofia.ca link.
6. Capture business type (salon / clinic / dealership / other).
7. SMS lead summary to +1 (873) 736-0217 (use `LEAD_NOTIFICATION_PHONE` env var,
   same routing convention as the Netlify form `submission-created` function).
