# Critic Review: Marketing Website

**Reviewer:** Critic agent
**Date:** 2026-04-10
**Spec:** `specs/SPEC_marketing_website.md`
**Coder notes:** `specs/CODER_NOTES_marketing_website.md`
**Files reviewed:** 12 files in `website/`

---

## Verdict: PASS with issues

The build is solid and launch-ready with minor fixes. All 8 sections exist in both languages, pricing is correct, copy matches the spec, Netlify config is correct, accessibility is strong, and the code is clean. The issues below are fixable in one pass -- none are blockers that would delay a deploy.

---

## Issue Summary

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | Medium | Spec compliance | Hamburger breakpoint at 1024px, spec says 768px |
| 2 | Medium | Accessibility | `--` used instead of em dash in rendered copy |
| 3 | Low | Accessibility | Focus trap does not include hamburger close button |
| 4 | Low | SEO | JSON-LD `@type` should be `ProfessionalService`, not `LocalBusiness` |
| 5 | Low | Spec compliance | FAQ section title not in spec draft copy |
| 6 | Low | CSS | Contact section subtitle text-align left orphaned on tablet |
| 7 | Low | Accessibility | Thank-you pages missing `<main>` landmark role for screen readers... wait, they have it. Scratch that. |
| 8 | Info | Copy quality | Consider proper French typographic quotes and accents |
| 9 | Info | Performance | Google Fonts `link rel="stylesheet"` is render-blocking |
| 10 | Info | Netlify | `netlify.toml` `publish` path may conflict with repo structure |

---

## Detailed Issues

### Issue 1 (Medium) -- Hamburger breakpoint mismatch

**Where:** `css/styles.css` lines 996-1007
**Spec says:** "Mobile hamburger menu appears below 768px, desktop nav above 768px" (Acceptance Criteria, Responsive section, line 1279)
**Code does:** Hamburger hides at 1024px (`min-width: 1024px`). Desktop nav and actions show at 1024px.

This means on tablets (768px-1023px), users see the hamburger instead of desktop nav. The spec explicitly says the cutover is 768px.

**However:** The spec's Section 2 HTML structure says "Desktop: show nav links inline, hide hamburger. Mobile: hide nav links, show hamburger." The spec's Section 5.4 Sticky Header says the same without a specific breakpoint. The coder's notes say "Hamburger menu appears below 1024px, desktop nav at 1024px+" which is a reasonable interpretation for a header with logo + 3 links + lang toggle + CTA button -- that would be very tight at 768px.

**Fix:** This is a judgment call. If the spec's 768px acceptance criterion is firm, move the desktop nav reveal from 1024px to 768px:
```css
@media (min-width: 768px) {
  .site-header__nav { display: block; }
  .site-header__actions { display: flex; }
  .site-header__hamburger { display: none; }
  .mobile-nav { display: none !important; }
}
```
But test at 768px first -- the header has 5 elements (logo, 3 nav links, lang toggle, CTA button) and it may overflow. If it does, keep 1024px and update the spec.

**Recommendation:** Keep 1024px. Update the spec acceptance criterion to match. The coder made the right usability call -- just document it.

---

### Issue 2 (Medium) -- Double hyphens instead of em dashes in visible copy

**Where:** `index.html` lines 114, 132, 144, 184, 188, and equivalent lines in `en/index.html`
**Examples:**
- "Comme une receptionniste dediee -- sans le salaire."
- "ils appellent le concurrent"
- "Service cle en main -- on configure tout pour vous"

**Problem:** The spec's draft copy uses `--` as a shorthand for em dashes in a Markdown table (where the author likely intended them to render as dashes). The coder copied them literally into HTML. In rendered HTML, `--` looks unprofessional compared to a proper em dash (`—` / `&mdash;`).

**Fix:** Replace all `--` in visible text content with `&mdash;` (or the Unicode character `—`) in both `index.html` and `en/index.html`. There are approximately 6 instances in each file.

Example: `Comme une receptionniste dediee &mdash; sans le salaire.`

---

### Issue 3 (Low) -- Focus trap in mobile nav does not cycle to hamburger button

**Where:** `js/main.js` lines 69-92
**Problem:** The focus trap cycles between the first and last focusable elements *inside* `mobileNav`. But the hamburger button (which serves as the close button when `aria-expanded="true"`) is outside the `mobile-nav` element -- it's in the header. So when mobile nav is open, tabbing backward from the first link does not reach the hamburger/close button.

The spec says: "Trap focus inside mobile nav when open (Tab cycles through links and close button)." The "close button" is the hamburger itself.

**Fix:** Either:
1. Include the hamburger in the focus trap cycle (when shift-tabbing from first element, go to hamburger; when tabbing from last element, go to hamburger; from hamburger, tab goes to first link).
2. Or add a dedicated close button inside the mobile-nav overlay.

