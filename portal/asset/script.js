// ─── SCROLL REVEAL ───
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal, .why-card, .step').forEach(el => {
  revealObserver.observe(el);
});

// ─── HAMBURGER MENU ───
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuClose = document.getElementById('mobileMenuClose');

if (hamburgerBtn && mobileMenu) {
  hamburgerBtn.addEventListener('click', () => {
    mobileMenu.classList.add('open');
    document.body.style.overflow = 'hidden';
  });

  const closeMenu = () => {
    mobileMenu.classList.remove('open');
    document.body.style.overflow = '';
  };

  mobileMenuClose.addEventListener('click', closeMenu);

  // Close on link click
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on overlay click
  mobileMenu.addEventListener('click', (e) => {
    if (e.target === mobileMenu) closeMenu();
  });
}

// ─── STICKY BAR ───
const stickyBar = document.getElementById('stickyBar');
window.addEventListener('scroll', () => {
  if (window.scrollY > 500) {
    stickyBar.classList.add('visible');
  } else {
    stickyBar.classList.remove('visible');
  }
});

// ─── RIPPLE ON SUBMIT ───
const submitBtn = document.getElementById('submitBtn');
if (submitBtn) {
  submitBtn.addEventListener('click', function (e) {
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
    this.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });
}

// ─── FORM SUBMISSION ───

/* Helper: show a validation hint below an input */
function showFieldError(el, msg) {
  el.style.borderColor = '#ef4444';
  el.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.18)';

  // Remove any old hint
  const oldHint = el.parentElement.querySelector('.field-hint');
  if (oldHint) oldHint.remove();

  const hint = document.createElement('span');
  hint.className = 'field-hint';
  hint.style.cssText = 'display:block;color:#ef4444;font-size:0.78rem;margin-top:4px;padding-left:4px;';
  hint.textContent = msg;
  el.parentElement.appendChild(hint);

  setTimeout(() => {
    el.style.borderColor = '';
    el.style.boxShadow = '';
    hint.remove();
  }, 3000);
}

const admissionForm = document.getElementById('admissionForm');
if (admissionForm) {
  admissionForm.addEventListener('submit', function (e) {
    e.preventDefault();

    let valid = true;

    // ── Required text fields ──
    ['studentName', 'parentName'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value.trim()) {
        showFieldError(el, 'This field is required.');
        valid = false;
      }
    });

    // ── Class selection ──
    const cls = document.getElementById('classApplying');
    if (cls && !cls.value) {
      cls.style.borderColor = '#ef4444';
      cls.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.18)';
      valid = false;
      setTimeout(() => { cls.style.borderColor = ''; cls.style.boxShadow = ''; }, 3000);
    }

    // ── Phone: exactly 10 digits, starts with 6-9 ──
    const phoneEl = document.getElementById('phone');
    if (phoneEl) {
      const phoneVal = phoneEl.value.trim();
      const phoneRegex = /^[6-9][0-9]{9}$/;
      if (!phoneVal) {
        showFieldError(phoneEl, 'Phone number is required.');
        valid = false;
      } else if (!/^\d+$/.test(phoneVal)) {
        showFieldError(phoneEl, 'Phone number must contain digits only.');
        valid = false;
      } else if (phoneVal.length !== 10) {
        showFieldError(phoneEl, `Phone must be exactly 10 digits (you entered ${phoneVal.length}).`);
        valid = false;
      } else if (!phoneRegex.test(phoneVal)) {
        showFieldError(phoneEl, 'Enter a valid Indian mobile number (starts with 6–9).');
        valid = false;
      }
    }

    // ── Email: strict format check ──
    const emailEl = document.getElementById('email');
    if (emailEl) {
      const emailVal = emailEl.value.trim();
      const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
      if (!emailVal) {
        showFieldError(emailEl, 'Email address is required.');
        valid = false;
      } else if (!emailRegex.test(emailVal)) {
        showFieldError(emailEl, 'Enter a valid email address (e.g. name@gmail.com).');
        valid = false;
      }
    }

    if (!valid) return;

    const btn = document.getElementById('submitBtn');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting…';
      btn.disabled = true;
    }

    setTimeout(() => {
      if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submit Application';
        btn.disabled = false;
      }

      submitAdmissionToDB();

      document.getElementById('admissionForm').reset();
      const successPopup = document.getElementById('successPopup');
      if (successPopup) successPopup.classList.add('show');

      // decrement seat count for urgency
      const sc = document.getElementById('seatCount');
      if (sc) {
        const cur = parseInt(sc.textContent);
        if (cur > 1) sc.textContent = cur - 1;
      }
    }, 1400);
  });

  // ── Phone: block non-numeric key presses live ──
  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(0, 10);
    });
    phoneInput.addEventListener('keypress', function (e) {
      if (!/[0-9]/.test(e.key)) e.preventDefault();
    });
  }
}

// ─── SELECT STYLE FIX ───
const classApplying = document.getElementById('classApplying');
if (classApplying) {
  classApplying.addEventListener('change', function () {
    this.classList.add('filled');
  });
}

// ─── SEAT COUNTER ANIMATION ───

