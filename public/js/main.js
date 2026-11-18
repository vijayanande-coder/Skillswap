/**
 * SkillSwap - Client Application Logic
 * Genuine User-Driven Platform
 * Features: Authentication, Real Profiles, MongoDB Services,
 * Indian Rupee (₹) pricing, Bookings & Barter Exchange, Student Dashboard.
 */

// Application State
let currentUser = null;
let authToken = localStorage.getItem('skillswap_token') || null;

let currentFilter = {
  type: 'all',
  category: 'All',
  search: '',
  sort: 'newest',
};

let allServices = [];
let registeredStudents = [];

// DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await checkAuthStatus();
  initCategories();
  loadStats();
  loadServices();
  loadStudents();
});

/**
 * Check if student is logged in from saved JWT token
 */
async function checkAuthStatus() {
  if (!authToken) {
    currentUser = null;
    renderNav();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();

    if (result.success && result.user) {
      currentUser = result.user;
    } else {
      // Invalid/expired token
      localStorage.removeItem('skillswap_token');
      authToken = null;
      currentUser = null;
    }
  } catch (err) {
    console.warn('Auth check error:', err);
    currentUser = null;
  }

  renderNav();
}

/**
 * Render Navigation Bar based on user authentication
 */
function renderNav() {
  const container = document.getElementById('navActions');
  if (!container) return;

  if (currentUser) {
    const initials = currentUser.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2);

    container.innerHTML = `
      <div class="user-pill" onclick="openProfileModal()" title="View & Edit Profile">
        <div class="avatar-circle">${escapeHtml(initials)}</div>
        <div class="user-pill-info">
          <span class="user-pill-name">${escapeHtml(currentUser.name)}</span>
          <span class="user-pill-college">${escapeHtml(currentUser.university || 'Student')}</span>
        </div>
      </div>

      <button class="btn btn-primary btn-sm" onclick="openModal('postServiceModal')">
        <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Post a Skill
      </button>

      <button class="btn btn-outline btn-sm" onclick="openDashboard()">
        Dashboard
      </button>

      <button class="btn btn-outline btn-sm" onclick="logout()" title="Logout">
        Logout
      </button>
    `;
  } else {
    container.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="openModal('loginModal')">
        Sign In
      </button>
      <button class="btn btn-primary btn-sm" onclick="openModal('registerModal')">
        Join as Student
      </button>
    `;
  }
}

/**
 * Setup All Event Listeners
 */
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('heroSearchInput');
  const searchBtn = document.getElementById('heroSearchBtn');
  const categorySelect = document.getElementById('heroCategorySelect');

  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      currentFilter.search = searchInput.value.trim();
      if (categorySelect) currentFilter.category = categorySelect.value;
      loadServices();
      scrollToSection('marketplaceSection');
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        currentFilter.search = searchInput.value.trim();
        if (categorySelect) currentFilter.category = categorySelect.value;
        loadServices();
        scrollToSection('marketplaceSection');
      }
    });
  }

  // Quick tags
  document.querySelectorAll('.tag-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const tag = pill.getAttribute('data-tag');
      if (searchInput) searchInput.value = tag;
      currentFilter.search = tag;
      loadServices();
      scrollToSection('marketplaceSection');
    });
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter.type = tab.getAttribute('data-type');
      loadServices();
    });
  });

  // Sort
  const sortSelect = document.getElementById('sortBySelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentFilter.sort = e.target.value;
      loadServices();
    });
  }

  // Form Submissions
  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  const profileForm = document.getElementById('profileForm');
  if (profileForm) profileForm.addEventListener('submit', handleUpdateProfile);

  const postServiceForm = document.getElementById('postServiceForm');
  if (postServiceForm) postServiceForm.addEventListener('submit', handleCreateService);

  // Listing Type Toggle in Post Service Modal
  const modalTypeSelect = document.getElementById('modalServiceType');
  if (modalTypeSelect) {
    modalTypeSelect.addEventListener('change', (e) => {
      const type = e.target.value;
      const priceGroup = document.getElementById('formPriceGroup');
      const exchangeGroup = document.getElementById('formExchangeGroup');

      if (type === 'exchange') {
        if (priceGroup) priceGroup.style.display = 'none';
        if (exchangeGroup) exchangeGroup.style.display = 'block';
      } else {
        if (priceGroup) priceGroup.style.display = 'grid';
        if (exchangeGroup) exchangeGroup.style.display = 'none';
      }
    });
  }

  // Dashboard Tabs
  document.querySelectorAll('.dash-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.dash-tab-pane').forEach((p) => (p.style.display = 'none'));

      tab.classList.add('active');
      const tabTarget = tab.getAttribute('data-tab');
      if (tabTarget === 'incomingOrders') {
        document.getElementById('tabIncomingOrders').style.display = 'block';
      } else if (tabTarget === 'myRequests') {
        document.getElementById('tabMyRequests').style.display = 'block';
      } else if (tabTarget === 'myServices') {
        document.getElementById('tabMyServices').style.display = 'block';
      }
    });
  });
}

/**
 * Handle Student Login
 */
async function handleLogin(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('loginSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing In...';
  }

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result = await res.json();

    if (result.success && result.token) {
      authToken = result.token;
      localStorage.setItem('skillswap_token', authToken);
      currentUser = result.user;

      closeModal('loginModal');
      renderNav();
      showToast(`Welcome back, ${currentUser.name}!`, 'success');
      loadStats();
      loadServices();
      loadStudents();
    } else {
      showToast(result.message || 'Login failed. Check your credentials.', 'info');
    }
  } catch (err) {
    console.error('Login error:', err);
    showToast('Failed to connect to authentication server.', 'info');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  }
}

/**
 * Handle Student Registration
 */
async function handleRegister(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('registerSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Profile...';
  }

  const payload = {
    name: document.getElementById('regName').value.trim(),
    university: document.getElementById('regUniversity').value.trim(),
    major: document.getElementById('regMajor').value.trim(),
    email: document.getElementById('regEmail').value.trim(),
    password: document.getElementById('regPassword').value,
  };

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (result.success && result.token) {
      authToken = result.token;
      localStorage.setItem('skillswap_token', authToken);
      currentUser = result.user;

      closeModal('registerModal');
      renderNav();
      showToast(`Welcome to SkillSwap, ${currentUser.name}! Your student profile is active.`, 'success');
      loadStats();
      loadServices();
      loadStudents();
    } else {
      showToast(result.message || 'Registration failed.', 'info');
    }
  } catch (err) {
    console.error('Register error:', err);
    showToast('Failed to register. Please check your network.', 'info');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Student Profile';
    }
  }
}

/**
 * Handle Profile Update
 */
async function handleUpdateProfile(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('saveProfileBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
  }

  const payload = {
    name: document.getElementById('profileName').value.trim(),
    university: document.getElementById('profileUniversity').value.trim(),
    major: document.getElementById('profileMajor').value.trim(),
    bio: document.getElementById('profileBio').value.trim(),
    skillsOffered: document.getElementById('profileSkillsOffered').value,
    skillsWanted: document.getElementById('profileSkillsWanted').value,
  };

  try {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (result.success && result.user) {
      currentUser = result.user;
      renderNav();
      closeModal('profileModal');
      showToast('Profile updated successfully!', 'success');
      loadStudents();
      loadServices();
    } else {
      showToast(result.message || 'Failed to update profile.', 'info');
    }
  } catch (err) {
    console.error('Update profile error:', err);
    showToast('Failed to update profile.', 'info');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Profile';
    }
  }
}

/**
 * Handle Service Creation
 */
async function handleCreateService(e) {
  e.preventDefault();

  if (!currentUser || !authToken) {
    closeModal('postServiceModal');
    openModal('loginModal');
    showToast('Please sign in or register to publish a service.', 'info');
    return;
  }

  const submitBtn = document.getElementById('publishServiceBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Publishing...';
  }

  const payload = {
    title: document.getElementById('modalTitle').value.trim(),
    category: document.getElementById('modalCategory').value,
    serviceType: document.getElementById('modalServiceType').value,
    price: document.getElementById('modalPrice').value || 0,
    priceUnit: document.getElementById('modalPriceUnit').value,
    exchangeFor: document.getElementById('modalExchangeFor').value.trim(),
    description: document.getElementById('modalDescription').value.trim(),
    deliveryTime: document.getElementById('modalDelivery').value.trim() || 'Flexible',
    tags: document.getElementById('modalTags').value,
  };

  try {
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (result.success) {
      showToast('🎉 Your service has been published to the marketplace!', 'success');
      document.getElementById('postServiceForm').reset();
      closeModal('postServiceModal');
      loadServices();
      loadStats();
      initCategories();
      scrollToSection('marketplaceSection');
    } else {
      showToast(result.message || 'Error creating service', 'info');
    }
  } catch (err) {
    console.error('Post service error:', err);
    showToast('Failed to publish service.', 'info');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publish Service';
    }
  }
}

/**
 * Load Real Marketplace Services
 */
async function loadServices() {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 48px;">
      <div style="display: inline-block; width: 36px; height: 36px; border: 3px solid #bfdbfe; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      <p style="margin-top: 12px; color: #64748b; font-weight: 500;">Loading real student services...</p>
    </div>
  `;

  try {
    const params = new URLSearchParams();
    if (currentFilter.type && currentFilter.type !== 'all') params.append('type', currentFilter.type);
    if (currentFilter.category && currentFilter.category !== 'All') params.append('category', currentFilter.category);
    if (currentFilter.search) params.append('search', currentFilter.search);
    if (currentFilter.sort) params.append('sort', currentFilter.sort);

    const res = await fetch(`/api/services?${params.toString()}`);
    const result = await res.json();

    if (result.success) {
      allServices = result.data;
      renderServices(result.data);
    } else {
      grid.innerHTML = `<div class="empty-state"><p>${result.message || 'Error loading services.'}</p></div>`;
    }
  } catch (err) {
    console.error('Error fetching services:', err);
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Could not load listings</h3>
        <p>Ensure the SkillSwap Express server is running.</p>
        <button class="btn btn-primary" onclick="loadServices()">Retry</button>
      </div>
    `;
  }
}

/**
 * Render Service Cards
 */
function renderServices(services) {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  if (services.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" stroke-width="2"></circle>
          <path d="m21 21-4.3-4.3" stroke-width="2" stroke-linecap="round"></path>
        </svg>
        <h3>Be the first to publish your service.</h3>
        <p>No services have been published yet. Sign in or register to publish your skill, lesson, or barter proposal!</p>
        <button class="btn btn-primary" onclick="handleAuthAction('post')">Publish the First Skill</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = services
    .map((s) => {
      const typeBadgeClass =
        s.serviceType === 'exchange'
          ? 'badge-exchange'
          : s.serviceType === 'lesson'
          ? 'badge-lesson'
          : 'badge-freelance';

      const typeLabel =
        s.serviceType === 'exchange'
          ? 'Free Barter'
          : s.serviceType === 'lesson'
          ? '1-on-1 Lesson'
          : 'Freelance Gig';

      let priceHtml = '';
      if (s.serviceType === 'exchange') {
        priceHtml = `
          <div class="footer-price-group">
            <span>Barter Swap</span>
            <strong class="free">Free Exchange</strong>
          </div>
        `;
      } else if (s.priceUnit === 'per_hour') {
        priceHtml = `
          <div class="footer-price-group">
            <span>Hourly Rate</span>
            <strong>₹${Number(s.price).toLocaleString('en-IN')}<small>/hr</small></strong>
          </div>
        `;
      } else {
        priceHtml = `
          <div class="footer-price-group">
            <span>Fixed Price</span>
            <strong>₹${Number(s.price).toLocaleString('en-IN')}</strong>
          </div>
        `;
      }

      const swapBox =
        s.serviceType === 'exchange' && s.exchangeFor
          ? `
            <div class="card-swap-box">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
              </svg>
              <span>Wants: ${escapeHtml(s.exchangeFor)}</span>
            </div>
          `
          : '';

      const tagsHtml = (s.tags || [])
        .slice(0, 3)
        .map((tag) => `<span class="card-tag">#${escapeHtml(tag)}</span>`)
        .join('');

      const initials = (s.provider.name || 'Student')
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2);

      return `
        <article class="service-card" data-id="${s.id || s._id}">
          <div class="card-image-wrap" style="height: 140px; background: linear-gradient(135deg, #1e293b, #0f172a); display: flex; align-items: center; justify-content: center;">
            <div style="font-size: 2.5rem;">${getCategoryEmoji(s.category)}</div>
            <span class="card-type-tag ${typeBadgeClass}">${typeLabel}</span>
            <span class="card-category-tag">${escapeHtml(s.category)}</span>
          </div>

          <div class="card-body">
            <div class="provider-row">
              <div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.9rem;">${escapeHtml(initials)}</div>
              <div class="provider-details">
                <h5>
                  ${escapeHtml(s.provider.name)}
                  <svg class="verified-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>
                </h5>
                <p>${escapeHtml(s.provider.university)}</p>
              </div>
            </div>

            <h3 class="card-service-title">${escapeHtml(s.title)}</h3>
            <p class="card-service-desc">${escapeHtml(s.description)}</p>

            ${swapBox}

            <div class="card-tags">
              ${tagsHtml}
            </div>

            <div class="card-footer">
              ${priceHtml}
              <button class="btn btn-outline btn-sm" onclick="openServiceDetailModal('${s.id || s._id}')">
                Details
              </button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

/**
 * Load Real Registered Students
 */
async function loadStudents() {
  const grid = document.getElementById('studentsGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/auth/students');
    const result = await res.json();

    if (result.success && result.data) {
      registeredStudents = result.data;
      if (result.data.length === 0) {
        grid.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
            <h3>No students have joined yet.</h3>
            <p>Be the first student to create a profile, share your skills, and connect with peers!</p>
            <button class="btn btn-primary" onclick="handleAuthAction('register')">Join SkillSwap Today</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = result.data
        .map((student) => {
          const initials = (student.name || 'Student')
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2);

          const offers = (student.skillsOffered || [])
            .map((s) => `<span class="card-tag" style="background:#ecfdf5; color:#047857; border-color:#a7f3d0;">Offers: ${escapeHtml(s)}</span>`)
            .join('');

          const wants = (student.skillsWanted || [])
            .map((s) => `<span class="card-tag" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">Wants: ${escapeHtml(s)}</span>`)
            .join('');

          return `
            <div class="student-card">
              <div class="student-card-avatar">${escapeHtml(initials)}</div>
              <h4>${escapeHtml(student.name)}</h4>
              <p class="university">${escapeHtml(student.university)}</p>
              <p style="font-size: 0.78rem; color: #64748b; margin-bottom: 8px;">${escapeHtml(student.major || 'Student')}</p>
              ${student.bio ? `<p class="bio">${escapeHtml(student.bio)}</p>` : ''}
              <div class="student-skills-row">
                ${offers}
                ${wants}
              </div>
            </div>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.error('Error loading students:', err);
  }
}

/**
 * Load True Platform Stats
 */
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const result = await res.json();
    if (result.success && result.data) {
      const { activeStudents, skillsExchanged, completedProjects, collegesRepresented } = result.data;
      document.getElementById('statActiveStudents').textContent = activeStudents;
      document.getElementById('statSkillsExchanged').textContent = skillsExchanged;
      document.getElementById('statCompletedProjects').textContent = completedProjects;
      document.getElementById('statColleges').textContent = collegesRepresented;
    }
  } catch (err) {
    console.warn('Stats fetch error:', err);
  }
}

/**
 * Populate Categories
 */
async function initCategories() {
  try {
    const res = await fetch('/api/categories');
    const result = await res.json();
    if (result.success && result.data) {
      const heroSelect = document.getElementById('heroCategorySelect');
      const modalSelect = document.getElementById('modalCategory');
      const chipsContainer = document.getElementById('categoryChipsContainer');

      if (heroSelect) heroSelect.innerHTML = '<option value="All">All Categories</option>';
      if (modalSelect) modalSelect.innerHTML = '';

      result.data.forEach((cat) => {
        if (heroSelect) {
          const opt = document.createElement('option');
          opt.value = cat.name;
          opt.textContent = `${cat.name} (${cat.count})`;
          heroSelect.appendChild(opt);
        }
        if (modalSelect) {
          const opt = document.createElement('option');
          opt.value = cat.name;
          opt.textContent = cat.name;
          modalSelect.appendChild(opt);
        }
      });

      if (chipsContainer) {
        chipsContainer.innerHTML = '';
        result.data.forEach((cat) => {
          const chip = document.createElement('div');
          chip.className = 'category-chip';
          chip.innerHTML = `
            <div class="cat-icon-wrap">${getCategorySvg(cat.icon)}</div>
            <div class="cat-info">
              <h4>${escapeHtml(cat.name)}</h4>
              <span>${cat.count} listings</span>
            </div>
          `;
          chip.addEventListener('click', () => {
            document.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter.category = cat.name;
            if (heroSelect) heroSelect.value = cat.name;
            loadServices();
            scrollToSection('marketplaceSection');
          });
          chipsContainer.appendChild(chip);
        });
      }
    }
  } catch (err) {
    console.warn('Error fetching categories:', err);
  }
}

/**
 * Open Service Detail & Allow Booking
 */
function openServiceDetailModal(id) {
  const service = allServices.find((s) => (s.id || s._id) === id);
  if (!service) return;

  const modal = document.getElementById('serviceDetailModal');
  const modalBody = document.getElementById('serviceDetailContent');
  const actionBtn = document.getElementById('modalActionBtn');

  if (!modal || !modalBody) return;

  const isOwner = currentUser && (
    (service.provider.userId && service.provider.userId.toString() === (currentUser._id || currentUser.id).toString())
  );

  const typeLabel =
    service.serviceType === 'exchange'
      ? 'Free Skill Swap'
      : service.serviceType === 'lesson'
      ? '1-on-1 Tutoring Session'
      : 'Student Freelance Gig';

  let actionText = 'Take Action';
  if (!currentUser) {
    actionText = 'Sign In to Connect with Student';
  } else if (isOwner) {
    actionText = 'This is your own listing';
  } else if (service.serviceType === 'exchange') {
    actionText = 'Propose Free Skill Exchange';
  } else if (service.serviceType === 'lesson') {
    actionText = `Book Lesson (₹${service.price}/hr)`;
  } else {
    actionText = `Hire Student (₹${service.price})`;
  }

  const initials = (service.provider.name || 'Student')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2);

  modalBody.innerHTML = `
    <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 20px;">
      <div class="avatar-circle" style="width: 52px; height: 52px; font-size: 1.2rem;">${escapeHtml(initials)}</div>
      <div>
        <h4 style="font-size: 1.1rem; font-weight: 700; color: #0f172a;">${escapeHtml(service.provider.name)}</h4>
        <p style="color: #2563eb; font-size: 0.85rem; font-weight: 600;">${escapeHtml(service.provider.university)}</p>
        <p style="color: #64748b; font-size: 0.82rem;">Verified Student Member</p>
      </div>
    </div>

    <div style="margin-bottom: 16px;">
      <span class="hero-pill">${typeLabel} • ${escapeHtml(service.category)}</span>
    </div>

    <h2 style="font-size: 1.3rem; font-weight: 800; color: #0f172a; margin-bottom: 14px;">${escapeHtml(service.title)}</h2>
    <p style="color: #334155; line-height: 1.6; margin-bottom: 20px; font-size: 0.95rem;">${escapeHtml(service.description)}</p>

    ${
      service.serviceType === 'exchange'
        ? `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px; margin-bottom: 20px;">
          <h5 style="color: #065f46; font-weight: 700; margin-bottom: 4px;">Provider Wants in Return:</h5>
          <p style="color: #047857; font-size: 0.9rem;">"${escapeHtml(service.exchangeFor || 'Any mutual skill offer')}"</p>
          <small style="color: #059669; display: block; margin-top: 6px;">100% Free exchange. No payment needed.</small>
        </div>

        ${
          currentUser && !isOwner
            ? `
          <div class="form-group" style="margin-top: 14px;">
            <label for="bookingExchangeProposal">What skill will you offer in exchange?</label>
            <input type="text" id="bookingExchangeProposal" placeholder="e.g. 1-hour coaching in Figma or C++ debugging" required>
          </div>
        `
            : ''
        }
      `
        : `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span style="font-size: 0.8rem; color: #1e40af; text-transform: uppercase; font-weight: 700;">Student Rate</span>
            <h3 style="color: #1e3a8a; font-size: 1.4rem; font-weight: 800;">₹${Number(service.price).toLocaleString('en-IN')} ${service.priceUnit === 'per_hour' ? '<small style="font-size: 0.85rem;">/ hr</small>' : '<small style="font-size: 0.85rem;">fixed</small>'}</h3>
          </div>
          <span style="font-size: 0.85rem; color: #3b82f6; font-weight: 600;">Delivery: ${escapeHtml(service.deliveryTime)}</span>
        </div>

        ${
          currentUser && !isOwner
            ? `
          <div class="form-group" style="margin-top: 14px;">
            <label for="bookingNotes">Project or Session Requirements (Optional note for student):</label>
            <textarea id="bookingNotes" rows="2" placeholder="Tell the student what you need help with..."></textarea>
          </div>
        `
            : ''
        }
      `
    }

    <div style="background-color: #f8fafc; border-radius: 8px; padding: 10px 14px; font-size: 0.8rem; color: #64748b; border: 1px solid #e2e8f0;">
      ℹ️ <strong>Simulated Prototype Mode:</strong> Bookings and barter exchanges are recorded into MongoDB. All financial amounts in Indian Rupees (₹) are simulated for demonstration.
    </div>
  `;

  if (actionBtn) {
    actionBtn.textContent = actionText;
    actionBtn.disabled = isOwner;

    actionBtn.onclick = async () => {
      if (!currentUser) {
        closeModal('serviceDetailModal');
        openModal('loginModal');
        return;
      }

      if (isOwner) return;

      let exchangeOffer = '';
      let notes = '';

      const proposalInput = document.getElementById('bookingExchangeProposal');
      if (proposalInput) exchangeOffer = proposalInput.value.trim();

      const notesInput = document.getElementById('bookingNotes');
      if (notesInput) notes = notesInput.value.trim();

      if (service.serviceType === 'exchange' && !exchangeOffer) {
        showToast('Please specify what skill you can offer in return.', 'info');
        if (proposalInput) proposalInput.focus();
        return;
      }

      actionBtn.disabled = true;
      actionBtn.textContent = 'Submitting...';

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            serviceId: service._id || service.id,
            exchangeOffer,
            notes,
          }),
        });

        const result = await res.json();

        if (result.success) {
          closeModal('serviceDetailModal');
          showToast(`🎉 Request sent to ${service.provider.name}! Track it in your Student Dashboard.`, 'success');
          loadStats();
        } else {
          showToast(result.message || 'Failed to submit request.', 'info');
        }
      } catch (err) {
        console.error('Booking error:', err);
        showToast('Failed to connect to backend server.', 'info');
      } finally {
        actionBtn.disabled = false;
        actionBtn.textContent = actionText;
      }
    };
  }

  openModal('serviceDetailModal');
}

/**
 * Open and Populate Student Dashboard
 */
async function openDashboard() {
  if (!currentUser || !authToken) {
    openModal('loginModal');
    return;
  }

  // Update earnings banner
  document.getElementById('dashEarningsTotal').textContent = `₹${(currentUser.earningsTotal || 0).toLocaleString('en-IN')}`;
  document.getElementById('dashCompletedOrders').textContent = `${currentUser.completedOrders || 0} completed services`;

  // Fetch bookings and services in parallel
  try {
    const [bookingsRes, servicesRes] = await Promise.all([
      fetch('/api/bookings/my-bookings', { headers: { Authorization: `Bearer ${authToken}` } }),
      fetch('/api/services/my-services', { headers: { Authorization: `Bearer ${authToken}` } }),
    ]);

    const bookingsData = await bookingsRes.json();
    const servicesData = await servicesRes.json();

    const received = (bookingsData.success && bookingsData.data.receivedOrders) || [];
    const sent = (bookingsData.success && bookingsData.data.sentRequests) || [];
    const myServices = (servicesData.success && servicesData.data) || [];

    // Counters
    document.getElementById('countReceivedOrders').textContent = received.length;
    document.getElementById('countSentRequests').textContent = sent.length;
    document.getElementById('countMyServices').textContent = myServices.length;

    // Render Tab 1: Received Orders
    const receivedContainer = document.getElementById('incomingOrdersList');
    if (received.length === 0) {
      receivedContainer.innerHTML = `
        <div style="text-align: center; padding: 32px; color: #64748b;">
          <p>No incoming requests yet. When students book your services or propose a barter, they will appear here!</p>
        </div>
      `;
    } else {
      receivedContainer.innerHTML = received
        .map((order) => {
          const isPending = order.status === 'pending';
          const isAccepted = order.status === 'accepted';

          return `
            <div class="order-card">
              <div>
                <span class="status-badge status-badge-${order.status}">${order.status}</span>
                <h4 style="margin: 6px 0 2px; color: #0f172a; font-size: 1rem;">${escapeHtml(order.serviceTitle)}</h4>
                <p style="font-size: 0.85rem; color: #475569;">
                  From student: <strong>${escapeHtml(order.clientName)}</strong> (${escapeHtml(order.clientUniversity || 'Student')})
                </p>
                ${
                  order.serviceType === 'exchange'
                    ? `<p style="font-size: 0.82rem; color: #065f46; margin-top: 4px;">⇄ Proposed Barter: "${escapeHtml(order.exchangeOffer)}"</p>`
                    : `<p style="font-size: 0.82rem; color: #1e40af; margin-top: 4px;">Amount: ₹${Number(order.price).toLocaleString('en-IN')}</p>`
                }
                ${order.notes ? `<p style="font-size: 0.8rem; color: #64748b; font-style: italic;">Note: "${escapeHtml(order.notes)}"</p>` : ''}
              </div>

              <div style="display: flex; gap: 8px;">
                ${
                  isPending
                    ? `
                  <button class="btn btn-primary btn-sm" onclick="updateOrderStatus('${order._id || order.id}', 'accepted')">Accept</button>
                  <button class="btn btn-outline btn-sm" onclick="updateOrderStatus('${order._id || order.id}', 'cancelled')">Decline</button>
                `
                    : ''
                }
                ${
                  isAccepted
                    ? `
                  <button class="btn btn-exchange btn-sm" onclick="updateOrderStatus('${order._id || order.id}', 'completed')">Mark Completed</button>
                `
                    : ''
                }
              </div>
            </div>
          `;
        })
        .join('');
    }

    // Render Tab 2: Sent Requests
    const sentContainer = document.getElementById('sentRequestsList');
    if (sent.length === 0) {
      sentContainer.innerHTML = `
        <div style="text-align: center; padding: 32px; color: #64748b;">
          <p>You haven't requested any services or skill exchanges yet. Browse the marketplace to connect with student peers!</p>
        </div>
      `;
    } else {
      sentContainer.innerHTML = sent
        .map((req) => {
          return `
            <div class="order-card">
              <div>
                <span class="status-badge status-badge-${req.status}">${req.status}</span>
                <h4 style="margin: 6px 0 2px; color: #0f172a; font-size: 1rem;">${escapeHtml(req.serviceTitle)}</h4>
                <p style="font-size: 0.85rem; color: #475569;">
                  Provider: <strong>${escapeHtml(req.providerName)}</strong>
                </p>
                ${
                  req.serviceType === 'exchange'
                    ? `<p style="font-size: 0.82rem; color: #065f46; margin-top: 4px;">⇄ Your Barter Offer: "${escapeHtml(req.exchangeOffer)}"</p>`
                    : `<p style="font-size: 0.82rem; color: #1e40af; margin-top: 4px;">Price: ₹${Number(req.price).toLocaleString('en-IN')}</p>`
                }
              </div>
              <div>
                ${
                  req.status === 'pending'
                    ? `<button class="btn btn-outline btn-sm" onclick="updateOrderStatus('${req._id || req.id}', 'cancelled')">Cancel Request</button>`
                    : `<span style="font-size: 0.82rem; color: #64748b;">${req.status.toUpperCase()}</span>`
                }
              </div>
            </div>
          `;
        })
        .join('');
    }

    // Render Tab 3: My Services
    const servicesContainer = document.getElementById('myServicesList');
    if (myServices.length === 0) {
      servicesContainer.innerHTML = `
        <div style="text-align: center; padding: 32px; color: #64748b;">
          <p>You haven't published any services or barter listings yet.</p>
          <button class="btn btn-primary btn-sm" style="margin-top: 10px;" onclick="closeModal('dashboardModal'); openModal('postServiceModal');">
            Publish Your First Skill
          </button>
        </div>
      `;
    } else {
      servicesContainer.innerHTML = myServices
        .map((srv) => {
          return `
            <div class="order-card">
              <div>
                <h4 style="color: #0f172a; font-size: 1rem; margin-bottom: 4px;">${escapeHtml(srv.title)}</h4>
                <span class="card-tag">${escapeHtml(srv.category)}</span>
                <span class="card-tag" style="text-transform: capitalize;">${srv.serviceType}</span>
                <p style="font-size: 0.85rem; color: #1e40af; font-weight: 700; margin-top: 6px;">
                  ${srv.serviceType === 'exchange' ? 'Free Exchange (Barter)' : `₹${Number(srv.price).toLocaleString('en-IN')}`}
                </p>
              </div>
              <div>
                <button class="btn btn-outline btn-sm" style="color: #dc2626; border-color: #fecaca;" onclick="deleteMyService('${srv._id || srv.id}')">
                  Delete Listing
                </button>
              </div>
            </div>
          `;
        })
        .join('');
    }

    openModal('dashboardModal');
  } catch (err) {
    console.error('Error opening dashboard:', err);
    showToast('Failed to load dashboard data.', 'info');
  }
}

/**
 * Update Order / Booking Status
 */
async function updateOrderStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/bookings/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });

    const result = await res.json();

    if (result.success) {
      showToast(`Status updated to ${newStatus}`, 'success');
      // Refresh current user data to update earnings if completed
      await checkAuthStatus();
      openDashboard();
      loadStats();
    } else {
      showToast(result.message || 'Error updating status', 'info');
    }
  } catch (err) {
    console.error('Update status error:', err);
    showToast('Failed to update status.', 'info');
  }
}

/**
 * Delete My Service
 */
async function deleteMyService(id) {
  if (!confirm('Are you sure you want to remove this service from the marketplace?')) {
    return;
  }

  try {
    const res = await fetch(`/api/services/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const result = await res.json();

    if (result.success) {
      showToast('Service removed successfully.', 'success');
      openDashboard();
      loadServices();
      loadStats();
      initCategories();
    } else {
      showToast(result.message || 'Error removing service.', 'info');
    }
  } catch (err) {
    console.error('Delete service error:', err);
    showToast('Failed to delete service.', 'info');
  }
}