Option 1 is simpler:
```js
if (e.shiftKey) {
  if (document.activeElement === firstEl) {
    e.preventDefault();
    hamburger.focus(); // Go to hamburger/close button
  }
} else {
  if (document.activeElement === lastEl) {
    e.preventDefault();
    hamburger.focus();
  }
}
```
Then on the hamburger itself, add a keydown handler for Tab (goes to firstEl) and shift-Tab (goes to lastEl).

---

### Issue 4 (Low) -- JSON-LD schema type could be more precise

**Where:** `index.html` line 50, `en/index.html` line 50
**Current:** `"@type": "LocalBusiness"`
**Better:** `"@type": "ProfessionalService"` (a subtype of `LocalBusiness`)

Sofia AI is a professional service provider, not a retail storefront. `ProfessionalService` is more accurate and helps Google classify the business correctly. This is not wrong as-is, just imprecise.

**Fix:** Change `"@type": "LocalBusiness"` to `"@type": "ProfessionalService"` in both pages. (ProfessionalService inherits from LocalBusiness, so all the same properties apply.)

---

### Issue 5 (Low) -- FAQ section title differs from spec

**Where:** `index.html` line 235, `en/index.html` line 235
**Spec says:** No explicit section title for FAQ in the draft copy tables. The spec's HTML template just shows `<!-- section title -->`.
**Code uses:** "Questions frequentes" (FR) and "Frequently asked questions" (EN)

These are perfectly reasonable titles. The spec simply did not provide them. This is fine -- just noting for completeness that these are coder additions, not spec copy. No fix needed.

---

### Issue 6 (Low) -- Contact subtitle alignment on tablet

**Where:** `css/styles.css` lines 981-984
**Problem:** At 768px+, `.contact__text .section-subtitle` gets `text-align: left` and `margin-left: 0`. But `section-subtitle` has `max-width: 640px` and `margin: 0 auto`. Setting `margin-left: 0` breaks centering, but the text-align is left anyway. The issue is that on a 1fr column in the contact grid, if the column is wider than 640px, the subtitle will be left-aligned but not filling the column width -- it will have white space on the right. This is a cosmetic nit.

**Fix:** Remove the `max-width` constraint on the contact subtitle at tablet+, or keep it as-is since it is minor:
```css
.contact__text .section-subtitle {
  text-align: left;
  margin-left: 0;
  max-width: none;
}
```

---

### Issue 7 (Info) -- Proper French typography

**Where:** All French copy in `index.html`
**Observation:** The spec explicitly says "All copy below is draft. Parviz to refine before launch." The coder correctly used the draft copy as-is. However, for Quebec French:
- Accented characters are missing throughout: `reponse` should be `r&eacute;ponse`, `receptionniste` should be `r&eacute;ceptionniste`, `Pret` should be `Pr&ecirc;t`, etc.

Wait -- re-reading the spec carefully, the spec itself omits accents in the Markdown tables (likely a Markdown/ASCII limitation). The spec note says "Parviz to refine before launch." So the coder correctly reproduced the spec's draft. This is expected.

**Action for Parviz:** Before launch, add proper French accents to all copy. Key words: repond -> r&eacute;pond, receptionniste -> r&eacute;ceptionniste, dediee -> d&eacute;di&eacute;e, Pret -> Pr&ecirc;t, resume -> r&eacute;sum&eacute;, generale -> g&eacute;n&eacute;rale, etc. This matters for SEO (Google indexes accented French properly) and for credibility with Quebec French speakers.

---

### Issue 8 (Info) -- Google Fonts is render-blocking

**Where:** `index.html` line 41 (and equivalent in all pages)
**Current:** `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap">`

The `display=swap` parameter ensures text is visible immediately with a fallback font, so this is acceptable. The `<link rel="preconnect">` tags are correctly placed before it. This is not a real problem -- just noting that a future optimization could use `<link rel="preload" as="style">` + `onload` pattern. Not needed for launch.

---

### Issue 9 (Info) -- netlify.toml publish path

**Where:** `netlify.toml` line 2
**Current:** `publish = "website/"`

This assumes the Netlify build is triggered from the repo root (`/home/parviz/sofia/`). If Netlify's base directory is set to `website/` in the Netlify dashboard, then `publish` should be `"."` or just `"/"`. If the base directory is the repo root, then `"website/"` is correct.

**Action for Parviz:** When setting up Netlify, ensure:
- If base directory = repo root (`sofia/`), keep `publish = "website/"`
- If base directory = `website/`, change `publish` to `"."`

---

## Spec Compliance Checklist

### All 8 sections present?

