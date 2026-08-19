/**
 * EXCEL AUTOMOTIVES — MAIN JAVASCRIPT
 * Site interactions, MOT checker, navigation, animations
 */

'use strict';

/* ============================================================
   NAVIGATION
   ============================================================ */
const header     = document.querySelector('.site-header');
const navToggle  = document.querySelector('.nav-toggle');
const mobileNav  = document.querySelector('.mobile-nav');

// Sticky header on scroll
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;
  if (currentScroll > 60) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
  lastScroll = currentScroll;
}, { passive: true });

// Mobile nav toggle
if (navToggle && mobileNav) {
  navToggle.addEventListener('click', () => {
    const isOpen = navToggle.classList.toggle('open');
    mobileNav.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    navToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close on outside click
  mobileNav.addEventListener('click', (e) => {
    if (e.target === mobileNav) {
      navToggle.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
      navToggle.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
      navToggle.focus();
    }
  });
}

/* ============================================================
   SCROLL REVEAL ANIMATIONS
   ============================================================ */
const revealElements = document.querySelectorAll('.reveal');

if (revealElements.length > 0) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));
}

/* ============================================================
   MOT CHECKER
   Connects to the public DVLA MOT History API where available.
   Full UI & integration layer built — API key required to
   activate live results. Degrades gracefully with booking CTA.
   ============================================================ */
const motForm   = document.getElementById('motForm');
const regInput  = document.getElementById('regInput');
const motResult = document.getElementById('motResult');
const motBtn    = document.getElementById('motBtn');

if (motForm && regInput) {

  // Format registration as user types
  regInput.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\s+/g, '').toUpperCase();
    // Auto-insert space for standard UK format: XX00 XXX
    if (val.length > 4) {
      val = val.slice(0, 4) + ' ' + val.slice(4, 7);
    }
    e.target.value = val;
  });

  motForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const reg = regInput.value.replace(/\s/g, '').toUpperCase();

    if (!reg || reg.length < 2) {
      regInput.focus();
      return;
    }

    motBtn.disabled = true;
    motBtn.textContent = 'Checking…';

    try {
      // DVLA MOT History API — requires API key
      // Documentation: https://dvsa.github.io/mot-history-api-documentation/
      // To activate: supply API key in fetch headers below
      const DVLA_API_KEY = ''; // Add API key here

      if (!DVLA_API_KEY) {
        // Graceful fallback — direct to booking
        showMotFallback(reg);
        return;
      }

      const response = await fetch(
        `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${reg}`,
        {
          headers: {
            'Accept': 'application/json+v6',
            'x-api-key': DVLA_API_KEY
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          showMotResult({ status: 'not-found', reg });
        } else {
          showMotFallback(reg);
        }
        return;
      }

      const data = await response.json();
      processMotData(data, reg);

    } catch (err) {
      console.error('MOT check error:', err);
      showMotFallback(reg);
    } finally {
      motBtn.disabled = false;
      motBtn.textContent = 'Check MOT Status';
    }
  });
}

function processMotData(data, reg) {
  if (!data || !data.registration) {
    showMotFallback(reg);
    return;
  }

  const vehicle   = data;
  const tests     = data.motTests || [];
  const latestMot = tests.length > 0 ? tests[0] : null;

  let status = 'unknown';
  let expiry = null;

  if (latestMot) {
    expiry = new Date(latestMot.expiryDate);
    const now  = new Date();
    const diff = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (latestMot.testResult === 'PASSED') {
      if (diff < 0)       { status = 'expired'; }
      else if (diff <= 30) { status = 'due'; }
      else                 { status = 'valid'; }
    } else {
      status = 'failed';
    }
  }

  showMotResult({ status, reg, vehicle, expiry, latestMot });
}

