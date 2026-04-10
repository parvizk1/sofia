# SPEC: Sofia AI Marketing Website

**Status:** Ready for implementation
**Author:** Designer agent
**Date:** 2026-04-10
**Deploy target:** Netlify (callsofia.ca)
**Tech stack:** Vanilla HTML / CSS / JS. No framework. No build step.

---

## Table of Contents

1. [File Structure](#1-file-structure)
2. [HTML Structure](#2-html-structure)
3. [Draft Copy — French](#3-draft-copy--french)
4. [Draft Copy — English](#4-draft-copy--english)
5. [CSS Architecture](#5-css-architecture)
6. [JavaScript Requirements](#6-javascript-requirements)
7. [Netlify Configuration](#7-netlify-configuration)
8. [SEO](#8-seo)
9. [Accessibility](#9-accessibility)
10. [Acceptance Criteria](#10-acceptance-criteria)
11. [Out of Scope](#11-out-of-scope)

---

## 1. File Structure

```
website/
├── index.html                  ← French landing page (default)
├── en/
│   └── index.html              ← English landing page
├── css/
│   └── styles.css              ← Single stylesheet, all responsive
├── js/
│   └── main.js                 ← FAQ accordion, smooth scroll, form validation, mobile nav
├── images/
│   ├── sofia-logo.svg          ← Sofia AI logo (SVG, inline-ready)
│   ├── sofia-logo-white.svg    ← White variant for dark contexts (if needed)
│   ├── favicon.ico             ← 32x32 favicon
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   ├── apple-touch-icon.png    ← 180x180
│   ├── og-image-fr.jpg         ← 1200x630 OG image, French text
│   └── og-image-en.jpg         ← 1200x630 OG image, English text
├── robots.txt
├── _redirects                  ← Netlify redirects
├── _headers                    ← Netlify security headers
└── netlify.toml                ← Netlify build config
```

**Total files to create:** 7 code files (2 HTML, 1 CSS, 1 JS, robots.txt, _redirects, netlify.toml, _headers). Images are assets Parviz provides or the coder generates placeholders for.

---

## 2. HTML Structure

### Naming Convention

- **BEM-lite:** Block + element with double-underscore, modifier with double-dash.
  - `.hero`, `.hero__title`, `.hero__cta`, `.hero--dark`
  - `.pricing`, `.pricing__price`, `.pricing__badge`
- **Section wrapper:** Each of the 8 sections gets a `<section>` with `id` and class.
  - IDs for anchor links: `#hero`, `#problem`, `#how-it-works`, `#why-sofia`, `#pricing`, `#faq`, `#contact`
  - Sticky header is `<header class="site-header" id="site-header">`
- **Container:** Every section has `<div class="container">` for max-width centering.

### Document Outline (both FR and EN share identical structure)

```html
<!DOCTYPE html>
<html lang="fr"> <!-- or lang="en" for English -->
<head>
  <!-- meta, fonts, CSS, OG tags — see SEO section -->
</head>
<body>

  <!-- ========== 1. STICKY HEADER ========== -->
  <header class="site-header" id="site-header">
    <div class="container site-header__inner">
      <a href="/" class="site-header__logo" aria-label="Sofia AI — Accueil">
        <img src="/images/sofia-logo.svg" alt="Sofia AI" width="120" height="40">
      </a>
      <nav class="site-header__nav" aria-label="Navigation principale">
        <ul class="site-header__links">
          <li><a href="#how-it-works">Comment ça marche</a></li>
          <li><a href="#pricing">Tarifs</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>
      </nav>
      <div class="site-header__actions">
        <a href="/en/" class="lang-toggle" aria-label="Switch to English">EN</a>
        <a href="#contact" class="btn btn--primary btn--sm site-header__cta">Essai gratuit</a>
      </div>
      <button class="site-header__hamburger" aria-label="Ouvrir le menu" aria-expanded="false">
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </button>
    </div>
    <!-- Mobile nav overlay -->
    <nav class="mobile-nav" id="mobile-nav" aria-label="Menu mobile" hidden>
      <ul class="mobile-nav__links">
        <li><a href="#how-it-works">Comment ça marche</a></li>
        <li><a href="#pricing">Tarifs</a></li>
        <li><a href="#faq">FAQ</a></li>
        <li><a href="/en/" class="lang-toggle">EN</a></li>
      </ul>
      <a href="#contact" class="btn btn--primary mobile-nav__cta">Essai gratuit</a>
    </nav>
  </header>

  <main>
    <!-- ========== 2. HERO ========== -->
    <section class="hero" id="hero">
      <div class="container hero__inner">
        <h1 class="hero__title"><!-- headline --></h1>
        <p class="hero__subtitle"><!-- subheadline --></p>
        <div class="hero__actions">
          <a href="#contact" class="btn btn--primary btn--lg"><!-- CTA text --></a>
          <a href="#how-it-works" class="btn btn--ghost btn--lg"><!-- secondary CTA --></a>
        </div>
        <p class="hero__proof"><!-- social proof line --></p>
      </div>
    </section>

    <!-- ========== 3. PROBLEM + SOLUTION ========== -->
    <section class="problem" id="problem">
      <div class="container">
        <h2 class="section-title"><!-- section title --></h2>
        <div class="problem__grid">
          <div class="problem__before">
            <h3 class="problem__label"><!-- "Sans Sofia" / "Without Sofia" --></h3>
            <ul class="problem__list problem__list--pain">
              <li><!-- pain point 1 --></li>
              <li><!-- pain point 2 --></li>
              <li><!-- pain point 3 --></li>
              <li><!-- pain point 4 --></li>
            </ul>
          </div>
          <div class="problem__after">
            <h3 class="problem__label"><!-- "Avec Sofia" / "With Sofia" --></h3>
            <ul class="problem__list problem__list--gain">
              <li><!-- gain 1 --></li>
              <li><!-- gain 2 --></li>
              <li><!-- gain 3 --></li>
              <li><!-- gain 4 --></li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- ========== 4. HOW IT WORKS ========== -->
    <section class="how-it-works" id="how-it-works">
      <div class="container">
        <h2 class="section-title"><!-- section title --></h2>
        <p class="section-subtitle"><!-- subtitle --></p>
        <div class="steps">
          <div class="step">
            <div class="step__number">1</div>
            <h3 class="step__title"><!-- step 1 title --></h3>
            <p class="step__desc"><!-- step 1 description --></p>
          </div>
          <div class="step">
            <div class="step__number">2</div>
            <h3 class="step__title"><!-- step 2 title --></h3>
            <p class="step__desc"><!-- step 2 description --></p>
          </div>
          <div class="step">
            <div class="step__number">3</div>
            <h3 class="step__title"><!-- step 3 title --></h3>
            <p class="step__desc"><!-- step 3 description --></p>
          </div>
        </div>
      </div>
    </section>

    <!-- ========== 5. WHY SOFIA ========== -->
    <section class="why-sofia" id="why-sofia">
      <div class="container">
        <h2 class="section-title"><!-- section title --></h2>
        <p class="section-subtitle"><!-- subtitle --></p>
        <div class="comparison">
          <div class="comparison__card comparison__card--sofia">
            <h3 class="comparison__heading">Sofia AI</h3>
            <ul class="comparison__list">
              <li><!-- Sofia advantage 1 --></li>
              <li><!-- Sofia advantage 2 --></li>
              <li><!-- Sofia advantage 3 --></li>
              <li><!-- Sofia advantage 4 --></li>
              <li><!-- Sofia advantage 5 --></li>
            </ul>
            <p class="comparison__price"><!-- Sofia price --></p>
          </div>
          <div class="comparison__card comparison__card--other">
            <h3 class="comparison__heading"><!-- competitor label --></h3>
            <ul class="comparison__list">
              <li><!-- competitor point 1 --></li>
              <li><!-- competitor point 2 --></li>
              <li><!-- competitor point 3 --></li>
              <li><!-- competitor point 4 --></li>
              <li><!-- competitor point 5 --></li>
            </ul>
            <p class="comparison__price"><!-- competitor price --></p>
          </div>
        </div>
      </div>
    </section>

    <!-- ========== 6. PRICING ========== -->
    <section class="pricing" id="pricing">
      <div class="container">
        <h2 class="section-title"><!-- section title --></h2>
        <div class="pricing__card">
          <div class="pricing__badge"><!-- badge text --></div>
          <p class="pricing__intro-price">
            <span class="pricing__amount">39,99$</span>
            <span class="pricing__period">/mois</span>
          </p>
          <p class="pricing__regular"><!-- then $49.99 text --></p>
          <ul class="pricing__features">
            <li><!-- feature 1 --></li>
            <li><!-- feature 2 --></li>
            <li><!-- feature 3 --></li>
            <li><!-- feature 4 --></li>
            <li><!-- feature 5 --></li>
            <li><!-- feature 6 --></li>
          </ul>
          <a href="#contact" class="btn btn--primary btn--lg pricing__cta"><!-- CTA --></a>
          <p class="pricing__note"><!-- no contract note --></p>
        </div>
      </div>
    </section>

    <!-- ========== 7. FAQ ========== -->
    <section class="faq" id="faq">
      <div class="container">
        <h2 class="section-title"><!-- section title --></h2>
        <div class="faq__list">
          <!-- Repeat this block for each question (4-5 total) -->
          <details class="faq__item">
            <summary class="faq__question">
              <span><!-- question text --></span>
              <svg class="faq__icon" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
              </svg>
            </summary>
            <div class="faq__answer">
              <p><!-- answer text --></p>
            </div>
          </details>
        </div>
      </div>
    </section>

    <!-- ========== 8. LEAD CAPTURE + FOOTER ========== -->
    <section class="contact" id="contact">
      <div class="container">
        <div class="contact__inner">
          <div class="contact__text">
            <h2 class="section-title"><!-- section title --></h2>
            <p class="section-subtitle"><!-- subtitle --></p>
          </div>
          <form
            class="contact__form"
            name="lead-capture"
            method="POST"
            data-netlify="true"
            netlify-honeypot="bot-field"
            action="/merci"
          >
            <!-- Honeypot (hidden from humans, visible to bots) -->
            <p class="visually-hidden" aria-hidden="true">
              <label>Ne remplissez pas ce champ: <input name="bot-field" tabindex="-1" autocomplete="off"></label>
            </p>
            <input type="hidden" name="form-name" value="lead-capture">
            <input type="hidden" name="lang" value="fr">

            <div class="form-group">
              <label for="name" class="form-label"><!-- label --></label>
              <input type="text" id="name" name="name" class="form-input" required
                     autocomplete="name" placeholder="<!-- placeholder -->">
            </div>
            <div class="form-group">
              <label for="business" class="form-label"><!-- label --></label>
              <input type="text" id="business" name="business" class="form-input" required
                     autocomplete="organization" placeholder="<!-- placeholder -->">
            </div>
            <div class="form-group">
              <label for="phone" class="form-label"><!-- label --></label>
              <input type="tel" id="phone" name="phone" class="form-input" required
                     autocomplete="tel" placeholder="<!-- placeholder -->"
                     pattern="[0-9\s\-\+\(\)]{7,20}">
            </div>
            <div class="form-group">
              <label for="email" class="form-label"><!-- label --></label>
              <input type="email" id="email" name="email" class="form-input" required
                     autocomplete="email" placeholder="<!-- placeholder -->">
            </div>
            <div class="form-group">
              <label for="message" class="form-label"><!-- label --></label>
              <textarea id="message" name="message" class="form-input form-input--textarea"
                        rows="3" placeholder="<!-- placeholder -->"></textarea>
            </div>
            <button type="submit" class="btn btn--primary btn--lg contact__submit">
              <!-- submit button text -->
            </button>
          </form>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="container site-footer__inner">
      <p class="site-footer__copy">&copy; 2026 Sofia AI. Laval, QC.</p>
      <div class="site-footer__links">
        <a href="/en/" class="lang-toggle">English</a>
      </div>
    </div>
  </footer>

  <!-- Thank-you page is handled by Netlify's custom success page or JS redirect -->
  <script src="/js/main.js" defer></script>
</body>
</html>
```

### Thank-You Page

After form submission, Netlify redirects to `/merci` (FR) or `/en/thank-you` (EN). These are simple pages — not full sections. The coder should create:

- `website/merci.html` — French thank-you page
- `website/en/thank-you.html` — English thank-you page

Each contains: the site header, a centered message ("Merci! On vous contacte dans les prochaines 24 heures." / "Thank you! We'll be in touch within 24 hours."), and a link back to the homepage. Same stylesheet. No form.

---

## 3. Draft Copy -- French

> **Note:** All copy below is draft. Parviz to refine before launch. Written in Quebec French (informal "vous", natural phrasing, no France-French formality).

### 3.1 Header

| Element | Text |
|---------|------|
| Logo alt text | `Sofia AI` |
| Nav link 1 | `Comment ca marche` |
| Nav link 2 | `Tarifs` |
| Nav link 3 | `FAQ` |
| Language toggle | `EN` |
| CTA button | `Essai gratuit` |

### 3.2 Hero

| Element | Text |
|---------|------|
| Headline (h1) | `Vos clients appellent. Qui repond?` |
| Subheadline | `Sofia repond a vos appels 24/7, prend les rendez-vous et envoie les confirmations par texto. Comme une receptionniste dediee -- sans le salaire.` |
| Primary CTA | `Commencer l'essai gratuit` |
| Secondary CTA | `Voir comment ca marche` |
| Social proof line | `Concu pour les commerces locaux de Laval et Montreal.` |

### 3.3 Problem + Solution

| Element | Text |
|---------|------|
| Section title (h2) | `Chaque appel manque vous coute de l'argent` |
| "Sans Sofia" label (h3) | `Sans Sofia` |
| Pain point 1 | `Vous manquez des appels pendant que vous travaillez sur un client` |
| Pain point 2 | `La messagerie vocale fait fuir vos clients -- ils appellent le concurrent` |
| Pain point 3 | `Vous rappelez 3 heures plus tard, le client a deja pris rendez-vous ailleurs` |
| Pain point 4 | `Vos soirees et fins de semaine sont interrompues par les appels` |
| "Avec Sofia" label (h3) | `Avec Sofia` |
| Gain 1 | `Chaque appel est repondu en moins de 3 secondes, jour et nuit` |
| Gain 2 | `Les rendez-vous sont pris automatiquement dans votre calendrier` |
| Gain 3 | `Le client recoit une confirmation par texto immediatement` |
| Gain 4 | `Vous recevez un resume de chaque appel -- zero surprise` |

### 3.4 How It Works

| Element | Text |
|---------|------|
| Section title (h2) | `Comment ca marche` |
| Section subtitle | `Trois etapes. Pas de configuration compliquee.` |
| Step 1 title | `Inscrivez-vous` |
| Step 1 desc | `Remplissez le formulaire. On vous contacte dans les 24 heures pour comprendre votre business.` |
| Step 2 title | `On configure Sofia pour vous` |
| Step 2 desc | `On programme Sofia avec vos horaires, vos services et votre facon de parler a vos clients. Vous n'avez rien a faire.` |
| Step 3 title | `Sofia repond a vos appels` |
| Step 3 desc | `Transferez vos appels vers Sofia. Elle repond en francais ou en anglais, prend les rendez-vous et vous envoie un resume.` |

### 3.5 Why Sofia

| Element | Text |
|---------|------|
| Section title (h2) | `Pourquoi Sofia plutot qu'un outil libre-service?` |
| Section subtitle | `La difference entre un outil que vous devez configurer vous-meme et un service cle en main.` |
| Sofia column heading | `Sofia AI` |
| Sofia point 1 | `Service cle en main -- on configure tout pour vous` |
| Sofia point 2 | `Bilingue francais et anglais, accent naturel` |
| Sofia point 3 | `Personnalisee pour votre business (horaires, services, ton)` |
| Sofia point 4 | `Support local -- Laval et Montreal, on peut se rencontrer` |
| Sofia point 5 | `Mise en place en 24-48 heures` |
| Sofia price | `39,99$/mois` |
| Competitor column heading | `Outils libre-service` |
| Competitor point 1 | `Vous devez tout configurer vous-meme` |
| Competitor point 2 | `Anglais seulement ou traduction robotique` |
| Competitor point 3 | `Configurations generiques, meme voix pour tout le monde` |
| Competitor point 4 | `Support par courriel seulement, souvent en anglais` |
| Competitor point 5 | `Des heures de configuration avant le premier appel` |
| Competitor price | `59$/mois et plus` |

### 3.6 Pricing

| Element | Text |
|---------|------|
| Section title (h2) | `Un prix simple. Pas de surprise.` |
| Badge | `Offre de lancement` |
| Intro price | `39,99$` |
| Period | `/mois` |
| Regular price text | `49,99$/mois apres les 6 premiers mois` |
| Feature 1 | `Appels illimites 24/7` |
| Feature 2 | `Reponse en francais et en anglais` |
| Feature 3 | `Prise de rendez-vous automatique` |
| Feature 4 | `Confirmation par texto au client` |
| Feature 5 | `Resume de chaque appel` |
| Feature 6 | `Configuration personnalisee incluse` |
| CTA button | `Commencer l'essai gratuit` |
| Note below CTA | `Aucun contrat. Annulez quand vous voulez.` |

### 3.7 FAQ

**Q1: Est-ce que Sofia a l'air d'un robot?**
> Non. Sofia utilise une voix naturelle et est configuree pour parler comme vous parleriez a vos propres clients. La grande majorite des appelants ne se rendent pas compte qu'ils parlent a une assistante automatisee.

**Q2: Est-ce que ca marche avec mon type de business?**
> Sofia est concue pour les commerces de services: salons de coiffure, cliniques, garages, restaurants, studios de photo, et plus. Si vos clients appellent pour prendre rendez-vous ou poser des questions, Sofia peut aider.

**Q3: Combien de temps ca prend a mettre en place?**
> En general, 24 a 48 heures. On s'occupe de toute la configuration. Vous avez juste a nous envoyer vos horaires et la liste de vos services.

**Q4: Qu'est-ce qui arrive si Sofia ne peut pas repondre a une question?**
> Sofia prend le message du client avec son numero de telephone et vous envoie un resume par texto. Vous rappelez quand vous etes disponible, avec tout le contexte en main.

**Q5: Est-ce que je peux annuler a tout moment?**
> Oui. Il n'y a aucun contrat et aucune penalite. Vous pouvez annuler par courriel ou par telephone, et ca prend effet immediatement.

### 3.8 Lead Capture + Footer

| Element | Text |
|---------|------|
| Section title (h2) | `Pret a ne plus manquer d'appels?` |
| Section subtitle | `Laissez-nous vos coordonnees. On vous contacte dans les 24 heures pour configurer Sofia pour votre business.` |
| Label: name | `Votre nom` |
| Placeholder: name | `Jean Tremblay` |
| Label: business | `Nom de votre entreprise` |
| Placeholder: business | `Salon Exemple` |
| Label: phone | `Telephone` |
| Placeholder: phone | `(514) 555-1234` |
| Label: email | `Courriel` |
| Placeholder: email | `jean@salonexemple.ca` |
| Label: message | `Message (optionnel)` |
| Placeholder: message | `Parlez-nous de votre business...` |
| Submit button | `Envoyer ma demande` |
| Footer copyright | `(c) 2026 Sofia AI. Laval, QC.` |
| Footer language link | `English` |

### 3.9 Thank-You Page

| Element | Text |
|---------|------|
| Heading | `Merci!` |
| Body | `On a bien recu votre demande. On vous contacte dans les prochaines 24 heures pour mettre Sofia en place pour votre business.` |
| Link back | `Retour a l'accueil` |

---

## 4. Draft Copy -- English

> **Note:** All copy below is draft. Parviz to refine before launch.

### 4.1 Header

| Element | Text |
|---------|------|
| Logo alt text | `Sofia AI` |
| Nav link 1 | `How It Works` |
| Nav link 2 | `Pricing` |
| Nav link 3 | `FAQ` |
| Language toggle | `FR` |
| CTA button | `Free trial` |

### 4.2 Hero

| Element | Text |
|---------|------|
| Headline (h1) | `Your clients are calling. Who's picking up?` |
| Subheadline | `Sofia answers your calls 24/7, books appointments, and sends text confirmations. Like a dedicated receptionist -- without the salary.` |
| Primary CTA | `Start your free trial` |
| Secondary CTA | `See how it works` |
| Social proof line | `Built for local businesses in Laval and Montreal.` |

### 4.3 Problem + Solution

| Element | Text |
|---------|------|
| Section title (h2) | `Every missed call is money lost` |
| "Without Sofia" label (h3) | `Without Sofia` |
| Pain point 1 | `You miss calls while you're busy with a client` |
| Pain point 2 | `Voicemail scares clients away -- they call your competitor instead` |
| Pain point 3 | `You call back 3 hours later, but they've already booked elsewhere` |
| Pain point 4 | `Your evenings and weekends are interrupted by business calls` |
| "With Sofia" label (h3) | `With Sofia` |
| Gain 1 | `Every call is answered in under 3 seconds, day and night` |
| Gain 2 | `Appointments are booked directly into your calendar` |
| Gain 3 | `Clients get a text confirmation right away` |
| Gain 4 | `You get a summary of every call -- no surprises` |

### 4.4 How It Works

| Element | Text |
|---------|------|
| Section title (h2) | `How it works` |
| Section subtitle | `Three steps. No complicated setup.` |
| Step 1 title | `Sign up` |
| Step 1 desc | `Fill out the form. We'll contact you within 24 hours to learn about your business.` |
| Step 2 title | `We set up Sofia for you` |
| Step 2 desc | `We configure Sofia with your hours, your services, and how you talk to your clients. You don't have to do a thing.` |
| Step 3 title | `Sofia answers your calls` |
| Step 3 desc | `Forward your calls to Sofia. She answers in French or English, books appointments, and sends you a summary.` |

### 4.5 Why Sofia

| Element | Text |
|---------|------|
| Section title (h2) | `Why Sofia instead of a DIY tool?` |
| Section subtitle | `The difference between a tool you configure yourself and a fully managed service.` |
| Sofia column heading | `Sofia AI` |
| Sofia point 1 | `Fully managed -- we set up everything for you` |
| Sofia point 2 | `Bilingual French and English, natural-sounding voice` |
| Sofia point 3 | `Customized for your business (hours, services, tone)` |
| Sofia point 4 | `Local support -- Laval and Montreal, we can meet in person` |
| Sofia point 5 | `Up and running in 24-48 hours` |
| Sofia price | `$39.99/mo` |
| Competitor column heading | `DIY tools` |
| Competitor point 1 | `You have to configure everything yourself` |
| Competitor point 2 | `English-only or robotic translations` |
| Competitor point 3 | `Generic setup, same voice for everyone` |
| Competitor point 4 | `Email-only support, often slow` |
| Competitor point 5 | `Hours of setup before your first call` |
| Competitor price | `$59/mo and up` |

### 4.6 Pricing

| Element | Text |
|---------|------|
| Section title (h2) | `One simple price. No surprises.` |
| Badge | `Launch offer` |
| Intro price | `$39.99` |
| Period | `/mo` |
| Regular price text | `$49.99/mo after the first 6 months` |
| Feature 1 | `Unlimited calls 24/7` |
| Feature 2 | `Answers in French and English` |
| Feature 3 | `Automatic appointment booking` |
| Feature 4 | `Text confirmation to your clients` |
| Feature 5 | `Summary of every call` |
| Feature 6 | `Custom setup included` |
| CTA button | `Start your free trial` |
| Note below CTA | `No contract. Cancel anytime.` |

### 4.7 FAQ

**Q1: Does Sofia sound like a robot?**
> No. Sofia uses a natural voice and is configured to speak the way you'd speak to your own clients. Most callers don't realize they're talking to an automated assistant.

**Q2: Does it work with my type of business?**
> Sofia is built for service businesses: hair salons, clinics, auto shops, restaurants, photo studios, and more. If your clients call to book appointments or ask questions, Sofia can help.

**Q3: How long does setup take?**
> Usually 24 to 48 hours. We handle all the configuration. You just need to send us your schedule and a list of your services.

**Q4: What happens if Sofia can't answer a question?**
> Sofia takes the client's message along with their phone number and sends you a text summary. You call back when you're free, with all the context you need.

**Q5: Can I cancel at any time?**
> Yes. There's no contract and no penalty. You can cancel by email or phone, and it takes effect immediately.

### 4.8 Lead Capture + Footer

| Element | Text |
|---------|------|
| Section title (h2) | `Ready to stop missing calls?` |
| Section subtitle | `Leave us your info. We'll contact you within 24 hours to set Sofia up for your business.` |
| Label: name | `Your name` |
| Placeholder: name | `John Smith` |
| Label: business | `Business name` |
| Placeholder: business | `Example Salon` |
| Label: phone | `Phone` |
| Placeholder: phone | `(514) 555-1234` |
| Label: email | `Email` |
| Placeholder: email | `john@examplesalon.ca` |
| Label: message | `Message (optional)` |
| Placeholder: message | `Tell us about your business...` |
| Submit button | `Send my request` |
| Footer copyright | `(c) 2026 Sofia AI. Laval, QC.` |
| Footer language link | `Francais` |

### 4.9 Thank-You Page

| Element | Text |
|---------|------|
| Heading | `Thank you!` |
| Body | `We got your request. We'll be in touch within 24 hours to get Sofia set up for your business.` |
| Link back | `Back to homepage` |

---

## 5. CSS Architecture

### 5.1 Custom Properties (defined on `:root`)

```css
:root {
  /* Colors */
  --color-primary: #0B7A75;       /* teal — trust, professionalism */
  --color-primary-dark: #065A56;  /* hover state for primary */
  --color-primary-light: #E8F5F4; /* light teal for backgrounds */
  --color-accent: #E8613C;        /* warm coral — CTA, attention */
  --color-accent-dark: #C94E2D;   /* hover state for accent */
  --color-text: #1A1A1A;          /* near-black body text */
  --color-text-light: #555555;    /* secondary text */
  --color-bg: #FFFFFF;            /* white background */
  --color-bg-alt: #F7F8FA;        /* light gray alternate sections */
  --color-border: #E2E5E9;        /* borders, dividers */
  --color-success: #1B8A3E;       /* form success */
  --color-error: #D93025;         /* form errors */

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;
  --font-size-base: 1rem;         /* 16px */
  --font-size-sm: 0.875rem;       /* 14px */
  --font-size-lg: 1.125rem;       /* 18px */
  --font-size-xl: 1.25rem;        /* 20px */
  --font-size-2xl: 1.5rem;        /* 24px */
  --font-size-3xl: 2rem;          /* 32px */
  --font-size-4xl: 2.5rem;        /* 40px — hero on desktop */

  /* Spacing (8px base scale) */
  --space-xs: 0.25rem;   /* 4px */
  --space-sm: 0.5rem;    /* 8px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */
  --space-3xl: 4rem;     /* 64px */
  --space-4xl: 6rem;     /* 96px */

  /* Layout */
  --container-max: 1120px;
  --container-padding: 1.25rem;    /* 20px on mobile */
  --section-padding: 4rem;         /* vertical padding per section */
  --header-height: 64px;

  /* Borders */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);

  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
}
```

### 5.2 Breakpoints (mobile-first)

```css
/* Default styles: 0px - 767px (mobile) */

/* Tablet */
@media (min-width: 768px) { ... }

/* Desktop */
@media (min-width: 1024px) { ... }

/* Wide desktop */
@media (min-width: 1280px) { ... }
```

**All layout starts mobile.** Tablet and desktop are additive overrides.

### 5.3 Global Styles

```
- Box-sizing: border-box on *, *::before, *::after
- Body: font-family var, color var(--color-text), bg var(--color-bg), line-height 1.6
- Smooth scroll: html { scroll-behavior: smooth; } with scroll-padding-top: var(--header-height)
- Container: max-width var(--container-max), margin 0 auto, padding 0 var(--container-padding)
- Section: padding var(--section-padding) 0
- Alternating section bg: .problem, .why-sofia, .faq get var(--color-bg-alt)
- Reset margins on h1-h6, p, ul, ol
- img: max-width 100%, height auto, display block
```

### 5.4 Component Patterns

#### Buttons (`.btn`)

```
Base: inline-flex, align-items center, justify-content center, font-weight 500,
      border-radius var(--radius-md), transition var(--transition-fast),
      cursor pointer, border none, text-decoration none
Sizes:
  .btn--sm: padding 0.5rem 1rem, font-size var(--font-size-sm)
  .btn--lg: padding 0.875rem 1.75rem, font-size var(--font-size-lg)
Variants:
  .btn--primary: bg var(--color-accent), color white
    :hover → bg var(--color-accent-dark)
    :focus-visible → outline 2px solid var(--color-accent), outline-offset 2px
  .btn--ghost: bg transparent, border 2px solid var(--color-primary), color var(--color-primary)
    :hover → bg var(--color-primary-light)
```

#### Section Titles (`.section-title`, `.section-subtitle`)

```
.section-title: font-size var(--font-size-2xl) on mobile, var(--font-size-3xl) on desktop,
                font-weight 700, margin-bottom var(--space-md), text-align center
.section-subtitle: font-size var(--font-size-lg), color var(--color-text-light),
                   text-align center, max-width 640px, margin 0 auto var(--space-2xl)
```

#### Sticky Header

```
.site-header: position sticky, top 0, z-index 100, bg white,
              border-bottom 1px solid var(--color-border),
              height var(--header-height)
              backdrop-filter: blur(8px) — optional subtle effect on scroll
.site-header__inner: flex, align-items center, justify-content space-between
Desktop: show nav links inline, hide hamburger
Mobile: hide nav links, show hamburger, mobile-nav is full-screen overlay
```

#### Hero Section

```
.hero: padding-top calc(var(--header-height) + var(--space-3xl)),
       padding-bottom var(--space-4xl),
       text-align center
.hero__title: font-size var(--font-size-3xl) mobile, var(--font-size-4xl) desktop,
              font-weight 700, line-height 1.15, max-width 720px, margin 0 auto
.hero__subtitle: font-size var(--font-size-lg), color var(--color-text-light),
                 max-width 560px, margin var(--space-lg) auto var(--space-xl)
.hero__actions: flex, gap var(--space-md), justify-content center, flex-wrap wrap
.hero__proof: font-size var(--font-size-sm), color var(--color-text-light),
              margin-top var(--space-xl)
```

#### Problem + Solution Grid

```
.problem__grid: On mobile, stacked vertically (gap var(--space-xl)).
                On tablet+, CSS Grid 2 columns (1fr 1fr), gap var(--space-2xl).
.problem__before: Styled with subtle red/warning left border or icon
.problem__after: Styled with green/success left border or icon
.problem__list li: padding-left with inline SVG icon (X for pain, checkmark for gain)
```

#### Steps (How It Works)

```
.steps: On mobile, stacked. On tablet+, 3-column grid.
.step: text-align center, padding var(--space-lg)
.step__number: width 48px, height 48px, border-radius 50%,
               bg var(--color-primary), color white, font-weight 700,
               display flex, align-items center, justify-content center,
               margin 0 auto var(--space-md), font-size var(--font-size-xl)
```

#### Comparison Cards (Why Sofia)

```
.comparison: On mobile, stacked. On tablet+, 2-column grid.
.comparison__card: border-radius var(--radius-lg), padding var(--space-xl),
                   border 1px solid var(--color-border)
.comparison__card--sofia: border-color var(--color-primary),
                          box-shadow var(--shadow-md),
                          position relative (slightly elevated look)
.comparison__card--other: bg var(--color-bg-alt), opacity 0.85 (slightly muted)
```

#### Pricing Card

```
.pricing__card: max-width 480px, margin 0 auto, text-align center,
                border-radius var(--radius-lg), padding var(--space-2xl),
                border 2px solid var(--color-primary), box-shadow var(--shadow-lg)
.pricing__badge: display inline-block, bg var(--color-accent), color white,
                 font-size var(--font-size-sm), font-weight 500,
                 padding var(--space-xs) var(--space-md),
                 border-radius var(--radius-full), margin-bottom var(--space-lg)
.pricing__amount: font-size 3.5rem, font-weight 700, color var(--color-primary)
.pricing__period: font-size var(--font-size-lg), color var(--color-text-light)
.pricing__regular: font-size var(--font-size-base), color var(--color-text-light),
                   margin-top var(--space-xs)
.pricing__features: text-align left, list-style none, padding 0,
                    margin var(--space-xl) 0
.pricing__features li: padding var(--space-sm) 0, padding-left 1.75rem,
                       background-image inline SVG checkmark (green)
.pricing__note: font-size var(--font-size-sm), color var(--color-text-light),
                margin-top var(--space-md)
```

#### FAQ Accordion

```
Uses native <details>/<summary> elements.
.faq__item: border-bottom 1px solid var(--color-border), padding var(--space-lg) 0
.faq__question: font-weight 500, font-size var(--font-size-lg), cursor pointer,
                display flex, justify-content space-between, align-items center,
                list-style none (hide default marker)
.faq__question::-webkit-details-marker { display: none; }
.faq__icon: transition transform var(--transition-base)
details[open] .faq__icon: transform rotate(180deg)
.faq__answer: padding-top var(--space-md), color var(--color-text-light),
              max-width 640px
```

#### Contact Form

```
.contact__inner: On mobile, stacked. On tablet+, 2-column grid
                 (text on left, form on right).
.form-group: margin-bottom var(--space-lg)
.form-label: display block, font-weight 500, margin-bottom var(--space-xs),
             font-size var(--font-size-sm)
.form-input: width 100%, padding var(--space-sm) var(--space-md),
             border 1px solid var(--color-border), border-radius var(--radius-md),
             font-size var(--font-size-base), font-family var(--font-family),
             transition border-color var(--transition-fast)
.form-input:focus: border-color var(--color-primary),
                   outline 2px solid var(--color-primary-light), outline-offset 0
.form-input--textarea: resize vertical
.form-input:invalid:not(:placeholder-shown): border-color var(--color-error)
```

#### Utility Classes

```
.visually-hidden: clip-rect based hidden (for honeypot and screen-reader-only content)
.container: max-width + margin auto + padding
```

### 5.5 Section Background Alternation

| Section | Background |
|---------|-----------|
| Header | `var(--color-bg)` (white) |
| Hero | `var(--color-bg)` (white) |
| Problem + Solution | `var(--color-bg-alt)` (light gray) |
| How It Works | `var(--color-bg)` (white) |
| Why Sofia | `var(--color-bg-alt)` (light gray) |
| Pricing | `var(--color-bg)` (white) |
| FAQ | `var(--color-bg-alt)` (light gray) |
| Contact + Footer | `var(--color-primary)` bg, white text (dark section for visual anchor) |

The contact section uses `var(--color-primary)` (teal) background with white text. This creates a strong visual anchor at the bottom of the page and makes the form stand out. Form inputs keep white background. The submit button uses `var(--color-accent)` (coral) on this dark background.

---

## 6. JavaScript Requirements

Single file: `js/main.js`. No dependencies. No build step.

### 6.1 Mobile Navigation Toggle

```
- hamburger button toggles .mobile-nav visibility
- Set aria-expanded on hamburger button
- Set hidden attribute on mobile-nav
- Close menu when a link is clicked (anchor navigation)
- Close menu on Escape key
- Trap focus inside mobile nav when open (Tab cycles through links and close button)
- Prevent body scroll when menu is open (document.body.style.overflow = 'hidden')
```

### 6.2 Smooth Scroll

```
- CSS handles smooth scroll via html { scroll-behavior: smooth; }
- JS: intercept anchor link clicks to ensure offset accounts for sticky header
  (scroll-padding-top in CSS should handle this, but add JS fallback for Safari)
- After scroll, update URL hash without causing a jump
```

### 6.3 FAQ Accordion (optional enhancement)

```
- The <details>/<summary> elements work natively without JS.
- JS enhancement (progressive): when one <details> opens, close the others
  (single-open accordion behavior). This is optional UX polish -- FAQ works without JS.
```

### 6.4 Form Validation

```
- Rely on native HTML5 validation (required, type=email, type=tel, pattern).
- JS enhancement: show inline error messages below invalid fields on blur and on submit.
- Error message pattern:
  - Field gets class .form-input--error (red border)
  - <span class="form-error" role="alert"> appears below input with message
- Error messages (FR):
  - name: "Veuillez entrer votre nom"
  - business: "Veuillez entrer le nom de votre entreprise"
  - phone: "Veuillez entrer un numero de telephone valide"
  - email: "Veuillez entrer une adresse courriel valide"
- Error messages (EN):
  - name: "Please enter your name"
  - business: "Please enter your business name"
  - phone: "Please enter a valid phone number"
  - email: "Please enter a valid email address"
- Determine language from <html lang="..."> attribute.
- On successful Netlify submission, page redirects to /merci or /en/thank-you.
```

### 6.5 Honeypot Anti-Spam

```
- The bot-field input is hidden via .visually-hidden CSS class.
- No JS needed — Netlify handles honeypot server-side via netlify-honeypot attribute.
- Do NOT hide the honeypot with display:none or visibility:hidden (bots detect that).
  Use the .visually-hidden clip-rect approach.
```

### 6.6 Header Scroll Behavior (optional)

```
- Add .site-header--scrolled class when user scrolls past 50px.
- This class adds box-shadow var(--shadow-sm) for a subtle elevation effect.
- Use IntersectionObserver or scroll event with requestAnimationFrame throttle.
```

### 6.7 No-JS Fallback

```
- Everything must work without JS. JS only enhances:
  - Mobile nav (without JS, hamburger is hidden and nav links show inline — use CSS :target or just show them)
  - FAQ accordion (native <details> works without JS)
  - Form validation (native HTML5 validation works without JS)
  - Header shadow (purely cosmetic)
- Test by disabling JS — page should be fully usable.
```

---

## 7. Netlify Configuration

### 7.1 netlify.toml

```toml
[build]
  publish = "website/"

# Redirect trailing slashes
[[redirects]]
  from = "/en"
  to = "/en/"
  status = 301

# French thank-you page
[[redirects]]
  from = "/merci"
  to = "/merci.html"
  status = 200

# English thank-you page
[[redirects]]
  from = "/en/thank-you"
  to = "/en/thank-you.html"
  status = 200

# Security headers
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; script-src 'self'"

# Cache static assets
[[headers]]
  for = "/images/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/css/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/js/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 7.2 _redirects

```
# Language redirects are handled by directory structure:
# / → website/index.html (French)
# /en/ → website/en/index.html (English)
# No explicit _redirects needed beyond netlify.toml.
# Keep this file empty or use for future redirects.
```

### 7.3 Netlify Forms Setup

The form must include these attributes to work with Netlify Forms:

```html
<form name="lead-capture" method="POST" data-netlify="true" netlify-honeypot="bot-field">
  <input type="hidden" name="form-name" value="lead-capture">
  <!-- honeypot field -->
  <!-- form fields -->
</form>
```

**Form name:** `lead-capture`

**Notification:** After deploying, Parviz must manually configure email notification in Netlify dashboard:
1. Go to Site settings > Forms > Form notifications
2. Add "Email notification" for the `lead-capture` form
3. Set recipient to Parviz's email address

**Hidden `lang` field:** Both FR and EN forms include `<input type="hidden" name="lang" value="fr">` (or `value="en"`) so Parviz can see which language version the lead came from.

### 7.4 hreflang Setup

Both `index.html` (FR) and `en/index.html` (EN) must include these `<link>` tags in `<head>`:

```html
<!-- In French page (index.html) -->
<link rel="alternate" hreflang="fr" href="https://callsofia.ca/">
<link rel="alternate" hreflang="en" href="https://callsofia.ca/en/">
<link rel="alternate" hreflang="x-default" href="https://callsofia.ca/">

<!-- In English page (en/index.html) -->
<link rel="alternate" hreflang="fr" href="https://callsofia.ca/">
<link rel="alternate" hreflang="en" href="https://callsofia.ca/en/">
<link rel="alternate" hreflang="x-default" href="https://callsofia.ca/">
```

### 7.5 Custom Domain

After Netlify deploy, Parviz configures `callsofia.ca` in Netlify dashboard:
1. Add custom domain in Site settings > Domain management
2. Point DNS (Cloudflare, GoDaddy, etc.) to Netlify's DNS or use CNAME
3. Enable HTTPS (Netlify auto-provisions Let's Encrypt cert)

This is a manual step -- nothing to configure in code.

---

## 8. SEO

### 8.1 Meta Tags — French (index.html)

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sofia AI — Receptionniste IA pour commerces locaux | Laval & Montreal</title>
<meta name="description" content="Sofia repond a vos appels 24/7, prend les rendez-vous et envoie les confirmations par texto. Service cle en main pour commerces locaux. 39,99$/mois.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://callsofia.ca/">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="Sofia AI — Receptionniste IA pour commerces locaux">
<meta property="og:description" content="Reponse 24/7, prise de rendez-vous automatique, confirmation par texto. Service cle en main a 39,99$/mois.">
<meta property="og:url" content="https://callsofia.ca/">
<meta property="og:image" content="https://callsofia.ca/images/og-image-fr.jpg">
<meta property="og:locale" content="fr_CA">
<meta property="og:locale:alternate" content="en_CA">
<meta property="og:site_name" content="Sofia AI">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Sofia AI — Receptionniste IA pour commerces locaux">
<meta name="twitter:description" content="Reponse 24/7, prise de rendez-vous automatique, confirmation par texto.">
<meta name="twitter:image" content="https://callsofia.ca/images/og-image-fr.jpg">
```

### 8.2 Meta Tags — English (en/index.html)

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sofia AI — AI Receptionist for Local Businesses | Laval & Montreal</title>
<meta name="description" content="Sofia answers your calls 24/7, books appointments, and sends text confirmations. Fully managed service for local businesses. $39.99/mo.">
<meta name="robots" content="index, follow">
<link rel="canonical" href="https://callsofia.ca/en/">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="Sofia AI — AI Receptionist for Local Businesses">
<meta property="og:description" content="24/7 call answering, automatic booking, text confirmations. Fully managed service at $39.99/mo.">
<meta property="og:url" content="https://callsofia.ca/en/">
<meta property="og:image" content="https://callsofia.ca/images/og-image-en.jpg">
<meta property="og:locale" content="en_CA">
<meta property="og:locale:alternate" content="fr_CA">
<meta property="og:site_name" content="Sofia AI">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Sofia AI — AI Receptionist for Local Businesses">
<meta name="twitter:description" content="24/7 call answering, automatic booking, text confirmations.">
<meta name="twitter:image" content="https://callsofia.ca/images/og-image-en.jpg">
```

### 8.3 Structured Data (JSON-LD)

Include in both pages, localized. Place in `<head>` or end of `<body>`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Sofia AI",
  "description": "Receptionniste IA pour commerces locaux a Laval et Montreal. Repond aux appels 24/7, prend les rendez-vous, envoie les confirmations par texto.",
  "url": "https://callsofia.ca",
  "areaServed": [
    { "@type": "City", "name": "Laval", "addressRegion": "QC", "addressCountry": "CA" },
    { "@type": "City", "name": "Montreal", "addressRegion": "QC", "addressCountry": "CA" }
  ],
  "priceRange": "$$",
  "knowsLanguage": ["fr", "en"],
  "offers": {
    "@type": "Offer",
    "name": "Sofia AI — Receptionniste IA",
    "price": "39.99",
    "priceCurrency": "CAD",
    "priceValidUntil": "2026-12-31",
    "description": "Service cle en main: reponse 24/7, prise de rendez-vous, confirmation par texto.",
    "url": "https://callsofia.ca/#pricing"
  }
}
</script>
```

For the English page, translate `name`, `description`, and the offer `description` to English.

### 8.4 robots.txt

```
User-agent: *
Allow: /

Sitemap: https://callsofia.ca/sitemap.xml
```

### 8.5 Sitemap

A `sitemap.xml` is not required at launch (2 pages). If needed later, Parviz can generate one manually or use a Netlify plugin. The robots.txt references it for forward-compatibility.

### 8.6 Favicon

Include in `<head>` of all pages:

```html
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/images/favicon-32x32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/images/favicon-16x16.png" type="image/png" sizes="16x16">
<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
```

### 8.7 Google Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap">
```

Use `font-display: swap` (handled by `&display=swap` parameter).

---

## 9. Accessibility

### 9.1 WCAG 2.1 AA Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Color contrast** | All text meets 4.5:1 ratio against its background. Large text (18px+ bold or 24px+) meets 3:1. Verify: --color-text (#1A1A1A) on white = 16.5:1. --color-text on --color-bg-alt (#F7F8FA) = ~15.3:1. White text on --color-primary (#0B7A75) = ~4.8:1. White text on --color-accent (#E8613C) = ~3.5:1 (use only for large text or buttons where minimum size is 18px bold). |
| **Focus indicators** | All interactive elements show visible focus ring. Use :focus-visible with 2px solid outline in accent or primary color, 2px offset. Never outline: none without replacement. |
| **Keyboard navigation** | All interactive elements reachable by Tab. Logical tab order follows visual order. Mobile nav traps focus when open. FAQ items toggleable with Enter/Space (native for details/summary). |
| **Semantic HTML** | Use header, nav, main, section, footer, h1-h3 hierarchy. One h1 per page. Headings follow logical order (no skipping h2 to h4). |
| **Landmark roles** | Implicit from semantic HTML. nav elements have aria-label to distinguish (main nav vs mobile nav vs footer). |
| **Alt text** | Logo img has alt="Sofia AI". Decorative SVG icons have aria-hidden="true". No content images (icons/illustrations only). |
| **Form labels** | Every input has a visible <label> with matching for/id. Required fields have required attribute (screen readers announce). Error messages use role="alert" for live announcement. |
| **Link purpose** | All links have descriptive text or aria-label. Language toggle has aria-label="Switch to English" / "Passer au francais". |
| **Touch targets** | Minimum 44x44px for all tappable elements on mobile. Buttons and nav links have sufficient padding. |
| **Motion** | Respect prefers-reduced-motion. Disable smooth scroll and transitions. |
| **Language** | html lang="fr" for French, html lang="en" for English. |

### 9.2 prefers-reduced-motion

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 9.3 prefers-color-scheme

Out of scope for v1. Light mode only.

---

## 10. Acceptance Criteria

Each criterion is binary pass/fail. The coder must validate all before requesting review.

### File Structure

- [ ] `website/index.html` exists and is valid HTML5 (passes W3C validator with zero errors)
- [ ] `website/en/index.html` exists and is valid HTML5
- [ ] `website/merci.html` exists (French thank-you page)
- [ ] `website/en/thank-you.html` exists (English thank-you page)
- [ ] `website/css/styles.css` exists (single stylesheet)
- [ ] `website/js/main.js` exists (single JS file)
- [ ] `website/robots.txt` exists
- [ ] `website/netlify.toml` exists at repo root or website/ root (verify Netlify picks it up)
- [ ] `website/_redirects` exists (can be empty placeholder)
- [ ] `website/_headers` exists
- [ ] `website/images/` directory exists with placeholder files or actual assets

### Content

- [ ] French page has all 8 sections with all draft copy from this spec
- [ ] English page has all 8 sections with all draft copy from this spec
- [ ] Pricing shows $39.99/mo intro and $49.99/mo regular in both languages
- [ ] "Free trial" CTA appears in hero, pricing, and header in both languages
- [ ] FAQ has exactly 5 questions in both languages
- [ ] Form has 5 fields: name, business, phone, email, message (optional)
- [ ] Honeypot field exists and is visually hidden
- [ ] Hidden `lang` field exists in both FR and EN forms with correct value

### Responsive

- [ ] Page renders correctly at 375px width (iPhone SE) — no horizontal scroll
- [ ] Page renders correctly at 768px width (tablet)
- [ ] Page renders correctly at 1280px width (desktop)
- [ ] Page renders correctly at 1920px width (wide desktop) — content does not stretch beyond max-width
- [ ] Mobile hamburger menu appears below 768px, desktop nav above 768px
- [ ] All touch targets are at least 44x44px on mobile

### Navigation

- [ ] Clicking header CTA scrolls to contact section
- [ ] Clicking hero CTA scrolls to contact section
- [ ] Clicking "How it works" / "Comment ca marche" scrolls to that section
- [ ] Clicking "Pricing" / "Tarifs" scrolls to that section
- [ ] Clicking "FAQ" scrolls to that section
- [ ] Sticky header remains visible on scroll
- [ ] Language toggle (EN/FR) navigates to the correct alternate page
- [ ] Mobile menu opens and closes correctly
- [ ] Mobile menu closes when a nav link is clicked
- [ ] Mobile menu closes on Escape key

### Forms

- [ ] Form submission works on Netlify (test after deploy: submit form, check Netlify Forms dashboard)
- [ ] Required fields show validation errors if submitted empty
- [ ] Email field rejects non-email input
- [ ] Phone field rejects clearly invalid input (fewer than 7 characters)
- [ ] After successful submit, user is redirected to /merci (FR) or /en/thank-you (EN)
- [ ] Thank-you pages display correctly and link back to homepage

### SEO & Meta

- [ ] French page has correct `<title>`, `<meta description>`, OG tags, and canonical URL
- [ ] English page has correct `<title>`, `<meta description>`, OG tags, and canonical URL
- [ ] Both pages have hreflang tags pointing to each other and x-default
- [ ] Both pages have JSON-LD structured data
- [ ] robots.txt is accessible at /robots.txt
- [ ] Favicon tags are present in both pages

### Accessibility

- [ ] HTML validates with zero errors on W3C validator
- [ ] Page has exactly one `<h1>` per page
- [ ] Heading hierarchy is sequential (no skipping levels)
- [ ] All form inputs have associated `<label>` elements
- [ ] All images have alt attributes
- [ ] Language toggle has aria-label
- [ ] Focus is visible on all interactive elements when using keyboard
- [ ] Tab order is logical (matches visual order)
- [ ] FAQ items are operable with keyboard (Enter/Space to toggle)
- [ ] Color contrast of body text on all backgrounds meets 4.5:1 ratio

### Performance

- [ ] Page loads with no external JS dependencies (no jQuery, no React, nothing)
- [ ] Page loads with only one external CSS dependency (Google Fonts)
- [ ] Total page weight (HTML + CSS + JS, excluding images) is under 50KB
- [ ] No render-blocking JS (script has `defer` attribute)

---

## 11. Out of Scope

The following are explicitly NOT part of this spec. Do not build them.

| Item | Reason |
|------|--------|
| Dark mode | Not needed for v1. Light mode only. |
| Blog / content pages | No content to publish yet. |
| Client dashboard / login | Backend not built yet. |
| Online payment / Stripe | Parviz handles billing manually at launch. |
| SMS notification on form submit | Listed as future add-on in blueprint. Email notification only at launch (configured in Netlify dashboard). |
| Analytics (Google Analytics, Plausible, etc.) | Parviz can add a Netlify plugin later. Not in initial build. |
| Cookie banner / GDPR | No cookies set by the site itself. Google Fonts is the only third-party resource. Revisit if analytics are added. |
| Animations / scroll effects | Keep it simple. No AOS, no parallax, no scroll-triggered animations. |
| Chat widget / live chat | Not part of the product at launch. |
| Multi-page site | Single landing page per language. No separate /about, /contact, etc. |
| CMS integration | Static HTML. No Netlify CMS, no headless CMS. |
| Image optimization pipeline | Coder should use reasonable image sizes. No automatic optimization tooling. |
| Sitemap.xml generation | Only 2 pages. Not worth automating. Can be manually created later if needed. |
| A/B testing | Not at launch. |
| Custom 404 page | Nice-to-have but not required for launch. Can be added later. |

---

## Appendix A: Color Contrast Verification

The coder must verify these contrast ratios using a tool like WebAIM Contrast Checker before marking accessibility criteria as passing.

| Foreground | Background | Use | Minimum Ratio | Expected Ratio |
|-----------|-----------|-----|---------------|----------------|
| #1A1A1A | #FFFFFF | Body text on white | 4.5:1 | ~16.5:1 |
| #1A1A1A | #F7F8FA | Body text on alt bg | 4.5:1 | ~15.3:1 |
| #555555 | #FFFFFF | Secondary text on white | 4.5:1 | ~7.5:1 |
| #555555 | #F7F8FA | Secondary text on alt bg | 4.5:1 | ~7.0:1 |
| #FFFFFF | #0B7A75 | White text on teal bg | 4.5:1 | ~4.8:1 |
| #FFFFFF | #E8613C | White CTA button text | 3:1 (large) | ~3.5:1 |
| #0B7A75 | #FFFFFF | Teal text/links on white | 4.5:1 | ~4.8:1 |

**Note on accent color:** White text on #E8613C (coral) meets the 3:1 ratio for large text (buttons are 18px+ bold) but does NOT meet 4.5:1 for normal text. The coder must ensure the coral color is only used for buttons and large bold elements, never for small body text on white backgrounds.

## Appendix B: Font Loading Fallback

If Google Fonts is slow or blocked, the font stack falls back to system fonts. The CSS must not visually break without Inter loaded.

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

## Appendix C: Logo Placeholder

Until Parviz provides a final logo, the coder should create a simple SVG text logo:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40">
  <text x="0" y="28" font-family="Inter, sans-serif" font-weight="700" font-size="24" fill="#0B7A75">
    Sofia
  </text>
  <text x="72" y="28" font-family="Inter, sans-serif" font-weight="400" font-size="24" fill="#1A1A1A">
    AI
  </text>
</svg>
```

This is a placeholder. Replace with a proper logo file when available.
