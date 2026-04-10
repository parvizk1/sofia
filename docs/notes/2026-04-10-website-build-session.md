# Marketing Website: Full Build Session
**Date:** 2026-04-10
**Session:** 2 of the day (morning was system design / architecture)
**Participants:** Parviz, Secretary, Architect, Devil's Advocate, Designer, Coder, Critic, Note Taker
**Status:** implemented

## Context

Session 1 (same day) produced the voice backend architecture. HANDOFF recommended building the voice backend spec next. Parviz chose to build the marketing website instead — a practical call to establish a public presence and begin capturing leads before the backend is complete.

## Key outputs

| Output | File / Location |
|--------|-----------------|
| Website blueprint | Produced by Architect (not saved separately — incorporated into spec) |
| Full website spec | `specs/SPEC_marketing_website.md` (~1,400 lines, FR+EN copy, CSS arch, JS requirements, Netlify config, 50+ acceptance criteria) |
| Built website | `website/` — 13 files on branch `feature/marketing-website` |
| Coder notes | `specs/CODER_NOTES_marketing_website.md` |
| Critic review | `specs/CRITIC_REVIEW_marketing_website.md` |

### Website files built

```
website/
├── index.html               # French landing page (default)
├── en/index.html            # English landing page
├── merci.html               # French thank-you (post form)
├── en/thank-you.html        # English thank-you (post form)
├── css/styles.css           # Single shared stylesheet, mobile-first
├── js/main.js               # Nav, scroll, FAQ, form validation, smooth scroll
├── robots.txt
├── netlify.toml             # Build config, redirects, security headers, cache headers
├── _redirects               # Placeholder
├── _headers                 # Netlify security + cache headers (flat file)
└── images/
    ├── sofia-logo.svg        # Placeholder (teal/black)
    └── sofia-logo-white.svg  # Placeholder (white, for dark bg)
```

## Decisions made

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Domain | callsofia.ca | sofia.ai costs $69,500+ CAD — rejected. callsofia.ca is clear and available. |
| Pricing | $39.99/mo x 6 months intro → $49.99/mo regular | Undercuts Dialbox ($59/mo). Intro price is a client acquisition play. Margins are tight at intro ($3–8/client) but acceptable. At $49.99 margins are $13–18/client. |
| Free trial | Yes | Devil's Advocate and Architect both recommended it. Reduces friction for first client. |
| Bilingual | FR default (`/`) + EN (`/en/`) with hreflang | Laval/Montreal market is bilingual. FR as default reflects primary audience. |
| Page sections | 8 sections | Dropped standalone social proof (no testimonials yet), merged Problem/Solution into one section, added "Why Sofia" comparison table. |
| Tech stack | Vanilla HTML/CSS/JS, Netlify | No framework needed. Keeps site fast, cheap to host, easy to hand off or modify. |
| Lead capture | Netlify Forms + email notification | Simple, reliable at launch. SMS notifications as paid add-on in v2. |
| Positioning | Managed service vs. self-serve SaaS | Differentiates from Dialbox. Sofia configures and manages everything. Target: business owners who want to hand it off, not tinker. |

## Critic review verdict: PASS with minor fixes

All issues were addressable in one pass. Key findings:

| # | Severity | Issue | Resolution |
|---|----------|-------|------------|
| 1 | Medium | Hamburger breakpoint at 1024px; spec said 768px | Kept 1024px (better UX at tablet). Spec updated to match. |
| 2 | Medium | `--` used instead of em dashes (`&mdash;`) in rendered copy | Fixed in both `index.html` and `en/index.html`. |
| 3 | Low | Focus trap in mobile nav did not cycle to hamburger close button | Fixed in `js/main.js`. |
| 4 | Low | JSON-LD `@type` should be `ProfessionalService`, not `LocalBusiness` | Fixed in both HTML files. |
| 5–10 | Low/Info | FAQ title (coder addition, fine), tablet subtitle alignment, French accents (Parviz to do), Google Fonts render-blocking (non-issue with display=swap), netlify.toml publish path note | No code fixes; noted as pre-launch tasks for Parviz. |

Fixes for issues 1–4 were applied. Branch is ready to merge.

## Open questions / carry-forward

- [ ] Register `callsofia.ca` domain (Parviz must do this manually — not automated)
- [ ] Review and refine all Quebec French copy before launch (add proper accents: `receptionniste` → `réceptionniste`, `Pret` → `Prêt`, etc.)
- [ ] Provide real image assets before launch: `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png` (180x180), `og-image-fr.jpg` and `og-image-en.jpg` (1200x630), final `sofia-logo.svg`
- [ ] Netlify post-deploy: configure email notification for `lead-capture` form, set custom domain, enable HTTPS
- [ ] Netlify publish path: if base dir = repo root, keep `publish = "website/"`. If base dir = `website/`, change to `"."`
- [ ] "Call Sofia Now" live demo feature — add in v2 once voice pipeline is functional
- [ ] Voice backend spec (deferred from Session 1 HANDOFF — still pending)
- [ ] LinkedIn profile + company page
- [ ] FB Marketplace ad copy

## Next steps

- [ ] Merge `feature/marketing-website` into main
- [ ] Deploy to Netlify (test form submission end-to-end)
- [ ] Register callsofia.ca and point DNS to Netlify
- [ ] Parviz: review and refine copy (especially French accents and any phrasing changes)
- [ ] Next session: voice backend spec (the item deferred from Session 1)

## Key context for future sessions

- Dialbox is the direct Montreal competitor at $59 CAD/mo self-serve. Sofia's edge: managed, local, bilingual, personal.
- Margins at $39.99 intro are $3–8/client/month (tight). At $49.99 regular: $13–18/client/month. Call duration is the main cost lever — keep calls efficient.
- The website is intentionally social-proof-free at launch (no testimonials yet). The "Why Sofia" section uses a competitor comparison table as the trust mechanism instead.
- All website copy is draft. Parviz has final say on tone and phrasing — especially the Quebec French.