function showMotResult({ status, reg, vehicle = null, expiry = null, latestMot = null }) {
  if (!motResult) return;

  let badgeClass = 'badge--pass';
  let badgeText  = 'MOT Valid';
  let message    = '';

  switch (status) {
    case 'valid':
      badgeClass = 'badge--pass';
      badgeText  = 'MOT Valid';
      const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : null;
      message = `Expires ${expiry ? expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'unknown'}${daysLeft ? ` — ${daysLeft} days remaining` : ''}`;
      break;
    case 'due':
      badgeClass = 'badge--due';
      badgeText  = 'Due Soon';
      message    = `Expires ${expiry ? expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'soon'} — book now to avoid lapsing.`;
      break;
    case 'expired':
    case 'failed':
      badgeClass = 'badge--expired';
      badgeText  = status === 'expired' ? 'MOT Expired' : 'MOT Failed';
      message    = 'Your vehicle requires an MOT. Book with Excel today.';
      break;
    case 'not-found':
      badgeClass = 'badge--due';
      badgeText  = 'Not Found';
      message    = 'We couldn\'t find a record for that registration. Please check and try again, or call us.';
      break;
    default:
      badgeClass = 'badge--due';
      badgeText  = 'Check Needed';
      message    = 'Please call us to confirm your MOT status and book an appointment.';
  }

  motResult.innerHTML = `
    <div class="result-status">
      <span class="badge ${badgeClass}">${badgeText}</span>
      ${reg ? `<strong style="color:var(--white);font-family:'Barlow Condensed',sans-serif;font-size:1.1rem;letter-spacing:0.1em">${reg}</strong>` : ''}
    </div>
    ${vehicle ? `<div class="vehicle-info" style="margin-bottom:0.75rem"><strong>${vehicle.make || ''} ${vehicle.model || ''}</strong> ${vehicle.colour ? '· ' + vehicle.colour : ''}</div>` : ''}
    <p style="font-size:0.875rem;color:var(--muted);margin-bottom:0.75rem">${message}</p>
    <a href="contact.html?service=mot" class="btn btn--primary btn--sm">Book an MOT</a>
  `;

  motResult.classList.add('show');
}

function showMotFallback(reg) {
  if (!motResult) return;
  motResult.innerHTML = `
    <div class="result-status">
      <span class="badge badge--due">Registration: ${reg}</span>
    </div>
    <p style="font-size:0.875rem;color:var(--muted);margin-bottom:0.75rem">
      MOT check requires a connection to the DVLA service. To confirm your MOT status,
      call us on <a href="tel:01246455863" style="color:var(--blue-bright)">01246 455 863</a> or book online now.
    </p>
    <a href="contact.html?service=mot" class="btn btn--primary btn--sm">Book an MOT</a>
  `;
  motResult.classList.add('show');
}

/* ============================================================
   FAQ ACCORDION
   ============================================================ */
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
  const question = item.querySelector('.faq-question');
  if (!question) return;

  question.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');

    // Close all other items
    faqItems.forEach(other => {
      if (other !== item) {
        other.classList.remove('open');
        other.querySelector('.faq-question')?.setAttribute('aria-expanded', 'false');
      }
    });

    item.classList.toggle('open', !isOpen);
    question.setAttribute('aria-expanded', !isOpen);
  });
});

/* ============================================================
   OPENING HOURS STATUS
   ============================================================ */
function updateOpeningStatus() {
  const statusEl = document.getElementById('openingStatus');
  if (!statusEl) return;

  const now      = new Date();
  const day      = now.getDay(); // 0=Sun, 1=Mon…6=Sat
  const hour     = now.getHours();
  const minute   = now.getMinutes();
  const time     = hour * 60 + minute;

  // Opening hours: Mon(1) Tue(2) Fri(5): 8–17, Wed(3) Thu(4): 8–18
  // Sat(6) Sun(0): closed
  let isOpen     = false;
  let statusText = 'Closed today';

  if (day === 0 || day === 6) {
    statusText = 'Closed — reopens Monday 8am';
    isOpen     = false;
  } else {
    const open   = 8 * 60;    // 8:00am
    const closeA = 17 * 60;   // 5:00pm (Mon, Tue, Fri)
    const closeB = 18 * 60;   // 6:00pm (Wed, Thu)
    const close  = (day === 3 || day === 4) ? closeB : closeA;
    const closeFormatted = (day === 3 || day === 4) ? '6pm' : '5pm';

    if (time >= open && time < close) {
      isOpen     = true;
      statusText = `Open now — closes ${closeFormatted}`;
    } else if (time < open) {
      statusText = `Opens today at 8am`;
      isOpen     = false;
    } else {
      // After hours
      if (day === 5) { // Friday
        statusText = 'Closed — reopens Monday 8am';
      } else {
        statusText = 'Closed — reopens tomorrow 8am';
      }
      isOpen = false;
    }
  }

  statusEl.textContent = statusText;
  statusEl.className   = `hours-status ${isOpen ? 'open' : 'closed'}`;
}