/**
 * Open Profile Modal
 */
function openProfileModal() {
  if (!currentUser) {
    openModal('loginModal');
    return;
  }

  document.getElementById('profileName').value = currentUser.name || '';
  document.getElementById('profileUniversity').value = currentUser.university || '';
  document.getElementById('profileMajor').value = currentUser.major || '';
  document.getElementById('profileBio').value = currentUser.bio || '';
  document.getElementById('profileSkillsOffered').value = (currentUser.skillsOffered || []).join(', ');
  document.getElementById('profileSkillsWanted').value = (currentUser.skillsWanted || []).join(', ');

  openModal('profileModal');
}

/**
 * Auth Action Router Helper
 */
function handleAuthAction(action) {
  if (action === 'register') {
    openModal('registerModal');
  } else if (action === 'login') {
    openModal('loginModal');
  } else if (action === 'post') {
    if (!currentUser) {
      showToast('Please sign in or register to publish a service.', 'info');
      openModal('loginModal');
    } else {
      openModal('postServiceModal');
    }
  }
}

function switchAuthModal(to) {
  closeModal('loginModal');
  closeModal('registerModal');
  if (to === 'login') openModal('loginModal');
  if (to === 'register') openModal('registerModal');
}

/**
 * Logout
 */
function logout() {
  localStorage.removeItem('skillswap_token');
  authToken = null;
  currentUser = null;
  renderNav();
  showToast('You have been logged out safely.', 'info');
  loadServices();
}