| Section | FR | EN | Notes |
|---------|----|----|-------|
| 1. Sticky header | Yes | Yes | All elements match spec |
| 2. Hero | Yes | Yes | Copy matches exactly |
| 3. Problem + Solution | Yes | Yes | 4 pain + 4 gain items per spec |
| 4. How It Works | Yes | Yes | 3 steps per spec |
| 5. Why Sofia | Yes | Yes | 5 items per column + prices per spec |
| 6. Pricing | Yes | Yes | $39.99 intro, $49.99 regular, 6 features |
| 7. FAQ | Yes | Yes | 5 questions each, copy matches spec |
| 8. Lead Capture + Footer | Yes | Yes | 5 form fields, honeypot, footer |

### Pricing correct?
- FR: `39,99$` intro, `49,99$/mois apres les 6 premiers mois` -- CORRECT
- EN: `$39.99` intro, `$49.99/mo after the first 6 months` -- CORRECT
- Comparison section: `39,99$/mois` (FR) / `$39.99/mo` (EN) vs `59$/mois et plus` / `$59/mo and up` -- CORRECT

### Free trial CTA present?
- Header: "Essai gratuit" / "Free trial" -- YES
- Hero: "Commencer l'essai gratuit" / "Start your free trial" -- YES
- Pricing: "Commencer l'essai gratuit" / "Start your free trial" -- YES

### Domain callsofia.ca referenced correctly?
- Canonical URLs, hreflang tags, OG URLs, JSON-LD all use `https://callsofia.ca` -- CORRECT

### hreflang tags?
- Both pages have fr, en, x-default links -- CORRECT
- x-default points to French page (callsofia.ca/) -- CORRECT per spec

### Thank-you pages?
- `/merci.html` and `/en/thank-you.html` exist -- YES
- Both have `noindex, nofollow` -- CORRECT
- Both link back to homepage -- CORRECT
- Copy matches spec -- CORRECT

---

## Code Quality

### HTML
- Semantic structure: header, nav, main, section, footer -- CORRECT
- One h1 per page -- CORRECT (all 4 pages)
- Heading hierarchy: h1 > h2 > h3, no skipped levels -- CORRECT
- Form labels with matching for/id -- CORRECT
- BEM-lite naming convention -- CORRECT
- `class="no-js"` on html element for progressive enhancement -- CORRECT

### CSS
- Mobile-first with breakpoints at 768px, 1024px, 1280px -- CORRECT
- All custom properties from spec present in `:root` -- CORRECT (exact match)
- Box-sizing border-box on all elements -- CORRECT
- `.visually-hidden` uses clip-rect approach (not display:none) -- CORRECT per spec
- Section background alternation matches spec table -- CORRECT
- Contact section uses teal bg with white text -- CORRECT

### JS
- No dependencies, no framework -- CORRECT
- IIFE with 'use strict' -- CORRECT
- Progressive enhancement (everything works without JS) -- CORRECT
- `passive: true` on scroll listener -- GOOD practice
- `requestAnimationFrame` throttle on scroll -- CORRECT per spec

---

## Accessibility (WCAG 2.1 AA)

### Passes
- Color contrast: all combinations from Appendix A are correctly implemented
- Focus visible: `:focus-visible` with 2px solid outline on all interactive elements
- Keyboard navigation: tab order follows DOM order, FAQ uses native details/summary
- Form labels: every input has a `<label>` with matching `for`/`id`
- Alt text: logo has `alt="Sofia AI"`, SVG icons have `aria-hidden="true"`
- Language: `html lang="fr"` / `html lang="en"` correctly set
- `prefers-reduced-motion`: disables smooth scroll and all transitions/animations
- Mobile nav: has `hidden` attribute, `aria-expanded` on hamburger, focus moves to first link on open
- Landmark roles: implicit from semantic HTML, `nav` elements have distinct `aria-label`
- Touch targets: hamburger is 44x44px, mobile nav links have min-height 44px + padding
- Form error messages use `role="alert"` for live announcement

### Issues (noted above)
- Focus trap does not include the hamburger/close button (Issue 3)
- Double hyphens instead of em dashes are cosmetic, not a WCAG issue (Issue 2)

---

## SEO

### Passes
- Meta titles and descriptions present and match spec exactly -- both languages
- OG tags complete: type, title, description, url, image, locale, locale:alternate, site_name
- Twitter Card tags: card, title, description, image
- Canonical URLs correct: `/` for FR, `/en/` for EN
- hreflang implementation correct in both pages
- JSON-LD structured data present in both pages with correct localization
- robots.txt correct with sitemap reference
- Favicon tags present in all 4 pages
- Thank-you pages have `noindex, nofollow` -- CORRECT

### Minor (Issue 4)
- JSON-LD @type could be ProfessionalService instead of LocalBusiness

---

## Netlify Configuration