updateOpeningStatus();
setInterval(updateOpeningStatus, 60000); // update every minute

/* ============================================================
   ANIMATED STAT COUNTERS
   ============================================================ */
function animateCounter(el, target, duration = 1500) {
  const start    = performance.now();
  const isSuffix = el.dataset.suffix || '';
  const isFloat  = target % 1 !== 0;

  function update(time) {
    const elapsed  = time - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic
    const eased    = 1 - Math.pow(1 - progress, 3);
    const value    = isFloat
      ? (eased * target).toFixed(1)
      : Math.round(eased * target);
    el.textContent = value + isSuffix;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

const statNumbers = document.querySelectorAll('.stat-number');
if (statNumbers.length > 0) {
  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el     = entry.target;
        const target = parseFloat(el.dataset.target);
        if (!isNaN(target)) {
          animateCounter(el, target);
        }
        statsObserver.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  statNumbers.forEach(el => statsObserver.observe(el));
}

/* ============================================================
   BOOKING FORM — SMART PREFILL FROM URL PARAMS
   ============================================================ */
function prefillFromURL() {
  const params  = new URLSearchParams(window.location.search);
  const service = params.get('service');
  const reg     = params.get('reg');

  if (service) {
    const serviceSelect = document.getElementById('serviceType');
    if (serviceSelect) {
      // Map URL param to select option value
      const serviceMap = {
        'mot':          'MOT Test',
        'service':      'Car Servicing',
        'repair':       'General Repair',
        'volvo':        'Volvo Specialist',
        'tyres':        'Tyres & Wheels',
        'aircon':       'Air Conditioning',
        'clutch':       'Clutch Repair'
      };
      const optionValue = serviceMap[service] || service;
      Array.from(serviceSelect.options).forEach(opt => {
        if (opt.value === optionValue) {
          opt.selected = true;
        }
      });
    }
  }

  if (reg) {
    const regField = document.getElementById('vehicleReg');
    if (regField) regField.value = reg.toUpperCase();
  }
}

prefillFromURL();

/* ============================================================
   BOOKING FORM SUBMISSION
   ============================================================ */
const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = bookingForm.querySelector('[type="submit"]');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';

    // Simulate submission (wire to actual backend/email handler)
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Show success state
    bookingForm.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem">
        <div style="width:56px;height:56px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3 style="color:var(--white);font-size:1.375rem;font-weight:700;margin-bottom:0.75rem">Booking Request Received</h3>
        <p style="color:var(--muted);font-size:0.875rem;line-height:1.65;max-width:380px;margin:0 auto">
          Thank you. We'll confirm your appointment within a few hours.
          If you need us urgently, please call <a href="tel:01246455863" style="color:var(--blue-bright)">01246 455 863</a>.
        </p>
      </div>
    `;
  });
}

/* ============================================================
   REVIEWS TRACK — DUPLICATE FOR INFINITE LOOP
   ============================================================ */
const reviewsTrack = document.querySelector('.reviews-track');
if (reviewsTrack) {
  const cards = reviewsTrack.innerHTML;
  reviewsTrack.innerHTML = cards + cards; // duplicate
}

/* ============================================================
   SMOOTH SCROLL FOR ANCHOR LINKS
   ============================================================ */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', (e) => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});