/**
 * Modal utilities
 */
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

/**
 * Toast Notifications
 */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

function resetFilters() {
  currentFilter = {
    type: 'all',
    category: 'All',
    search: '',
    sort: 'newest',
  };
  const searchInput = document.getElementById('heroSearchInput');
  const catSelect = document.getElementById('heroCategorySelect');
  if (searchInput) searchInput.value = '';
  if (catSelect) catSelect.value = 'All';

  document.querySelectorAll('.filter-tab').forEach((t, i) => {
    t.classList.toggle('active', i === 0);
  });
  document.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));

  loadServices();
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCategoryEmoji(name) {
  switch (name) {
    case 'Web & Programming': return '💻';
    case 'Academic Tutoring': return '📚';
    case 'Design & Creative': return '🎨';
    case 'Writing & Translation': return '✍️';
    case 'AI & Data Science': return '🤖';
    case 'Video & Audio': return '🎬';
    case 'Business & Marketing': return '📈';
    default: return '🎓';
  }
}

function getCategorySvg(name) {
  switch (name) {
    case 'code':
      return `<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>`;
    case 'book-open':
      return `<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`;
    case 'palette':
      return `<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4 5 5 0 015-5c1.5 0 2.5 1 4 1 1 0 1-1 3-1 2.5 0 5 2 5 5 0 3.314-2.686 6-6 6a4.5 4.5 0 01-3-1"/></svg>`;
    case 'feather':
      return `<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>`;
    case 'cpu':
      return `<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2" stroke-width="2"/><rect x="9" y="9" width="6" height="6" stroke-width="2"/><path stroke-linecap="round" stroke-width="2" d="M9 1v3m6-3v3M9 20v3m6-3v3M20 9h3m-3 6h3M1 9h3m-3 6h3"/></svg>`;
    case 'video':
      return `<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
    case 'trending-up':
      return `<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>`;
    default:
      return `<svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>`;
  }
}