### Passes
- Forms: `data-netlify="true"`, `netlify-honeypot="bot-field"`, hidden `form-name` input -- all correct
- Honeypot: hidden with `.visually-hidden` (not display:none) per spec -- CORRECT
- Hidden `lang` field: `value="fr"` in FR form, `value="en"` in EN form -- CORRECT
- Redirects: `/merci` -> `/merci.html` (200), `/en/thank-you` -> `/en/thank-you.html` (200), `/en` -> `/en/` (301) -- CORRECT
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSP -- all match spec exactly
- Cache headers: images, css, js all get 1-year immutable cache -- CORRECT
- Headers in both `netlify.toml` and `_headers` flat file (belt and suspenders) -- CORRECT

### Note (Issue 9)
- `publish` path depends on Netlify base directory setting

---

## Copy Quality

### Quebec French
- Uses informal "vous" (not "tu", not formal "vous") -- CORRECT for business context
- "Courriel" instead of "email" -- CORRECT Quebec usage
- "Texto" instead of "SMS" or "message texte" -- CORRECT Quebec usage
- "Fin de semaine" instead of "week-end" -- CORRECT Quebec usage
- "Business" used deliberately (common in Quebec business talk) -- ACCEPTABLE

### No tech jargon
- No "AI-powered", "NLP", "WebSocket", "machine learning" -- CORRECT
- "Receptionniste" is the right framing (familiar concept, not tech)
- "Assistante automatisee" appears once in FAQ Q1, which is appropriate context

### Tone
- Direct, peer-to-peer, conversational -- CORRECT
- "On vous contacte" (we'll contact you) vs "Nous vous contacterons" (formal) -- CORRECT Quebec tone
- CTAs are clear and action-oriented: "Commencer l'essai gratuit", "Envoyer ma demande"

### Issue (Issue 2 + 7)
- `--` should be em dashes for professional appearance
- Accents missing (known spec limitation, Parviz to fix before launch)

---

## Cross-Browser / Responsive

### Will it work on mobile (375px)?
- YES. Mobile-first CSS, all content stacks vertically, container has 20px padding
- Flex-wrap on hero actions prevents button overflow
- FAQ uses native details/summary (works everywhere)
- No fixed widths that would cause horizontal scroll

### Safari concerns
- `scroll-behavior: smooth` has limited Safari support but JS fallback handles it -- CORRECT
- `-webkit-details-marker` hidden alongside `::marker` -- CORRECT
- `position: sticky` is well-supported in Safari 13+ -- CORRECT
- `focus-visible` is supported in Safari 15.4+ -- CORRECT (older Safari will just not show focus ring on click, which is acceptable)
- `-webkit-font-smoothing` is set -- CORRECT

### Firefox concerns
- `::marker` content override may not work in older Firefox. The code has both `display: none` and `content: ""` -- belt and suspenders approach is fine
- No `-moz-` prefixes needed for any features used

### Potential issue
- `backdrop-filter: blur(8px)` mentioned in spec as optional for header. Not implemented. This is fine (spec says optional).

---

## What the Coder Got Right

This deserves calling out because the build quality is high:

1. **Progressive enhancement is real.** The `no-js` class approach works -- without JS, nav shows inline, FAQ works natively, form uses HTML5 validation. Well thought out.
2. **Accessibility is thorough.** Focus states, aria attributes, landmark roles, touch targets, reduced motion, form error announcements -- this is better than most production sites.
3. **CSS architecture is clean.** Custom properties match the spec exactly. BEM-lite naming is consistent. No class name soup. Mobile-first is genuine (not desktop with overrides).
4. **JS is minimal.** Under 260 lines, zero dependencies, IIFE with strict mode, passive event listeners, rAF throttle. Exactly what the spec asked for.
5. **Copy matches the spec word-for-word.** No ad-libs, no missing sentences. All 5 FAQ answers are complete.
6. **Thank-you pages are properly handled.** noindex/nofollow, correct links back, correct Netlify redirects.

---

## Recommended Fix Priority

1. **Before deploy:** Fix `--` to em dashes in both HTML files (Issue 2). Takes 5 minutes.
2. **Before deploy:** Decide on hamburger breakpoint (Issue 1). Either keep 1024px and update spec, or move to 768px and test.
3. **Nice to have:** Fix focus trap to include hamburger (Issue 3). Low risk for launch.
4. **Nice to have:** Update JSON-LD @type (Issue 4). Minor SEO improvement.
5. **Before launch (Parviz):** Add proper French accents to all copy (Issue 7).

---

## Final Assessment

This is a clean, well-executed build. The coder followed the spec faithfully, made reasonable judgment calls where the spec was ambiguous (breakpoint, FAQ title), and delivered code that is accessible, performant, and production-ready. The issues are minor and none block deployment to Netlify for testing.

**Ready for merge after Issues 1 and 2 are addressed.**
