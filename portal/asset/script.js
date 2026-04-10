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
document.getElementById('submitBtn').addEventListener('click', function (e) {
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = this.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  this.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
});

// ─── FORM SUBMISSION ───
document.getElementById('admissionForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const fields = ['studentName', 'parentName', 'phone', 'email'];
  let valid = true;

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.style.borderColor = '#ef4444';
      valid = false;
      setTimeout(() => el.style.borderColor = '', 2000);
    }
  });

  const cls = document.getElementById('classApplying');
  if (!cls.value) {
    cls.style.borderColor = '#ef4444';
    valid = false;
    setTimeout(() => cls.style.borderColor = '', 2000);
  }

  if (!valid) return;

  const btn = document.getElementById('submitBtn');
  btn.textContent = 'Submitting…';
  btn.disabled = true;

  setTimeout(() => {
    btn.textContent = 'Submit Application 🎓';
    btn.disabled = false;

    submitAdmissionToDB();

    document.getElementById('admissionForm').reset();
    document.getElementById('successPopup').classList.add('show');

    // decrement seat count for urgency
    const sc = document.getElementById('seatCount');
    const cur = parseInt(sc.textContent);
    if (cur > 1) sc.textContent = cur - 1;
  }, 1400);
});

// ─── SELECT STYLE FIX ───
document.getElementById('classApplying').addEventListener('change', function () {
  this.classList.add('filled');
});

// ─── SEAT COUNTER ANIMATION ───
function animateCounter() {
  const el = document.getElementById('seatCount');
  let count = 30, target = 24;
  const interval = setInterval(() => {
    if (count <= target) { clearInterval(interval); return; }
    count--;
    el.textContent = count;
  }, 80);
}
const urgencyObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) {
    animateCounter();
    urgencyObserver.disconnect();
  }
}, { threshold: 0.5 });
urgencyObserver.observe(document.querySelector('.urgency'));

// ─── CLOSE POPUP ON OUTSIDE CLICK ───
document.getElementById('successPopup').addEventListener('click', function (e) {
  if (e.target === this) this.classList.remove('show');
});

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
    const res = await fetch('http://127.0.0.1:5000/api/notices');
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
    }
  } catch (e) {
    console.log("Failed to load dynamic content", e);
  }
});
