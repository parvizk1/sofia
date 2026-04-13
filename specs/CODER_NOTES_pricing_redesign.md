# Coder Notes: Pricing Redesign (Three-Bundle Model)

**Date:** 2026-04-13
**Spec:** `specs/SPEC_pricing_redesign.md` + locked decisions in task brief
**Branch:** `feature/pricing-redesign-2026-04-13`

## What was built

Replaced the single `$39.99/mo` pricing card with the three-bundle lineup
(Starter $100 + $1,500 setup / Pro $300 + $2,500 setup / Complete $500 +
$5,000 setup), rewrote the `Why Sofia` section into a three-column DIY-vs-
Staff-vs-Sofia frame, swapped the hero CTA to a **call Sofia at (873) 736-0217**
primary action with a secondary "or send us a message" link, added a `bundle`
select to the contact form, fully refreshed both thank-you pages, and added a
Netlify Function that routes Pro/Complete leads to SMS via the Twilio REST API.
Did a sweeping French-accent fix on FR copy across both pages and the JS file.
Replaced the JSON-LD with a `Service` schema (Country `CA`, three Offers, both
monthly and one-time setup priceSpecifications).

## Files created

- `website/netlify/functions/submission-created.js` — Netlify-Forms-triggered
  function that POSTs to Twilio Messages API for `bundle` ∈ {pro, complete}.
- `specs/CODER_NOTES_pricing_redesign.md` — this file.

## Files modified

- `website/index.html` (FR) — full rewrite of head metadata, hero, header CTAs,
  why-sofia (3 cols), pricing (3 bundle cards with prices + setup fees + Complete
  subtitle), contact form (added `bundle` select), footer (added phone link,
  removed "Laval, QC" in favor of "Bilingue, partout au Canada"), JSON-LD.
  All FR accents fixed.
- `website/en/index.html` — mirror of above with EN copy.
- `website/merci.html` — full rebuild. New positioning: "Sofia vous rappellera
  dans les 24 prochaines heures." Phone CTA added. All accents.
- `website/en/thank-you.html` — full rebuild. New positioning: "Sofia will call
  you back within the next 24 hours."
- `website/css/styles.css` — deleted: `.comparison__card--other` rule, the
  `.comparison__card--other .comparison__list li{,::before}` rules,
  `.comparison__price`, `.comparison__card--other .comparison__price`, and the
  entire `.pricing__card / __badge / __intro-price / __amount / __period /
  __regular / __features / __cta / __note` block. Kept `.pricing` /
  `.pricing::before` (section-level chrome reused). Added: `.bundle-card{,...}`
  family, `.bundles__grid` / `.bundles__footnote`, `.comparison--three`,
  `.vs-card{,--diy/--staff/--sofia/__tagline/__verdict}`, neutral DIY/staff
  bullet markers, `.form-select`, `.hero__secondary-cta`/`__link`,
  `.site-footer__phone`. Added `@media (min-width: 900px)` block for 3-col
  bundle grid + `translateY(-8px)` Pro elevation + 3-col comparison.
- `website/js/main.js` — patched smooth-scroll handler to tolerate
  `#contact?bundle=X` hash-suffix without throwing on `querySelector`. Added
  `parseBundleFromHash()` + `prefillBundleFromUrl()`, wired to anchor click,
  page load, and `hashchange`. Fixed FR validation message accents
  (`numéro de téléphone`).
- `netlify.toml` — added `[functions]` block pointing at `netlify/functions`
  with `node_bundler = "esbuild"` so the new function deploys.
- `.env.example` — added `TWILIO_FROM_NUMBER=+18737360217` and
  `LEAD_NOTIFICATION_PHONE=+18737360217` with inline documentation. Pre-existing
  `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` reused.
- `backend/README.md` — appended a "TODO — Sofia inbound qualification script"
  block listing the 7 elements (greet bilingually, ask service, ask website,
  callback window, offer SMS link, capture business type, SMS summary to
  notification number) so the voice-agent work is tracked there.

## Spec ambiguities resolved (what + why)

1. **Spec said no per-tier prices, brief said show all three.**
   The brief's "Locked pricing" table + "Show all three prices publicly on the
   page (no 'contact us' hiding)" directly overrides spec section 2.1 ("no
   per-tier price renders on the cards") and the "Solutions a partir de 300$"
   footnote. Followed the brief — added `$100/mo`, `$300/mo`, `$500/mo` plus
   `+ $X,XXX setup` text on each card. Footnote rewritten to a "not sure?
   call Sofia" prompt instead of a "starting at" anchor. Card CTAs stay
   `Contactez-nous` / `Contact us` per spec.

