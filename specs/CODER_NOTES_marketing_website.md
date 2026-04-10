# Coder Notes: Marketing Website

**Built by:** Coder agent  
**Date:** 2026-04-10  
**Branch:** `feature/marketing-website`  
**Spec:** `specs/SPEC_marketing_website.md`

---

## Files Created

| File | Purpose |
|------|---------|
| `website/index.html` | French landing page (default) |
| `website/en/index.html` | English landing page |
| `website/merci.html` | French thank-you page (post form submit) |
| `website/en/thank-you.html` | English thank-you page (post form submit) |
| `website/css/styles.css` | Single shared stylesheet, mobile-first |
| `website/js/main.js` | Mobile nav, header scroll shadow, FAQ accordion, form validation, smooth scroll |
| `website/robots.txt` | Search engine directives |
| `website/netlify.toml` | Netlify build config, redirects, security headers, cache headers |
| `website/_redirects` | Placeholder for future Netlify redirects |
| `website/_headers` | Netlify security + cache headers (flat file format) |
| `website/images/sofia-logo.svg` | Placeholder SVG text logo (teal/black) |
| `website/images/sofia-logo-white.svg` | Placeholder SVG text logo (white, for dark bg) |

---

## Acceptance Criteria Status

### File Structure

- [x] `website/index.html` exists and is valid HTML5
- [x] `website/en/index.html` exists and is valid HTML5
- [x] `website/merci.html` exists (French thank-you page)
- [x] `website/en/thank-you.html` exists (English thank-you page)
- [x] `website/css/styles.css` exists (single stylesheet)
- [x] `website/js/main.js` exists (single JS file)
- [x] `website/robots.txt` exists
- [x] `website/netlify.toml` exists
- [x] `website/_redirects` exists (placeholder)
- [x] `website/_headers` exists
- [x] `website/images/` directory exists with placeholder SVG logos

### Content

- [x] French page has all 8 sections with all draft copy from spec
- [x] English page has all 8 sections with all draft copy from spec
- [x] Pricing shows $39.99/mo intro and $49.99/mo regular in both languages
- [x] "Free trial" CTA appears in hero, pricing, and header in both languages
- [x] FAQ has exactly 5 questions in both languages
- [x] Form has 5 fields: name, business, phone, email, message (optional)
- [x] Honeypot field exists and is visually hidden via `.visually-hidden` class
- [x] Hidden `lang` field exists in both FR (`value="fr"`) and EN (`value="en"`) forms

### Responsive

- [x] Mobile-first CSS with breakpoints at 768px, 1024px, 1280px
- [x] Hamburger menu appears below 1024px, desktop nav at 1024px+
- [x] All touch targets are at least 44x44px on mobile (hamburger is 44x44, nav links have sufficient padding)
- [ ] **Manual test required:** Visual rendering at 375px, 768px, 1280px, 1920px

### Navigation

- [x] Header CTA links to #contact
- [x] Hero CTA links to #contact
- [x] "How it works" / "Comment ca marche" links to #how-it-works
- [x] "Pricing" / "Tarifs" links to #pricing
- [x] "FAQ" links to #faq
- [x] Sticky header via `position: sticky`
- [x] Language toggle navigates to correct alternate page
- [x] Mobile menu toggle via JS with aria-expanded state
- [x] Mobile menu closes on link click
- [x] Mobile menu closes on Escape key

### Forms

- [x] Netlify form attributes: `data-netlify="true"`, `netlify-honeypot="bot-field"`, hidden `form-name` input
- [x] Required fields have `required` attribute
- [x] Email field uses `type="email"`
- [x] Phone field uses `type="tel"` with `pattern="[0-9\s\-\+\(\)]{7,20}"`
- [x] FR form action: `/merci`; EN form action: `/en/thank-you`
- [x] Thank-you pages display correctly and link back to homepage
- [ ] **Manual test required:** Form submission on Netlify after deploy

### SEO & Meta

- [x] French page has correct `<title>`, `<meta description>`, OG tags, canonical URL
- [x] English page has correct `<title>`, `<meta description>`, OG tags, canonical URL
- [x] Both pages have hreflang tags (fr, en, x-default)
- [x] Both pages have JSON-LD structured data (LocalBusiness schema)
- [x] robots.txt references sitemap.xml for forward-compatibility
- [x] Favicon tags present in all pages

### Accessibility

- [x] One `<h1>` per page
- [x] Heading hierarchy is sequential (h1 > h2 > h3, no skipped levels)
- [x] All form inputs have associated `<label>` elements with matching `for`/`id`
- [x] All images have alt attributes
- [x] Language toggle has aria-label
- [x] Focus visible on all interactive elements (`:focus-visible` with outline)
- [x] Tab order follows visual order (DOM order matches layout)
- [x] FAQ uses native `<details>`/`<summary>` (keyboard operable without JS)
- [x] Color contrast verified per spec Appendix A
- [x] `prefers-reduced-motion` disables smooth scroll and transitions
- [x] Mobile nav traps focus when open
- [x] `html lang` attribute set correctly per page
- [ ] **Manual test required:** W3C HTML validator

### Performance

- [x] No external JS dependencies
- [x] Only one external CSS dependency (Google Fonts Inter)
- [x] Total page weight under 50KB: FR = ~49KB, EN = ~48KB (HTML + CSS + JS, excluding images)
- [x] Script loaded with `defer` attribute

---

## Notes for Parviz

1. **Images needed:** The `images/` directory has placeholder SVG logos only. Before launch, provide:
   - `favicon.ico` (32x32)
   - `favicon-16x16.png`, `favicon-32x32.png`
   - `apple-touch-icon.png` (180x180)
   - `og-image-fr.jpg` and `og-image-en.jpg` (1200x630)
   - Final `sofia-logo.svg` (replace placeholder)

2. **Netlify post-deploy setup:**
   - Configure email notification for `lead-capture` form in Netlify dashboard
   - Set up custom domain `callsofia.ca` in Site settings > Domain management
   - Enable HTTPS (auto Let's Encrypt)

3. **Copy review:** All text is draft from the spec. Review and refine Quebec French phrasing before launch.

4. **No-JS fallback:** The `no-js` class on `<html>` is removed by JS on load. Without JS, nav links show inline (no hamburger), FAQ works natively with `<details>`, form uses HTML5 validation, and header shadow is purely cosmetic (skipped).