async function fetchTotalSeats() {
  try {
    const res = await fetch('/api/seats');
    const data = await res.json();
    return Object.values(data).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  } catch (e) {
    return 24; // fallback default
  }
}

function animateCounter(target) {
  const el = document.getElementById('seatCount');
  if (!el) return;
  const start = Math.min(target + 8, target + Math.floor(target * 0.15));
  let count = start;
  el.textContent = count;
  const interval = setInterval(() => {
    if (count <= target) { clearInterval(interval); el.textContent = target; return; }
    count--;
    el.textContent = count;
  }, 60);
}

let urgencyObserverFired = false;
const urgencyObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !urgencyObserverFired) {
    urgencyObserverFired = true;
    urgencyObserver.disconnect();
    fetchTotalSeats().then(total => animateCounter(total));
  }
}, { threshold: 0.4 });
const urgencyEl = document.querySelector('.urgency');
if (urgencyEl) urgencyObserver.observe(urgencyEl);


// ─── CLOSE POPUP ON OUTSIDE CLICK ───
const successPopupEl = document.getElementById('successPopup');
if (successPopupEl) {
  successPopupEl.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('show');
  });
}

// ─── SUBMIT TO DATABASE ───
async function submitAdmissionToDB() {
  let name = document.getElementById("studentName").value;
  let parent = document.getElementById("parentName").value;
  let className = document.getElementById("classApplying").value;
  let phone = document.getElementById("phone").value;
  let email = document.getElementById("email").value;
  let message = document.getElementById("message").value;

  try {
    let res = await fetch('/api/admissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName: name, parentName: parent, classApplying: className, phone, email, message })
    });
    let data = await res.json();
    console.log("Submit Response:", data);
  } catch (e) {
    console.error("Error submitting form", e);
  }
}

// ─── WELCOME POPUP & SLIDESHOW ───
window.addEventListener('DOMContentLoaded', () => {
  const welcomePopup = document.getElementById('welcomePopup');
  const closeBtn = document.getElementById('welcomeClose');
  const applyBtn = document.getElementById('welcomeApplyBtn');
  const slides = document.querySelectorAll('#welcomeSlides .slide');

  if (welcomePopup && slides.length > 0) {
    // Show popup after a short delay
    setTimeout(() => {
      welcomePopup.classList.add('show');
    }, 600);

    // Close logic
    const closePopup = () => welcomePopup.classList.remove('show');
    closeBtn.addEventListener('click', closePopup);
    applyBtn.addEventListener('click', closePopup);
    welcomePopup.addEventListener('click', (e) => {
      if (e.target === welcomePopup) closePopup();
    });

    // Slideshow logic
    let currentSlide = 0;
    slides[currentSlide].classList.add('active');

    setInterval(() => {
      slides[currentSlide].classList.remove('active');
      currentSlide = (currentSlide + 1) % slides.length;
      slides[currentSlide].classList.add('active');
    }, 3500);
  }

  // Hero Background Slideshow logic
  const heroSlides = document.querySelectorAll('#heroBgSlider .bg-slide');
  if (heroSlides.length > 0) {
    let currentHeroSlide = 0;
    setInterval(() => {
      heroSlides[currentHeroSlide].classList.remove('active');
      currentHeroSlide = (currentHeroSlide + 1) % heroSlides.length;
      heroSlides[currentHeroSlide].classList.add('active');
    }, 5000);
  }
});

// ─── FETCH NOTICES FOR HOMEPAGE ───
window.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('publicNotices');
  if (!container) return;

  try {
    const res = await fetch('/api/notices');
    const notices = await res.json();

    container.innerHTML = '';
    if (notices.length === 0) {
      container.innerHTML = '<p style="text-align:center; color: #6b7280;">No active notices at the moment.</p>';
      return;
    }

    notices.forEach(n => {
      container.innerHTML += `
        <div style="background: white; border: 1px solid #eee; border-left: 4px solid var(--gold); border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
          <h4 style="color: var(--blue); margin-bottom: 8px; font-size: 1.1rem;">${n.title}</h4>
          <p style="color: #4b5563; font-size: 0.95rem; margin-bottom: 12px;">${n.content}</p>
          <span style="font-size: 0.8rem; color: #9ca3af;">Posted on: ${new Date(n.created_at).toLocaleDateString()}</span>
        </div>
      `;
    });
  } catch (e) {
    container.innerHTML = '<p style="text-align:center; color: #ef4444;">Failed to load announcements.</p>';
  }
});

// ─── FETCH DYNAMIC WEBSITE CONTENT ───
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const resContent = await fetch('/api/content');
    const contentData = await resContent.json();
    if (contentData.hero_headline) {
      const banner = document.getElementById('dynBannerText');
      const headline = document.getElementById('dynHeroHeadline');
      const subtitle = document.getElementById('dynHeroSubtitle');

      if (banner) banner.innerHTML = '🎓 <strong>' + contentData.admissions_banner + '</strong>';
      if (headline) headline.innerHTML = contentData.hero_headline;
      if (subtitle) subtitle.innerHTML = contentData.hero_subtitle;
      if (contentData.academic_year) {
        document.querySelectorAll('.dyn-academic-year').forEach(el => {
          el.textContent = contentData.academic_year;
        });
      }
    }
  } catch (e) {
    console.log("Failed to load dynamic content", e);
  }

  // Update Copyright Year Dynamically
  document.querySelectorAll('.dyn-copyright-year').forEach(el => {
    el.textContent = new Date().getFullYear();
  });
});