2. **Hero CTA wording.** Spec proposed `Voir les solutions` / `See solutions`.
   Brief overrides with `Appelez Sofia : (873) 736-0217` /
   `Call Sofia: (873) 736-0217` as primary, plus a secondary
   `ou écrivez-nous` / `or send us a message` linking to `#contact`. Removed
   the spec's secondary `Comment ça marche` ghost CTA — header nav already has
   that link, and the brief explicitly only specified one primary + one
   secondary CTA. Flagging this as a small spec-vs-brief deviation: if the
   critic wants the `Comment ça marche` ghost button restored, that's a
   one-line add.

3. **JSON-LD schema choice.** Brief said `Service` not `LocalBusiness`. Brief
   said "setup fees go in `priceSpecification` as a separate `additionalProperty`
   or `eligibleQuantity` block — coder picks the cleanest pattern." Picked:
   `priceSpecification` as an **array of two `UnitPriceSpecification` entries**
   per Offer — one with `billingIncrement: P1M, unitText: MON, name: Monthly
   subscription, price: <100|300|500>` and one with `name: One-time setup fee,
   price: <1500|2500|5000>`. This is the cleanest valid pattern (Schema.org
   accepts arrays for `priceSpecification`, both members are valid
   `UnitPriceSpecification` types, and Google's Rich Results parser reads both
   as discoverable price tiers without complaining about a missing top-level
   `price`). Wrapped all three Offers in `hasOfferCatalog.itemListElement`
   (cleaner than `makesOffer` for a `Service` parent type).

4. **Geography rewrite.** Brief said Sofia is bilingual Canada-wide, NOT
   Laval/Montreal-only. Rewrote:
   - `<title>` from `Laval & Montreal` → `Bilingue Canada` / `Bilingual Canada`.
   - Hero proof line from `Conçu pour les commerces de Laval et Montreal.` →
     `Conçu pour les commerces locaux partout au Canada.` (and EN equivalent).
   - Footer copy `&copy; 2026 Sofia AI. Laval, QC.` →
     `Bilingue, partout au Canada.` / `Bilingual, across Canada.`
   - JSON-LD `areaServed` from city array → single
     `{"@type":"Country","name":"CA"}`.
   - Removed the comparison-section "Local support — Laval and Montreal" bullet
     (no longer accurate at country scope; replaced with "No local support" on
     the DIY card and equivalent Sofia framing).

5. **French accent sweep.** Per brief #5, did a comprehensive pass on FR copy
   in `index.html`, `merci.html`, and the `errorMessages.fr` block in
   `main.js`. Words fixed include: Réceptionniste, conçu/conçue, répond/
   répondez, reçoit, déjà, après, français, téléphone/téléphonique, réponse,
   résumé, numéro, pénalité, vous-même, différence, Recommandé, dédiée,
   coordonnées, automatisée, configurée, paramétrage, élevé, coût, employé,
   façon, ça, à (preposition), Prêt, êtes. Did NOT touch the EN file's
   "Passer au français" aria-label — already correct.
   **No words flagged as ambiguous** — every word fixed has a single
   unambiguous accented form in standard Canadian French.

## Blockers encountered

**None hard blocking.** Two soft items the critic should weigh in on:

- **Twilio SDK assumption in brief.** Brief said "Twilio SDK is fine since it's
  already in backend" — but `backend/package.json` does NOT have `twilio` as
  a dependency (only fastify, ws, dotenv, @fastify/websocket). To respect the
  "no new dependencies" rule, the Netlify function uses a direct `fetch` to
  the Twilio Messages REST API with HTTP Basic auth (Account SID + Auth
  Token). This is identical in semantics to `client.messages.create()` — just
  no SDK overhead. Worth confirming the critic / Parviz is OK with this; if
  they prefer the SDK, add `"twilio": "^5.x"` to a new
  `website/netlify/functions/package.json` and swap the fetch call for
  `client.messages.create({...})`.

- **Netlify form discovery for the `bundle` field.** Netlify auto-detects new
  form fields on next deploy via the post-processing build step. No hidden
  duplicate form needed (single source of truth in the visible `<form>`). If
  Netlify Forms doesn't pick up the field on first deploy, the standard fix
  is to trigger a fresh deploy with cache cleared — flag for ops, not a code
  bug.

## Acceptance criteria

Spec section 7 criteria + brief decisions checked:

- [x] Zero occurrences of `39.99`, `39,99`, `49.99`, `49,99`, `$59`, `59$`
      across both index.html files (verified via grep, no matches).
- [x] Three bundle cards in both languages with locked prices visible.
- [x] Mobile-first stack on `<900px`, three-column on `≥900px`, Pro elevated
      with badge + glow + `translateY(-8px)`.
