// ─── ADMIN JAVASCRIPT ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // ══════════════════════════════════════════════
  //  LOGIN PAGE
  // ══════════════════════════════════════════════
  const loginForm = document.getElementById('adminLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id  = document.getElementById('adminId').value;
      const pwd = document.getElementById('password').value;
      const errorMsg = document.getElementById('loginError');
      const btn = document.querySelector('.btn-login');

      btn.textContent = 'Verifying...';
      try {
        const res  = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: id, password: pwd })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          localStorage.setItem('zcs_admin_logged_in', 'true');
          window.location.href = 'admin-dashboard.html';
        } else {
          errorMsg.style.display = 'block';
          errorMsg.textContent = data.message || 'Incorrect credentials.';
        }
      } catch (err) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = 'Server error. Is the Flask server running?';
      }
      btn.textContent = 'Secure Login';
    });

    if (localStorage.getItem('zcs_admin_logged_in') === 'true') {
      window.location.href = 'admin-dashboard.html';
    }
    return; // stop here for login page
  }

  // ══════════════════════════════════════════════
  //  DASHBOARD PAGE
  // ══════════════════════════════════════════════
  const sidebarNavItems = document.querySelectorAll('.nav-item');
  if (sidebarNavItems.length === 0) return;

  // Auth guard
  if (localStorage.getItem('zcs_admin_logged_in') !== 'true') {
    window.location.href = 'admin-login.html';
    return;
  }

  // ── Sidebar Toggle (mobile) ──────────────────
  const sidebar        = document.getElementById('sidebar');
  const overlay        = document.getElementById('sidebarOverlay');
  const sidebarToggle  = document.getElementById('sidebarToggle');     // mobile top-left
  const sidebarClose   = document.getElementById('sidebarClose');      // inside sidebar
  const sidebarTogDesk = document.getElementById('sidebarToggleDesk'); // desk topbar

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (sidebarToggle)  sidebarToggle.addEventListener('click', openSidebar);
  if (sidebarClose)   sidebarClose.addEventListener('click', closeSidebar);
  if (overlay)        overlay.addEventListener('click', closeSidebar);
  // Desktop toggle — not needed (sidebar always visible) but kept for future collapsed mode
  if (sidebarTogDesk) sidebarTogDesk.addEventListener('click', () => {
    // on desktop ≤900px this won't be visible anyway; kept as hook
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });

  // ── Tab Navigation ───────────────────────────
  const tabPanes   = document.querySelectorAll('.tab-pane');
  const topbarTitle = document.getElementById('topbarTitle');
  const titleMap   = {
    dashboard: 'Dashboard',
    seats:     'Seat Management',
    notices:   'Manage Notices',
    content:   'Edit Content',
    settings:  'Settings'
  };

  sidebarNavItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarNavItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(t => t.classList.remove('active'));

      item.classList.add('active');
      const targetTab = item.getAttribute('data-tab');
      const pane = document.getElementById(`tab-${targetTab}`);
      if (pane) pane.classList.add('active');
      if (topbarTitle) topbarTitle.textContent = titleMap[targetTab] || 'Admin';

      if (targetTab === 'dashboard') loadAdmissions();
      if (targetTab === 'notices')   loadNotices();
      if (targetTab === 'content')   loadContent();
      if (targetTab === 'seats')     initSeats();

      // close on mobile after selecting
      if (window.innerWidth <= 900) closeSidebar();
    });
  });

  // ── Logout ──────────────────────────────────
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('zcs_admin_logged_in');
      window.location.href = 'admin-login.html';
    });
  }

  // Initial load
  loadAdmissions();


  // ══════════════════════════════════════════════
  //  DATA: ADMISSIONS
  // ══════════════════════════════════════════════
  async function loadAdmissions() {
    const list = document.querySelector('#tab-dashboard .notice-list');
    if (!list) return;
    list.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div>';
    try {
      const res  = await fetch('/api/admissions');
      const data = await res.json();
      const countEl = document.getElementById('admissionCount');
      if (countEl) countEl.textContent = data.length;
      list.innerHTML = '';

      if (data.length === 0) {
        list.innerHTML = '<p style="color:var(--admin-text-light);padding:12px 0;">No applications yet.</p>';
        return;
      }

      data.forEach(item => {
        list.innerHTML += `
          <div class="notice-item">
            <div class="notice-content">
              <h4>${item.student_name} — Applying for ${item.class_applying}</h4>
              <p>Parent: ${item.parent_name} &nbsp;|&nbsp; Phone: ${item.phone} &nbsp;|&nbsp; Status: <strong>${item.status}</strong></p>
            </div>
            <div class="notice-actions">
              <button class="btn-edit" onclick="alert('Message: ${(item.message || 'No message left.').replace(/'/g, "\\'")}')">View</button>
            </div>
          </div>`;
      });
    } catch (e) {
      list.innerHTML = '<p style="color:var(--admin-danger)">Failed to load. Is the server running?</p>';
    }
  }


  // ══════════════════════════════════════════════
  //  DATA: NOTICES
  // ══════════════════════════════════════════════
  async function loadNotices() {
    const list = document.getElementById('noticeList');
    if (!list) return;
    list.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div>';
    try {
      const res  = await fetch('/api/notices');
      const data = await res.json();
      const countEl = document.getElementById('noticeCount');
      if (countEl) countEl.textContent = data.length;
      list.innerHTML = '';

      if (data.length === 0) {
        list.innerHTML = '<p style="color:var(--admin-text-light);padding:12px 0;">No active notices.</p>';
        return;
      }

      data.forEach(item => {
        list.innerHTML += `
          <div class="notice-item">
            <div class="notice-content">
              <h4>${item.title}</h4>
              <p>Posted: ${new Date(item.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</p>
            </div>
            <div class="notice-actions">
              <button class="btn-delete" onclick="deleteNotice(${item.id})">Delete</button>
            </div>
          </div>`;
      });
    } catch (e) {
      list.innerHTML = '<p style="color:var(--admin-danger)">Failed to load notices.</p>';
    }
  }

  window.deleteNotice = async function(id) {
    if (!confirm('Delete this notice permanently?')) return;
    try {
      const res  = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) loadNotices();
      else alert(data.message);
    } catch (e) { alert('Error deleting notice.'); }
  };

  window.publishNotice = async function(e) {
    e.preventDefault();
    const title   = document.getElementById('noticeTitle').value.trim();
    const content = document.getElementById('noticeContent').value.trim();
    const btn = document.getElementById('publishBtn');
    if (!title || !content) return alert('Title and Content are required.');
    btn.textContent = 'Publishing...';
    try {
      const res  = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      const data = await res.json();
      if (data.success) {
        document.getElementById('noticeForm').reset();
        loadNotices();
        showToast('Notice Published!', 'success');
      } else alert(data.message);
    } catch (err) { alert('Error connecting to server.'); }
    btn.textContent = '📤 Publish Notice';
  };


  // ══════════════════════════════════════════════
  //  DATA: CONTENT
  // ══════════════════════════════════════════════
  async function loadContent() {
    try {
      const res  = await fetch('/api/content');
      const data = await res.json();
      if (data.hero_headline) {
        document.getElementById('editHeroHeadline').value    = data.hero_headline;
        document.getElementById('editHeroSubtitle').value    = data.hero_subtitle;
        document.getElementById('editAdmissionsBanner').value = data.admissions_banner;
      }
    } catch(e) { /* silent */ }
  }

  window.saveContent = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('saveContentBtn');
    btn.textContent = 'Saving...';
    try {
      const res  = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hero_headline:     document.getElementById('editHeroHeadline').value,
          hero_subtitle:     document.getElementById('editHeroSubtitle').value,
          admissions_banner: document.getElementById('editAdmissionsBanner').value
        })
      });
      const data = await res.json();
      if (data.success) showToast('Content saved!', 'success');
      else alert('Failed to save content.');
    } catch(err) { alert('Error saving content.'); }
    btn.textContent = '💾 Save Content Changes';
  };


  // ══════════════════════════════════════════════
  //  CREDENTIALS
  // ══════════════════════════════════════════════
  window.updateCredentials = async function(e) {
    e.preventDefault();
    const newId  = document.getElementById('newAdminId').value.trim();
    const newPwd = document.getElementById('newPassword').value;
    if (!newId || !newPwd) return alert('Both new ID and Password are required.');
    try {
      const res  = await fetch('/api/admin/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_id: newId, new_password: newPwd })
      });
      const data = await res.json();
      if (data.success) {
        alert('Credentials updated! Please log in again.');
        localStorage.removeItem('zcs_admin_logged_in');
        window.location.href = 'admin-login.html';
      } else alert('Failed: ' + data.message);
    } catch (err) { alert('Error connecting to server.'); }
  };


  // ══════════════════════════════════════════════
  //  SEAT MANAGEMENT
  // ══════════════════════════════════════════════

  // Default seat data — editable by admin
  const DEFAULT_SEATS = {
    'Nursery':  30,
    'LKG':      30,
    'UKG':      30,
    'Class I':  40,
    'Class II': 40,
    'Class III':40,
    'Class IV': 40,
    'Class V':  40,
    'Class VI': 40,
    'Class VII':40,
    'Class VIII':40,
    'Class IX': 35,
    'Class X':  35,
    'Class XI': 30,
    'Class XII':30,
  };

  // Storage key
  const SEATS_KEY = 'zcs_seats_data';
  const SEATS_TS_KEY = 'zcs_seats_timestamp';

  function getSeats() {
    try {
      const stored = localStorage.getItem(SEATS_KEY);
      return stored ? JSON.parse(stored) : { ...DEFAULT_SEATS };
    } catch { return { ...DEFAULT_SEATS }; }
  }

  function saveSeatsToStorage(data) {
    localStorage.setItem(SEATS_KEY, JSON.stringify(data));
    localStorage.setItem(SEATS_TS_KEY, new Date().toLocaleString('en-IN'));
  }

  function calcTotal(data) {
    return Object.values(data).reduce((a, b) => a + (parseInt(b) || 0), 0);
  }

  function updateGrandTotal() {
    const inputs = document.querySelectorAll('.seat-input');
    let total = 0;
    inputs.forEach(inp => total += parseInt(inp.value) || 0);
    const el = document.getElementById('grandTotalSeats');
    if (el) el.textContent = total.toLocaleString();
    // also update dashboard stat
    const statEl = document.getElementById('totalSeatsCount');
    if (statEl) statEl.textContent = total.toLocaleString();
  }

  function initSeats() {
    const grid = document.getElementById('seatsGrid');
    if (!grid) return;
    const data = getSeats();

    // Timestamp
    const ts = localStorage.getItem(SEATS_TS_KEY);
    const tsEl = document.getElementById('seatsLastUpdated');
    if (tsEl) tsEl.textContent = ts || 'Never';

    // Grand total
    const gtEl = document.getElementById('grandTotalSeats');
    if (gtEl) gtEl.textContent = calcTotal(data).toLocaleString();

    // Also keep dashboard count up to date
    const statEl = document.getElementById('totalSeatsCount');
    if (statEl) statEl.textContent = calcTotal(data).toLocaleString();

    grid.innerHTML = '';
    Object.entries(data).forEach(([cls, seats]) => {
      const shortLabel = cls.replace('Class ', '');
      const div = document.createElement('div');
      div.className = 'seat-item';
      div.innerHTML = `
        <div class="seat-item-label">
          <div class="class-badge">${shortLabel.slice(0,3)}</div>
          ${cls}
        </div>
        <div class="seat-input-wrap">
          <button class="seat-btn" onclick="adjustSeat(this,-1)" type="button">−</button>
          <input class="seat-input" type="number" min="0" max="200"
            value="${seats}" data-class="${cls}"
            oninput="updateGrandTotal()">
          <button class="seat-btn" onclick="adjustSeat(this,1)" type="button">+</button>
        </div>`;
      grid.appendChild(div);
    });

    // Seat count on dashboard card
    updateGrandTotal();

    // Admission toggle state
    const toggle = document.getElementById('admissionToggle');
    const isOpen = localStorage.getItem('zcs_admission_open') !== 'false';
    if (toggle) {
      toggle.checked = isOpen;
      updateToggleStatus(isOpen);
      toggle.addEventListener('change', () => updateToggleStatus(toggle.checked));
    }
  }

  // Make accessible globally for inline handlers
  window.updateGrandTotal = updateGrandTotal;

  window.adjustSeat = function(btn, delta) {
    const input = btn.closest('.seat-input-wrap').querySelector('.seat-input');
    const val = parseInt(input.value) || 0;
    input.value = Math.max(0, Math.min(200, val + delta));
    updateGrandTotal();
  };

  window.saveSeats = function() {
    const inputs = document.querySelectorAll('.seat-input');
    const data   = {};
    inputs.forEach(inp => {
      const cls = inp.dataset.class;
      data[cls] = parseInt(inp.value) || 0;
    });
    saveSeatsToStorage(data);

    const ts = new Date().toLocaleString('en-IN');
    const tsEl = document.getElementById('seatsLastUpdated');
    if (tsEl) tsEl.textContent = ts;

    const msg = document.getElementById('seatSaveMsg');
    if (msg) {
      msg.className = 'seat-save-msg success';
      msg.textContent = '✅ Seat counts saved successfully!';
      setTimeout(() => { msg.className = 'seat-save-msg'; }, 3000);
    }

    updateGrandTotal();
  };

  window.resetSeats = function() {
    if (!confirm('Reset all seat counts to default values?')) return;
    localStorage.removeItem(SEATS_KEY);
    localStorage.removeItem(SEATS_TS_KEY);
    initSeats();
    const msg = document.getElementById('seatSaveMsg');
    if (msg) {
      msg.className = 'seat-save-msg success';
      msg.textContent = '↺ Seats reset to default values.';
      setTimeout(() => { msg.className = 'seat-save-msg'; }, 3000);
    }
  };

  function updateToggleStatus(isOpen) {
    const statusEl = document.getElementById('toggleStatus');
    if (!statusEl) return;
    if (isOpen) {
      statusEl.innerHTML = 'Currently: <strong style="color:var(--admin-success)">Open</strong>';
    } else {
      statusEl.innerHTML = 'Currently: <strong style="color:var(--admin-danger)">Closed</strong>';
    }
    const admStatusEl = document.getElementById('admissionStatus');
    if (admStatusEl) {
      admStatusEl.textContent = isOpen ? 'Open' : 'Closed';
      admStatusEl.style.color = isOpen ? 'var(--admin-success)' : 'var(--admin-danger)';
    }
  }

  window.saveAdmissionStatus = function() {
    const toggle = document.getElementById('admissionToggle');
    if (!toggle) return;
    localStorage.setItem('zcs_admission_open', toggle.checked ? 'true' : 'false');
    updateToggleStatus(toggle.checked);
    showToast(toggle.checked ? 'Admissions marked as Open' : 'Admissions marked as Closed', 'success');
  };

  // Initialise seat counts on dashboard load
  (() => {
    const data   = getSeats();
    const statEl = document.getElementById('totalSeatsCount');
    if (statEl) statEl.textContent = calcTotal(data).toLocaleString();
    // Also load notice count indicator
    const nc = document.getElementById('noticeCount');
    if (nc) nc.textContent = '—';
    fetch('/api/notices')
      .then(r => r.json())
      .then(d => { if (nc) nc.textContent = d.length; })
      .catch(() => { if (nc) nc.textContent = '—'; });
  })();


  // ══════════════════════════════════════════════
  //  TOAST NOTIFICATION
  // ══════════════════════════════════════════════
  function showToast(msg, type = 'success') {
    let toast = document.getElementById('adminToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'adminToast';
      toast.style.cssText = `
        position:fixed; bottom:24px; right:24px; z-index:9999;
        padding:14px 22px; border-radius:12px; font-size:0.88rem;
        font-weight:600; font-family:'Poppins',sans-serif;
        box-shadow: 0 8px 28px rgba(0,0,0,0.15);
        transition: opacity 0.3s, transform 0.3s;
        opacity:0; transform:translateY(12px);
      `;
      document.body.appendChild(toast);
    }
    toast.style.background = type === 'success' ? '#27ae60' : '#e74c3c';
    toast.style.color = 'white';
    toast.textContent = msg;
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity  = '0';
      toast.style.transform = 'translateY(12px)';
    }, 3200);
  }

}); // end DOMContentLoaded