// ─── ADMISSION STATUS: SHOW/HIDE BASED ON ADMIN SETTING ───
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/admission-status');
    const data = await res.json();
    const isOpen = data.admission_open !== false;

    if (!isOpen) {
      // ── Suppress welcome popup (also cancels it if timer already fired) ──
      const welcomePopup = document.getElementById('welcomePopup');
      if (welcomePopup) {
        welcomePopup.style.display = 'none';
        welcomePopup.classList.remove('show');
      }

      // ── Hide sticky bottom bar ──
      const stickyBar = document.getElementById('stickyBar');
      if (stickyBar) stickyBar.style.display = 'none';

      // ── Hide hero "Apply Now" CTA button ──
      const heroApplyBtn = document.querySelector('.hero-btns .btn-primary');
      if (heroApplyBtn) heroApplyBtn.style.display = 'none';

      // ── Hide navbar Apply Now CTA ──
      // const navCtaList = document.querySelectorAll('.nav-cta[href="admission.html"]');
      // navCtaList.forEach(el => el.style.display = 'none');

      // ── Hide mobile menu Apply Now ──
      // const mobileCtaList = document.querySelectorAll('.mobile-menu-cta[href="admission.html"]');
      // mobileCtaList.forEach(el => el.style.display = 'none');

      // ── Replace urgency section with "closed" message ──
      const urgencySection = document.querySelector('.urgency');
      if (urgencySection) {
        urgencySection.innerHTML = `
          <div class="urgency-badge" style="background:rgba(231,76,60,0.15);color:#e74c3c;border:1px solid rgba(231,76,60,0.3);">
            🔒 Admissions Closed
          </div>
          <h2 style="color:white;">Admissions<br><span style="color:#e74c3c;">Are Currently Closed.</span></h2>
          <p style="color:rgba(255,255,255,0.72);">We are not accepting new applications for the current session at this time. Please check back later or contact the school office for more information.</p>
          <br><br>
          <a href="#contact" class="btn-primary" style="font-size:1.08rem;padding:16px 44px;background:rgba(255,255,255,0.12);color:white;box-shadow:none;border:1.5px solid rgba(255,255,255,0.3);">
            Contact School Office
          </a>`;
      }

      // ── Replace admission form section with closed notice ──
      const formSection = document.getElementById('form');
      if (formSection) {
        formSection.innerHTML = `
          <div style="text-align:center;padding:60px 20px;max-width:600px;margin:0 auto;">
            <div style="font-size:4rem;margin-bottom:20px;">🔒</div>
            <h2 class="section-title" style="margin-bottom:16px;">Admissions <span style="color:#e74c3c;">Closed</span></h2>
            <p class="section-sub" style="margin:0 auto 32px;text-align:center;">
              Applications for the current session are currently not being accepted.
              Please contact the school office to be notified when admissions reopen.
            </p>
            <a href="#contact" class="btn-primary" style="display:inline-block;">
              Contact Us for Updates
            </a>
          </div>`;
      }

      // ── Update hero badge text ──
      const heroBadge = document.querySelector('.hero-badge');
      if (heroBadge) {
        heroBadge.style.background = 'rgba(231,76,60,0.15)';
        heroBadge.style.borderColor = 'rgba(231,76,60,0.4)';
        heroBadge.style.color = '#e74c3c';
        heroBadge.innerHTML = '<span class="badge-dot" style="background:#e74c3c;"></span> Admissions Currently Closed';
      }
    }
  } catch (e) {
    console.log("Could not load admission status", e);
  }
});

// ─── FETCH HOMEPAGE GALLERY HIGHLIGHTS ───
window.addEventListener('DOMContentLoaded', async () => {
  const track = document.getElementById('homepageGalleryTrack');
  if (!track) return;

  try {
    const res = await fetch('/api/gallery');
    const images = await res.json();
    
    if (!images || images.length === 0) {
      const section = document.getElementById('galleryHighlights');
      if (section) section.style.display = 'none';
      return;
    }

    // Shuffle and pick up to 8 random images
    const shuffled = images.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 8);

    // Duplicate for seamless marquee effect
    const marqueeItems = [...selected, ...selected];

    let html = '';
    marqueeItems.forEach(img => {
      html += `
        <div class="gallery-card">
          <img src="${img.image_data}" alt="${img.title || 'Gallery Image'}" loading="lazy">
          <div class="img-title">${img.title || (img.category_name || 'Zenith Gallery')}</div>
        </div>
      `;
    });
    
    track.innerHTML = html;
  } catch (e) {
    console.error("Failed to load gallery highlights:", e);
    const section = document.getElementById('galleryHighlights');
    if (section) section.style.display = 'none';
  }
});