- [x] Bundle CTAs use `#contact?bundle=<id>` hash format; smooth-scroll patch
      tolerates the suffix; pre-fill runs on click, page load, and hashchange.
- [x] Form select has unsure default; values map starter/pro/complete/unsure.
- [x] `aria-labelledby` on all three `<article class="bundle-card">`.
- [x] Pro card "recommended" announced via `visually-hidden` span inside `<h3>`.
- [x] DIY → Staff → Sofia order in why-sofia, Sofia uses green-glow card.
- [x] JSON-LD parses as valid JSON in both files (verified via Python
      `json.loads`).
- [x] Hero CTA → `tel:+18737360217` per brief; secondary `#contact` link.
- [x] Header CTA text → `Contactez-nous` / `Contact us`.
- [x] Setup fees + monthly fees both surface on cards.
- [x] Complete card has `6 mois de service inclus` / `6 months of service
      included` subtitle.
- [x] All FR accents fixed across `index.html`, `merci.html`, and `main.js`
      validation messages.
- [x] `merci.html` and `thank-you.html` rebuilt with new "Sofia will call
      you back within 24h" positioning + phone CTA.
- [x] `.env.example` updated with `TWILIO_FROM_NUMBER` and
      `LEAD_NOTIFICATION_PHONE`, both documented to `+18737360217`.
- [x] No hardcoded secrets. No hardcoded destination phone number in code
      (env-driven). Public phone number `(873) 736-0217` is visible only in
      user-facing copy + `tel:` hrefs, which is correct (it is not a secret).
- [x] Sofia inbound qualification script TODO captured in
      `backend/README.md`.

## JSON-LD validation status

- **Local validation:** PASSED. Both blocks parse via Python `json.loads`
  with no errors. Both have `@context: schema.org`, `@type: Service`,
  `hasOfferCatalog` with 3 `Offer` items, each with a 2-element
  `priceSpecification` array.
- **Google Rich Results Test:** NOT RUN — no public deploy URL yet (this
  branch hasn't been merged or pushed to a deploy preview). Once merged to
  main and Netlify auto-deploys, run
  `https://search.google.com/test/rich-results` against
  `https://callsofia.ca/` and `https://callsofia.ca/en/`. Expect zero errors.
  If `priceSpecification` array shape is rejected by Google's parser
  (unlikely — it's a documented Schema.org pattern), fallback is to merge
  setup fees into the `description` text and keep only the monthly
  `UnitPriceSpecification` as a single object. Defer that fallback until we
  see real validator output.

## Geography flag for critic / business advisor

Removed "Laval / Montreal / Quebec" framing from titles, hero proof, and
footer per the brief's geography correction. Kept Parviz's location implicit
(no street address shown anywhere). If the business advisor wants the home
city back as a "we're based in Laval but serve Canada-wide" footnote, that's
a copy-only follow-up.

## How to test

```bash
# 1. Visual / structural smoke test
cd /home/parviz/sofia
python3 -m http.server --directory website 8080
# Open http://localhost:8080/ and http://localhost:8080/en/
# Verify: hero shows "Appelez Sofia" / "Call Sofia" with phone number;
# pricing shows 3 cards with $100/$300/$500 + setup; Pro is elevated +
# badged; clicking each card CTA scrolls to #contact and the bundle select
# changes; landing on /#contact?bundle=pro deep-links the select to Pro.

# 2. JSON-LD validation
python3 -c "
import re, json
for f in ['website/index.html','website/en/index.html']:
    m = re.search(r'<script type=\"application/ld\\+json\">(.*?)</script>', open(f).read(), re.DOTALL)
    print(f, 'OK' if json.loads(m.group(1)) else 'FAIL')
"

# 3. Grep regression — should print nothing
grep -rE '39\.99|39,99|49\.99|49,99|\$59|59\$|Essai gratuit|Free trial' website/

# 4. Netlify function (after deploy + env vars set in dashboard)
# Submit the form on /#contact with bundle=pro selected.
# Expect: SMS to LEAD_NOTIFICATION_PHONE within ~10s. Function logs in
# Netlify dashboard show 'submission-created: SMS sent sid=SMxxxx'.
# Submit with bundle=starter — expect log 'low-priority bundle, no SMS sent'.
```

## Out-of-scope things noticed but NOT changed

- `.gitignore`, `CLAUDE.md`, `README.md`, `backend/.gitkeep` had pre-existing
  uncommitted modifications when this branch was cut. Left untouched (not
  mine to commit).
- `website/_headers`, `website/_redirects`, `website/robots.txt`,
  `website/images/` — untouched per spec section 8.
- FAQ section structure — untouched per spec; only the FR accent sweep
  touched the copy inside.
- Problem section + How-It-Works section — only FR accents fixed; structure
  and English copy unchanged.
