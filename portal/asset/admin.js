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
    settings:  'Settings',
    gallery:   'Gallery Management'
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
      if (targetTab === 'gallery')   loadGalleryAdmin();

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
        if (data.academic_year) {
          document.getElementById('editAcademicYear').value = data.academic_year;
        }
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
          admissions_banner: document.getElementById('editAdmissionsBanner').value,
          academic_year:     document.getElementById('editAcademicYear').value
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

  async function fetchSeatsFromAPI() {
    try {
      const res = await fetch('/api/seats');
      return await res.json();
    } catch {
      return { ...DEFAULT_SEATS };
    }
  }

  function saveSeatsToStorage(data) {
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

    // Show loading state
    grid.innerHTML = '<p style="color:var(--admin-text-light);padding:16px;">Loading seat data...</p>';

    fetchSeatsFromAPI().then(data => {
      // Timestamp
      const ts = localStorage.getItem(SEATS_TS_KEY);
      const tsEl = document.getElementById('seatsLastUpdated');
      if (tsEl) tsEl.textContent = ts || 'Not yet saved';

      // Grand total
      const gtEl = document.getElementById('grandTotalSeats');
      if (gtEl) gtEl.textContent = calcTotal(data).toLocaleString();

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

      updateGrandTotal();

      // Admission toggle state — load from server
      const toggle = document.getElementById('admissionToggle');
      if (toggle) {
        fetch('/api/admission-status')
          .then(r => r.json())
          .then(d => {
            const isOpen = d.admission_open !== false;
            toggle.checked = isOpen;
            updateToggleStatus(isOpen);
          })
          .catch(() => { toggle.checked = true; updateToggleStatus(true); });
        toggle.addEventListener('change', () => updateToggleStatus(toggle.checked));
      }
    });
  }

  // Make accessible globally for inline handlers
  window.updateGrandTotal = updateGrandTotal;

  window.adjustSeat = function(btn, delta) {
    const input = btn.closest('.seat-input-wrap').querySelector('.seat-input');
    const val = parseInt(input.value) || 0;
    input.value = Math.max(0, Math.min(200, val + delta));
    updateGrandTotal();
  };

  window.saveSeats = async function() {
    const inputs = document.querySelectorAll('.seat-input');
    const data   = {};
    inputs.forEach(inp => {
      const cls = inp.dataset.class;
      data[cls] = parseInt(inp.value) || 0;
    });

    const btn = document.getElementById('saveSeatsBtn');
    if (btn) btn.textContent = 'Saving...';

    try {
      const res = await fetch('/api/seats', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();

      if (result.success) {
        const ts = new Date().toLocaleString('en-IN');
        localStorage.setItem(SEATS_TS_KEY, ts);
        const tsEl = document.getElementById('seatsLastUpdated');
        if (tsEl) tsEl.textContent = ts;

        const msg = document.getElementById('seatSaveMsg');
        if (msg) {
          msg.className = 'seat-save-msg success';
          msg.textContent = '✅ Seat counts saved to server!';
          setTimeout(() => { msg.className = 'seat-save-msg'; }, 3000);
        }
        updateGrandTotal();
      } else {
        showToast('Failed to save seats.', 'error');
      }
    } catch(e) {
      showToast('Server error saving seats.', 'error');
    }

    if (btn) btn.textContent = '💾 Save Seat Changes';
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

  window.saveAdmissionStatus = async function() {
    const toggle = document.getElementById('admissionToggle');
    if (!toggle) return;
    const btn = document.querySelector('[onclick="saveAdmissionStatus()"]');
    if (btn) btn.textContent = 'Saving...';
    try {
      const res = await fetch('/api/admission-status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admission_open: toggle.checked })
      });
      const data = await res.json();
      if (data.success) {
        updateToggleStatus(toggle.checked);
        showToast(toggle.checked ? '✅ Admissions marked as Open on website!' : '🔴 Admissions marked as Closed on website!', 'success');
      } else {
        showToast('Failed to update admission status.', 'error');
      }
    } catch (e) {
      showToast('Server error. Could not update status.', 'error');
    }
    if (btn) btn.textContent = 'Update Status';
  };

  // Initialise seat counts on dashboard load
  (() => {
    const statEl = document.getElementById('totalSeatsCount');
    if (statEl) {
      fetchSeatsFromAPI().then(data => {
        if (statEl) statEl.textContent = calcTotal(data).toLocaleString();
      }).catch(() => { if (statEl) statEl.textContent = '--'; });
    }
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

  // ══════════════════════════════════════════════
  //  GALLERY MANAGEMENT
  // ══════════════════════════════════════════════

  let galleryCats   = [];  // [{id, name}]
  let galleryImages = [];  // all images from API
  let selectedImgB64 = null; // base64 of selected file

  // ── Load everything when tab opens ───────────
  window.loadGalleryAdmin = async function() {
    await loadGalleryCats();
    await loadGalleryImages();
  };

  // ── Categories ───────────────────────────────
  async function loadGalleryCats() {
    const list = document.getElementById('catList');
    if (list) list.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div>';
    try {
      const res = await fetch('/api/gallery/categories');
      galleryCats = await res.json();
      renderCatList();
      populateCatSelects();
    } catch(e) {
      if (list) list.innerHTML = '<p style="color:var(--admin-danger)">Failed to load categories.</p>';
    }
  }

  function renderCatList() {
    const list = document.getElementById('catList');
    if (!list) return;
    if (galleryCats.length === 0) {
      list.innerHTML = '<p style="color:var(--admin-text-light);padding:12px 0;">No categories yet. Add one above.</p>';
      return;
    }
    list.innerHTML = '';
    galleryCats.forEach(cat => {
      const count = galleryImages.filter(img => img.category_id == cat.id).length;
      list.innerHTML += `
        <div class="notice-item">
          <div class="notice-content">
            <h4>${cat.name} <span style="font-weight:400;color:#888;font-size:0.82rem;">(${count} photo${count !== 1 ? 's' : ''})</span></h4>
          </div>
          <div class="notice-actions">
            <button class="btn-delete" onclick="deleteGalleryCat(${cat.id}, '${cat.name.replace(/'/g,"\\'")}')">Delete</button>
          </div>
        </div>`;
    });
  }

  function populateCatSelects() {
    // Upload form select
    const sel = document.getElementById('imgCategory');
    if (sel) {
      const curr = sel.value;
      sel.innerHTML = '<option value="">— Select Category —</option>';
      galleryCats.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
      });
      if (curr) sel.value = curr;
    }
    // Library filter select
    const libSel = document.getElementById('libFilter');
    if (libSel) {
      const curr2 = libSel.value;
      libSel.innerHTML = '<option value="all">All Categories</option>';
      galleryCats.forEach(c => {
        libSel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
      });
      if (curr2) libSel.value = curr2;
    }
  }

  window.addGalleryCategory = async function() {
    const input = document.getElementById('newCatName');
    const name  = (input.value || '').trim();
    if (!name) return alert('Please enter a category name.');
    const btn = document.getElementById('addCatBtn');
    btn.textContent = 'Adding...';
    try {
      const res  = await fetch('/api/gallery/categories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.success) {
        input.value = '';
        await loadGalleryCats();
        showToast('Category added!', 'success');
      } else alert(data.message);
    } catch(e) { alert('Error adding category.'); }
    btn.textContent = '➕ Add Category';
  };

  window.deleteGalleryCat = async function(id, name) {
    if (!confirm(`Delete category "${name}"? Images in this category will become uncategorized.`)) return;
    try {
      const res  = await fetch(`/api/gallery/categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { await loadGalleryAdmin(); showToast('Category deleted.', 'success'); }
      else alert(data.message);
    } catch(e) { alert('Error deleting category.'); }
  };

  // ── Images ───────────────────────────────────
  async function loadGalleryImages() {
    try {
      const res  = await fetch('/api/gallery');
      galleryImages = await res.json();
      renderCatList(); // refresh counts
      renderAdminLibrary();
    } catch(e) {
      document.getElementById('adminGalleryEmpty').style.display = 'block';
      document.getElementById('adminGalleryEmpty').textContent = 'Failed to load images.';
    }
  }

  window.renderAdminLibrary = function() {
    const grid    = document.getElementById('adminGalleryGrid');
    const empty   = document.getElementById('adminGalleryEmpty');
    const filter  = (document.getElementById('libFilter') || {}).value || 'all';
    if (!grid) return;

    const imgs = filter === 'all' ? galleryImages : galleryImages.filter(i => String(i.category_id) === String(filter));
    grid.innerHTML    = '';
    empty.style.display = imgs.length === 0 ? 'block' : 'none';

    imgs.forEach(img => {
      const catName = (galleryCats.find(c => c.id == img.category_id) || {}).name || 'Uncategorized';
      const card = document.createElement('div');
      card.style.cssText = 'border-radius:12px;overflow:hidden;position:relative;box-shadow:0 4px 14px rgba(0,0,0,0.10);background:#eee;';
      card.innerHTML = `
        <img src="${img.image_data}" alt="${img.title || 'photo'}" loading="lazy"
          style="width:100%;height:130px;object-fit:cover;display:block;">
        <div style="padding:8px 10px;background:#fff;">
          <p style="font-size:0.78rem;font-weight:600;color:#222;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px;" title="${img.title || ''}">${ img.title || '<em style="color:#aaa;">Untitled</em>' }</p>
          <p style="font-size:0.7rem;color:#666;">${catName}</p>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button onclick="openEditModal(${img.id},\`${(img.title||'').replace(/`/g,'\\`')}\`,${img.category_id || 'null'})"
              style="flex:1;padding:5px 0;border:none;border-radius:8px;font-size:0.75rem;font-weight:600;cursor:pointer;background:var(--admin-primary,#0d1b3e);color:#fff;">✎ Edit</button>
            <button onclick="deleteGalleryImg(${img.id})"
              style="flex:1;padding:5px 0;border:none;border-radius:8px;font-size:0.75rem;font-weight:600;cursor:pointer;background:#e74c3c;color:#fff;">🗑 Del</button>
          </div>
        </div>`;
      grid.appendChild(card);
    });
  };

  window.deleteGalleryImg = async function(id) {
    if (!confirm('Delete this image permanently?')) return;
    try {
      const res  = await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { await loadGalleryImages(); showToast('Image deleted.', 'success'); }
      else alert(data.message);
    } catch(e) { alert('Error deleting image.'); }
  };

  // ── Image Upload with Canvas Compression (multi-file) ──
  let selectedFiles = []; // Array of { dataUrl, name } after compression

  const dropZone = document.getElementById('dropZone');
  const imgFile  = document.getElementById('imgFile');

  if (dropZone) {
    dropZone.addEventListener('click', () => imgFile && imgFile.click());
    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      dropZone.style.borderColor = '#0d1b3e';
      dropZone.style.background  = 'rgba(13,27,62,0.05)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = '';
      dropZone.style.background  = '';
    });
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.style.borderColor = '';
      dropZone.style.background  = '';
      if (e.dataTransfer.files.length) handleImageFiles(e.dataTransfer.files);
    });
  }
  if (imgFile) {
    imgFile.addEventListener('change', () => {
      if (imgFile.files.length) handleImageFiles(imgFile.files);
    });
  }

  function handleImageFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) return alert('Please select valid image files (JPG, PNG, WEBP).');

    const grid = document.getElementById('imgPreviewGrid');
    const wrap = document.getElementById('imgPreviewWrap');
    const zone = document.getElementById('dropZone');

    // Append new files (don't replace existing selection)
    let processed = 0;
    files.forEach(file => {
      if (file.size > 15 * 1024 * 1024) {
        showToast(`"${file.name}" is too large (max 15MB). Skipping.`, 'error');
        processed++;
        if (processed === files.length && selectedFiles.length) finishPreview();
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        compressImage(e.target.result, 1200, 0.82, compressed => {
          selectedFiles.push({ dataUrl: compressed, name: file.name });

          // Add thumbnail
          const thumb = document.createElement('div');
          thumb.style.cssText = 'position:relative;border-radius:8px;overflow:hidden;aspect-ratio:1;background:#eee;';
          const idx = selectedFiles.length - 1;
          thumb.innerHTML = `
            <img src="${compressed}" style="width:100%;height:100%;object-fit:cover;display:block;">
            <button onclick="removeSelectedFile(${idx}, this.closest('div'))" title="Remove"
              style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.55);color:#fff;border:none;
                     border-radius:50%;width:20px;height:20px;cursor:pointer;font-size:0.7rem;line-height:1;">✕</button>
          `;
          if (grid) grid.appendChild(thumb);

          processed++;
          if (processed === files.length) finishPreview();
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function finishPreview() {
    const wrap = document.getElementById('imgPreviewWrap');
    const zone = document.getElementById('dropZone');
    if (wrap && selectedFiles.length) {
      wrap.style.display = 'block';
      zone.style.display = 'none';
    }
  }

  window.removeSelectedFile = function(idx, thumbEl) {
    selectedFiles.splice(idx, 1);
    if (thumbEl) thumbEl.remove();
    // Re-index remove buttons
    const grid = document.getElementById('imgPreviewGrid');
    if (grid) {
      Array.from(grid.children).forEach((child, i) => {
        const btn = child.querySelector('button');
        if (btn) btn.setAttribute('onclick', `removeSelectedFile(${i}, this.closest('div'))`);
      });
    }
    if (selectedFiles.length === 0) window.clearImagePreview();
  };

  function compressImage(dataUrl, maxWidth, quality, cb) {
    const img = new Image();
    img.onload = function() {
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  }

  window.clearImagePreview = function() {
    selectedFiles = [];
    const imgFile = document.getElementById('imgFile');
    if (imgFile) imgFile.value = '';
    const grid = document.getElementById('imgPreviewGrid');
    const wrap = document.getElementById('imgPreviewWrap');
    const zone = document.getElementById('dropZone');
    if (grid) grid.innerHTML = '';
    if (wrap) wrap.style.display = 'none';
    if (zone) zone.style.display = 'block';
  };

  window.uploadGalleryImage = async function() {
    const title  = (document.getElementById('imgTitle') || {}).value || '';
    const catId  = (document.getElementById('imgCategory') || {}).value || null;
    const msgEl  = document.getElementById('uploadMsg');
    const btn    = document.getElementById('uploadBtn');

    if (!selectedFiles.length) {
      if (msgEl) { msgEl.style.color = '#e74c3c'; msgEl.textContent = '⚠️ Please select at least one image first.'; }
      return;
    }

    btn.disabled = true;
    if (msgEl) msgEl.textContent = '';

    let successCount = 0;
    let failCount    = 0;
    const total      = selectedFiles.length;

    for (let i = 0; i < total; i++) {
      btn.textContent = `Uploading ${i + 1} of ${total}…`;
      const { dataUrl } = selectedFiles[i];
      try {
        const res  = await fetch('/api/gallery', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ title: title.trim(), category_id: catId || null, image_data: dataUrl })
        });
        const data = await res.json();
        if (data.success) successCount++;
        else { failCount++; console.warn('Upload failed for image', i + 1, data.message); }
      } catch(e) {
        failCount++;
        console.warn('Network error for image', i + 1, e);
      }
    }

    // Done
    if (msgEl) {
      if (failCount === 0) {
        msgEl.style.color = '#27ae60';
        msgEl.textContent = `✅ ${successCount} image${successCount !== 1 ? 's' : ''} uploaded successfully!`;
      } else {
        msgEl.style.color = '#e67e22';
        msgEl.textContent = `⚠️ ${successCount} uploaded, ${failCount} failed.`;
      }
      setTimeout(() => { if (msgEl) msgEl.textContent = ''; }, 5000);
    }

    if (successCount > 0) {
      showToast(`${successCount} image${successCount !== 1 ? 's' : ''} uploaded to gallery!`, 'success');
      window.clearImagePreview();
      document.getElementById('imgTitle').value = '';
      document.getElementById('imgCategory').value = '';
      await loadGalleryImages();
    }

    btn.textContent = '📤 Upload to Gallery';
    btn.disabled    = false;
  };

  // ── Edit Modal ───────────────────────────────
  window.openEditModal = function(imgId, currentTitle, currentCatId) {
    // Build modal if not exists
    let modal = document.getElementById('editImgModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'editImgModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:20px;';
      modal.innerHTML = `
        <div style="background:#fff;border-radius:20px;padding:32px;max-width:460px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,0.3);">
          <h3 style="margin-bottom:20px;color:#0d1b3e;">✎ Edit Image Details</h3>
          <div class="form-group">
            <label>Title</label>
            <input type="text" id="editImgTitle" placeholder="Image title">
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="editImgCat"><option value="">— Uncategorized —</option></select>
          </div>
          <div style="display:flex;gap:12px;margin-top:20px;">
            <button class="btn-primary" id="editImgSaveBtn" style="flex:1;">💾 Save Changes</button>
            <button class="btn-secondary-admin" onclick="document.getElementById('editImgModal').remove()" style="flex:1;">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    // Populate fields
    document.getElementById('editImgTitle').value = currentTitle || '';
    const catSel = document.getElementById('editImgCat');
    catSel.innerHTML = '<option value="">— Uncategorized —</option>';
    galleryCats.forEach(c => {
      catSel.innerHTML += `<option value="${c.id}"${c.id == currentCatId ? ' selected' : ''}>${c.name}</option>`;
    });

    document.getElementById('editImgSaveBtn').onclick = async function() {
      const title = document.getElementById('editImgTitle').value.trim();
      const catId = document.getElementById('editImgCat').value || null;
      this.textContent = 'Saving...';
      try {
        const res  = await fetch(`/api/gallery/${imgId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ title, category_id: catId })
        });
        const data = await res.json();
        if (data.success) {
          modal.remove();
          await loadGalleryImages();
          showToast('Image updated!', 'success');
        } else alert(data.message);
      } catch(e) { alert('Error saving changes.'); }
      this.textContent = '💾 Save Changes';
    };

    modal.style.display = 'flex';
  };

}); // end DOMContentLoaded
