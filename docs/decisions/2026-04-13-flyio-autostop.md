# DECISION #1 — Fly.io machine posture: always-on vs autostop

**Status:** Waiting for Parviz
**Date:** 2026-04-13
**Context:** Sofia's backend is deploying to Fly.io Toronto now that `+1 (873) 736-0217` is public on callsofia.ca. Fly can either keep a machine always-on (constant $4–5/mo, zero cold-start) or auto-stop on idle (near-$0/mo, 2–8s cold-start on the first call after idle). At zero paying clients, idle is the common case — but the first real caller hearing 5 seconds of silence after "Bonjour, hi!" is the risk.

## Options

**Option 1 — Always-on (`min_machines_running = 1`, `auto_stop_machines = false`)**
Machine stays up 24/7; every call connects in <200ms regardless of traffic pattern.
Tradeoff: ~$4–5/mo with zero paying clients, zero cold-start risk, professional UX from call one.

**Option 2 — Autostop (`auto_stop_machines = true`, `min_machines_running = 0`)**
Machine stops after idle; next call pays 2–8s cold-start while Fly boots Node.
Tradeoff: ~$0–1/mo idle, but the first caller after any idle gap may perceive dead air before Sofia responds.

**Option 3 — Scheduled warm (`auto_stop_machines = true` + a cron that pings `/health` every 4 min during business hours 8am–8pm ET)**
Machine stays warm during likely-call hours, stops overnight.
Tradeoff: ~$2–3/mo, no cold-start during business hours, cold-start only for off-hours callers (acceptable — off-hours is voicemail-grade expectation).

## Architect recommendation: Option 1

The phone number is your public credibility signal. $4/mo is a rounding error next to one lost first impression; even one "the AI doesn't work" moment costs more in trust than a year of always-on hosting. Revisit in 6 months when traffic patterns are real data and Option 3 might dominate.

---
Your call (reply with a number):
