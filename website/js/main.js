/**
 * Sofia AI — Marketing Website JavaScript
 * No dependencies. Progressive enhancement only.
 * Everything works without JS (native HTML5).
 */

(function () {
  'use strict';

  // Remove no-js class (added in HTML for CSS fallback)
  document.documentElement.classList.remove('no-js');

  // ---------- Mobile Navigation Toggle ----------
  const hamburger = document.querySelector('.site-header__hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  const mobileNavLinks = mobileNav ? mobileNav.querySelectorAll('a') : [];
  const body = document.body;

  function openMobileNav() {
    if (!hamburger || !mobileNav) return;
    hamburger.setAttribute('aria-expanded', 'true');
    mobileNav.removeAttribute('hidden');
    body.style.overflow = 'hidden';
    // Focus first link in mobile nav
    if (mobileNavLinks.length > 0) {
      mobileNavLinks[0].focus();
    }
  }

  function closeMobileNav() {
    if (!hamburger || !mobileNav) return;
    hamburger.setAttribute('aria-expanded', 'false');
    mobileNav.setAttribute('hidden', '');
    body.style.overflow = '';
    hamburger.focus();
  }

  function isMobileNavOpen() {
    return hamburger && hamburger.getAttribute('aria-expanded') === 'true';
  }

  if (hamburger) {
    hamburger.addEventListener('click', function () {
      if (isMobileNavOpen()) {
        closeMobileNav();
      } else {
        openMobileNav();
      }
    });
  }

  // Close mobile nav when a link is clicked
  mobileNavLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      if (isMobileNavOpen()) {
        closeMobileNav();
      }
    });
  });

  // Close mobile nav on Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isMobileNavOpen()) {
      closeMobileNav();
    }
  });

  // Trap focus inside mobile nav when open (includes hamburger button)
  if (mobileNav) {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !isMobileNavOpen()) return;

      var navFocusable = Array.from(mobileNav.querySelectorAll(
        'a[href], button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
      ));
      // Include the hamburger so users can tab to it to close the menu
      var focusableElements = hamburger ? [hamburger].concat(navFocusable) : navFocusable;
      if (focusableElements.length === 0) return;

      var firstEl = focusableElements[0];
      var lastEl = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    });
  }

  // ---------- Header Scroll Shadow ----------
  var header = document.getElementById('site-header');

  if (header) {
    var scrollThreshold = 50;
    var ticking = false;

    function updateHeaderShadow() {
      if (window.scrollY > scrollThreshold) {
        header.classList.add('site-header--scrolled');
      } else {
        header.classList.remove('site-header--scrolled');
      }
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(updateHeaderShadow);
        ticking = true;
      }
    }, { passive: true });

    // Run once on load
    updateHeaderShadow();
  }

  // ---------- Smooth Scroll Fallback (Safari) ----------
  // CSS scroll-behavior: smooth handles most browsers.
  // This JS ensures the sticky header offset is respected everywhere.
  var anchorLinks = document.querySelectorAll('a[href^="#"]');

  anchorLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;

      var target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();
      var headerHeight = header ? header.offsetHeight : 0;
      var targetTop = target.getBoundingClientRect().top + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: targetTop,
        behavior: 'smooth'
      });

      // Update URL hash without jump
      if (history.pushState) {
        history.pushState(null, null, targetId);
      }
    });
  });

  // ---------- FAQ Accordion (single-open behavior) ----------
  var faqItems = document.querySelectorAll('.faq__item');

  faqItems.forEach(function (item) {
    item.addEventListener('toggle', function () {
      if (this.open) {
        faqItems.forEach(function (other) {
          if (other !== item && other.open) {
            other.removeAttribute('open');
          }
        });
      }
    });
  });

  // ---------- Form Validation ----------
  var lang = document.documentElement.getAttribute('lang') || 'fr';

  var errorMessages = {
    fr: {
      name: 'Veuillez entrer votre nom',
      business: 'Veuillez entrer le nom de votre entreprise',
      phone: 'Veuillez entrer un numero de telephone valide',
      email: 'Veuillez entrer une adresse courriel valide'
    },
    en: {
      name: 'Please enter your name',
      business: 'Please enter your business name',
      phone: 'Please enter a valid phone number',
      email: 'Please enter a valid email address'
    }
  };

  var messages = errorMessages[lang] || errorMessages.fr;

  var form = document.querySelector('.contact__form');

  if (form) {
    var requiredFields = form.querySelectorAll('[required]');

    function showError(field, message) {
      clearError(field);
      field.classList.add('form-input--error');
      var errorSpan = document.createElement('span');
      errorSpan.className = 'form-error';
      errorSpan.setAttribute('role', 'alert');
      errorSpan.textContent = message;
      field.parentNode.appendChild(errorSpan);
    }

    function clearError(field) {
      field.classList.remove('form-input--error');
      var existing = field.parentNode.querySelector('.form-error');
      if (existing) {
        existing.remove();
      }
    }

    function validateField(field) {
      var name = field.getAttribute('name');
      var msg = messages[name];

      if (!field.validity.valid && msg) {
        showError(field, msg);
        return false;
      } else {
        clearError(field);
        return true;
      }
    }

    // Validate on blur
    requiredFields.forEach(function (field) {
      field.addEventListener('blur', function () {
        // Only validate if user has interacted (not placeholder-shown)
        if (field.value.trim() !== '') {
          validateField(field);
        }
      });

      // Clear error on input
      field.addEventListener('input', function () {
        if (field.validity.valid) {
          clearError(field);
        }
      });
    });

    // Validate on submit
    form.addEventListener('submit', function (e) {
      var allValid = true;

      requiredFields.forEach(function (field) {
        if (!validateField(field)) {
          allValid = false;
        }
      });

      if (!allValid) {
        e.preventDefault();
        // Focus first invalid field
        var firstInvalid = form.querySelector('.form-input--error');
        if (firstInvalid) {
          firstInvalid.focus();
        }
      }
    });
  }

})();
