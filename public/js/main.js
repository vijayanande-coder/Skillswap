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
  fetchUnreadCount();
  initCategories();
  loadStats();
  loadServices();
  loadStudents();
});

/**
 * Check if student is logged in from saved JWT token
 * Resilient against cold starts and temporary database reconnection
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

    if (res.ok) {
      const result = await res.json();
      if (result.success && result.user) {
        currentUser = result.user;
      }
    } else if (res.status === 401) {
      // ONLY clear token when the server explicitly confirms it's invalid or expired
      console.warn('Session expired or unauthorized. Clearing stored token.');
      localStorage.removeItem('skillswap_token');
      authToken = null;
      currentUser = null;
    } else {
      // 503 (database connecting), 500, or Render cold start:
      // PRESERVE the token so the user is not kicked out!
      console.warn(`Server responded with status ${res.status}. Preserving student login token.`);
    }
  } catch (err) {
    // Network glitch or offline: preserve token
    console.warn('Network issue during auth check. Preserving student login token.');
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

      <button class="btn btn-outline btn-sm" onclick="openMessagesFromNav()" title="Student In-App Messages">
        💬 Messages <span id="navUnreadDot" class="nav-unread-dot" style="display: none;"></span>
      </button>

      <button class="btn btn-outline btn-sm" onclick="openDashboard()">
        Dashboard
      </button>

      ${currentUser.role === 'admin' ? `
        <button class="btn btn-sm btn-admin-pill" onclick="openAdminDashboard()" title="Administrator Control Center">
          🛡️ Admin
        </button>
      ` : ''}

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

  const reviewForm = document.getElementById('reviewForm');
  if (reviewForm) reviewForm.addEventListener('submit', handleReviewSubmit);

  setupStarRatingListeners();

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
      } else if (tabTarget === 'myMessages') {
        document.getElementById('tabMyMessages').style.display = 'block';
        loadDashboardConversations();
      }
    });
  });

  // Chat Form Listeners
  const chatSendForm = document.getElementById('chatSendForm');
  if (chatSendForm) {
    chatSendForm.addEventListener('submit', handleSendMessage);
  }

  const chatInputText = document.getElementById('chatInputText');
  if (chatInputText) {
    chatInputText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatSendForm.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    });
  }
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
              ${s.provider.rating > 0 ? `<span class="star-badge" title="${s.provider.rating} stars from ${s.provider.reviewsCount} reviews">⭐ ${Number(s.provider.rating).toFixed(1)} <small>(${s.provider.reviewsCount})</small></span>` : ''}
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
              <p style="font-size: 0.78rem; color: #64748b; margin-bottom: 6px;">${escapeHtml(student.major || 'Student')}</p>
              ${student.rating > 0 ? `<div style="margin-bottom: 8px;"><span class="star-badge">⭐ ${Number(student.rating).toFixed(1)} (${student.reviewsCount} reviews)</span></div>` : ''}
              ${student.bio ? `<p class="bio">${escapeHtml(student.bio)}</p>` : ''}
              <div class="student-skills-row">
                ${offers}
                ${wants}
              </div>
              ${
                currentUser && (currentUser._id || currentUser.id).toString() === (student._id || student.id).toString()
                  ? ''
                  : `<button class="btn btn-outline btn-xs" style="margin-top: 10px; width: 100%; border-radius: 6px; font-weight: 600;" onclick="openDirectChat('${student._id || student.id}', '${escapeHtml(student.name)}', '${escapeHtml(student.university || '')}')">💬 Message Student</button>`
              }
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

    <div id="serviceReviewsSection" style="margin-top: 20px;"></div>
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

  const msgBtn = document.getElementById('modalMessageBtn');
  if (msgBtn) {
    const providerId = service.provider.userId || service.provider._id || service.provider.id;
    if (currentUser && !isOwner && providerId) {
      msgBtn.style.display = 'inline-flex';
      msgBtn.onclick = () => {
        closeModal('serviceDetailModal');
        openDirectChat(
          providerId,
          service.provider.name,
          service.provider.university || '',
          service._id || service.id,
          service.title
        );
      };
    } else {
      msgBtn.style.display = 'none';
    }
  }

  openModal('serviceDetailModal');
  loadServiceReviews(service._id || service.id);
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
    fetchUnreadCount();

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

              <div style="display: flex; gap: 8px; align-items: center;">
                <button class="btn btn-outline btn-sm" onclick="closeModal('dashboardModal'); openDirectChat('${order.client}', '${escapeHtml(order.clientName)}', '${escapeHtml(order.clientUniversity || '')}', '${order.service}', '${escapeHtml(order.serviceTitle)}', '${order._id || order.id}')" title="Message client student">💬 Chat</button>
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
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 6px;">
                <button class="btn btn-outline btn-sm" onclick="closeModal('dashboardModal'); openDirectChat('${req.provider}', '${escapeHtml(req.providerName)}', '', '${req.service}', '${escapeHtml(req.serviceTitle)}', '${req._id || req.id}')" title="Message provider student">💬 Chat</button>
                ${
                  req.status === 'pending'
                    ? `<button class="btn btn-outline btn-sm" onclick="updateOrderStatus('${req._id || req.id}', 'cancelled')">Cancel Request</button>`
                    : req.status === 'completed'
                    ? (req.isReviewed
                        ? `<span class="star-badge" title="You reviewed this session ${req.reviewRating || 5} stars">⭐ Reviewed (${req.reviewRating || 5}★)</span>`
                        : `<button class="btn btn-primary btn-sm" onclick="openReviewModal('${req._id || req.id}', '${escapeHtml(req.serviceTitle)}', '${escapeHtml(req.providerName)}')">⭐ Leave Review</button>`)
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

/* ==========================================================================
   ⭐ Star Ratings & Reviews System Functions
   ========================================================================== */

/**
 * Fetch and display real reviews in the service details modal
 */
async function loadServiceReviews(serviceId) {
  const container = document.getElementById('serviceReviewsSection');
  if (!container) return;

  container.innerHTML = `<div style="text-align: center; padding: 12px; color: #64748b; font-size: 0.85rem;">Loading peer reviews...</div>`;

  try {
    const res = await fetch(`/api/reviews/service/${serviceId}`);
    const data = await res.json();

    if (data.success && data.data && data.data.length > 0) {
      container.innerHTML = `
        <h4 style="font-size: 1rem; font-weight: 700; color: #0f172a; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
          <span>Student Reviews & Ratings</span>
          <span class="star-badge">⭐ ${data.data.length} review${data.data.length > 1 ? 's' : ''}</span>
        </h4>
        <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
          ${data.data
            .map(
              (r) => `
            <div class="review-item">
              <div class="review-header">
                <div>
                  <span class="review-author">${escapeHtml(r.reviewerName)}</span>
                  <span class="review-college">• ${escapeHtml(r.reviewerUniversity)}</span>
                </div>
                <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
              </div>
              <p class="review-comment">"${escapeHtml(r.comment)}"</p>
              <span class="review-date">${new Date(r.createdAt).toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}</span>
            </div>
          `
            )
            .join('')}
        </div>
      `;
    } else {
      container.innerHTML = `
        <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 14px; text-align: center; color: #64748b; font-size: 0.85rem;">
          ⭐ <strong>No reviews yet:</strong> Be the first student to review after booking or exchanging with this peer!
        </div>
      `;
    }
  } catch (err) {
    console.warn('Error loading reviews:', err);
    container.innerHTML = '';
  }
}

/**
 * Configure interactive star rating selection
 */
function setupStarRatingListeners() {
  const stars = document.querySelectorAll('.star-btn');
  const ratingInput = document.getElementById('selectedStarRating');
  const label = document.getElementById('starRatingLabel');
  if (!stars.length || !ratingInput) return;

  const labels = {
    1: '1 - Poor Experience',
    2: '2 - Needs Improvement',
    3: '3 - Satisfactory',
    4: '4 - Very Good Session',
    5: '5 - Exceptional Peer!',
  };

  stars.forEach((star) => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.getAttribute('data-rating'), 10);
      ratingInput.value = rating;
      if (label) label.textContent = labels[rating] || `${rating} Stars`;

      stars.forEach((s) => {
        const r = parseInt(s.getAttribute('data-rating'), 10);
        s.classList.toggle('active', r <= rating);
      });
    });

    star.addEventListener('mouseenter', () => {
      const hoverRating = parseInt(star.getAttribute('data-rating'), 10);
      stars.forEach((s) => {
        const r = parseInt(s.getAttribute('data-rating'), 10);
        s.style.color = r <= hoverRating ? '#f59e0b' : '#cbd5e1';
      });
    });

    star.addEventListener('mouseleave', () => {
      const currentRating = parseInt(ratingInput.value, 10);
      stars.forEach((s) => {
        const r = parseInt(s.getAttribute('data-rating'), 10);
        s.style.color = '';
        s.classList.toggle('active', r <= currentRating);
      });
    });
  });
}

/**
 * Open review submission modal
 */
function openReviewModal(bookingId, serviceTitle, providerName) {
  const idInput = document.getElementById('reviewBookingId');
  const titleEl = document.getElementById('reviewServiceTitle');
  const providerEl = document.getElementById('reviewProviderName');
  const commentEl = document.getElementById('reviewComment');
  const ratingInput = document.getElementById('selectedStarRating');
  const label = document.getElementById('starRatingLabel');

  if (idInput) idInput.value = bookingId;
  if (titleEl) titleEl.textContent = serviceTitle;
  if (providerEl) providerEl.textContent = `Provider: ${providerName}`;
  if (commentEl) commentEl.value = '';
  if (ratingInput) ratingInput.value = 5;
  if (label) label.textContent = '5 - Exceptional Peer!';

  document.querySelectorAll('.star-btn').forEach((s) => s.classList.add('active'));

  openModal('reviewModal');
}

/**
 * Submit peer review and rating
 */
async function handleReviewSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('submitReviewBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
  }

  const bookingId = document.getElementById('reviewBookingId').value;
  const rating = parseInt(document.getElementById('selectedStarRating').value, 10);
  const comment = document.getElementById('reviewComment').value.trim();

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ bookingId, rating, comment }),
    });

    const result = await res.json();

    if (result.success) {
      showToast(result.message || '⭐ Review submitted successfully!', 'success');
      closeModal('reviewModal');
      await checkAuthStatus();
      openDashboard();
      loadServices();
      loadStudents();
    } else {
      showToast(result.message || 'Failed to submit review.', 'info');
    }
  } catch (err) {
    console.error('Submit review error:', err);
    showToast('Failed to connect to server.', 'info');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Review';
    }
  }
}

/* ==========================================================================
   🛡️ Admin Control Center Dashboard Functions
   ========================================================================== */
let adminUsersCache = [];
let adminServicesCache = [];

async function openAdminDashboard() {
  if (!currentUser) {
    openModal('loginModal');
    return;
  }

  openModal('adminModal');
  switchAdminTab('overview');
}

function switchAdminTab(tabName) {
  document.querySelectorAll('.admin-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-admintab') === tabName);
  });

  const panes = ['Overview', 'Users', 'Services', 'Bookings'];
  panes.forEach((p) => {
    const el = document.getElementById(`adminPane${p}`);
    if (el) el.style.display = p.toLowerCase() === tabName.toLowerCase() ? 'block' : 'none';
  });

  if (tabName === 'overview') loadAdminStats();
  if (tabName === 'users') loadAdminUsers();
  if (tabName === 'services') loadAdminServices();
  if (tabName === 'bookings') loadAdminBookings();
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();

    if (result.success && result.data) {
      const d = result.data;
      document.getElementById('kpiTotalUsers').textContent = d.users.total;
      document.getElementById('kpiUsersSub').textContent = `${d.users.students} Students • ${d.users.admins} Admins`;
      document.getElementById('kpiTotalServices').textContent = d.services.total;
      document.getElementById('kpiServicesSub').textContent = `${d.services.active} Active • ${d.services.paused} Paused`;
      document.getElementById('kpiTotalBookings').textContent = d.bookings.total;
      document.getElementById('kpiBookingsSub').textContent = `${d.bookings.completed} Completed • ${d.bookings.pending} Pending`;
      document.getElementById('kpiTotalVolume').textContent = `₹${(d.financials.totalSimulatedVolumeINR || 0).toLocaleString('en-IN')}`;
      document.getElementById('kpiCollegesSub').textContent = `Across ${d.collegesCount} Colleges`;

      document.getElementById('adminTabUsersCount').textContent = d.users.total;
      document.getElementById('adminTabServicesCount').textContent = d.services.total;
      document.getElementById('adminTabBookingsCount').textContent = d.bookings.total;

      const claimBanner = document.getElementById('adminClaimBanner');
      if (claimBanner) claimBanner.style.display = d.users.admins === 0 ? 'flex' : 'none';

      const usersList = document.getElementById('adminRecentUsersList');
      if (usersList) {
        usersList.innerHTML =
          d.recentActivity.users
            .map(
              (u) => `
          <div class="admin-mini-row">
            <div>
              <strong>${escapeHtml(u.name)}</strong> (${escapeHtml(u.university)})
              <small style="display:block; color:#64748b;">${escapeHtml(u.email)}</small>
            </div>
            <span class="role-badge-${u.role}">${u.role.toUpperCase()}</span>
          </div>
        `
            )
            .join('') || '<p style="color:#64748b; font-size:0.85rem;">No recent users.</p>';
      }

      const servicesList = document.getElementById('adminRecentServicesList');
      if (servicesList) {
        servicesList.innerHTML =
          d.recentActivity.services
            .map(
              (s) => `
          <div class="admin-mini-row">
            <div>
              <strong>${escapeHtml(s.title)}</strong>
              <small style="display:block; color:#64748b;">${escapeHtml(s.category)} • By ${escapeHtml(
                (s.provider && s.provider.name) || 'Student'
              )}</small>
            </div>
            <span class="status-badge status-badge-${s.status === 'active' ? 'accepted' : 'cancelled'}">${s.status}</span>
          </div>
        `
            )
            .join('') || '<p style="color:#64748b; font-size:0.85rem;">No recent services.</p>';
      }
    } else if (res.status === 403) {
      showToast('Admin privileges required to view admin stats.', 'info');
    }
  } catch (err) {
    console.error('Error loading admin stats:', err);
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">Loading users...</td></tr>`;

  try {
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();

    if (result.success && result.data) {
      adminUsersCache = result.data;
      renderAdminUsersTable(result.data);
    } else {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626;">${result.message || 'Failed to load users.'}</td></tr>`;
    }
  } catch (err) {
    console.error('Error fetching admin users:', err);
  }
}

function renderAdminUsersTable(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">No students match criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((u) => {
      const isSelf = currentUser && (currentUser._id === u._id || currentUser.id === u._id);
      const verifyBtn = `<button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 3px 8px;" onclick="toggleAdminUserVerify('${u._id}')">${u.isVerifiedStudent ? 'Revoke Verify' : 'Verify Student'}</button>`;
      const roleBtn = isSelf
        ? ''
        : `<button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 3px 8px;" onclick="toggleAdminUserRole('${u._id}', '${u.role}')">${u.role === 'admin' ? 'Make Student' : 'Make Admin'}</button>`;
      const deleteBtn = isSelf
        ? ''
        : `<button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 3px 8px; color: #dc2626; border-color: #fecaca;" onclick="deleteAdminUser('${u._id}', '${escapeHtml(u.name)}')">Delete</button>`;

      return `
      <tr>
        <td><strong>${escapeHtml(u.name)}</strong> ${u.rating > 0 ? `<small style="color:#f59e0b;">(⭐${u.rating})</small>` : ''}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.university)}</td>
        <td><span class="role-badge-${u.role}">${u.role.toUpperCase()}</span></td>
        <td><span class="status-badge ${u.isVerifiedStudent ? 'status-badge-accepted' : 'status-badge-pending'}">${u.isVerifiedStudent ? 'Verified' : 'Unverified'}</span></td>
        <td>${new Date(u.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${verifyBtn}
            ${roleBtn}
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

function filterAdminUsers() {
  const search = (document.getElementById('adminUserSearch')?.value || '').toLowerCase().trim();
  const role = document.getElementById('adminUserRoleFilter')?.value || 'all';

  let filtered = adminUsersCache.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.university.toLowerCase().includes(search);
    const matchRole = role === 'all' || u.role === role;
    return matchSearch && matchRole;
  });

  renderAdminUsersTable(filtered);
}

async function toggleAdminUserVerify(id) {
  try {
    const res = await fetch(`/api/admin/users/${id}/verify`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      loadAdminUsers();
      loadStudents();
    } else {
      showToast(result.message || 'Error updating verification', 'info');
    }
  } catch (e) {
    showToast('Failed to update verification', 'info');
  }
}

async function toggleAdminUserRole(id, currentRole) {
  const newRole = currentRole === 'admin' ? 'student' : 'admin';
  if (!confirm(`Are you sure you want to change this user's role to ${newRole.toUpperCase()}?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ role: newRole }),
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      loadAdminUsers();
    } else {
      showToast(result.message || 'Error updating role', 'info');
    }
  } catch (e) {
    showToast('Failed to update role', 'info');
  }
}

async function deleteAdminUser(id, name) {
  if (!confirm(`Are you sure you want to permanently delete user "${name}" and all their listings?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();
    if (result.success) {
      showToast('User account removed.', 'success');
      loadAdminUsers();
      loadServices();
      loadStudents();
      loadStats();
    } else {
      showToast(result.message || 'Error deleting user', 'info');
    }
  } catch (e) {
    showToast('Failed to delete user', 'info');
  }
}

async function loadAdminServices() {
  const tbody = document.getElementById('adminServicesTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">Loading services...</td></tr>`;

  try {
    const res = await fetch('/api/admin/services', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();

    if (result.success && result.data) {
      adminServicesCache = result.data;
      renderAdminServicesTable(result.data);
    } else {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626;">${result.message || 'Failed to load services.'}</td></tr>`;
    }
  } catch (err) {
    console.error('Error fetching admin services:', err);
  }
}

function renderAdminServicesTable(services) {
  const tbody = document.getElementById('adminServicesTableBody');
  if (!tbody) return;

  if (services.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">No services match criteria.</td></tr>`;
    return;
  }

  tbody.innerHTML = services
    .map((s) => {
      const isPaused = s.status === 'paused';
      return `
      <tr>
        <td><strong>${escapeHtml(s.title)}</strong></td>
        <td>${escapeHtml((s.provider && s.provider.name) || 'Student')} <small style="display:block; color:#64748b;">${escapeHtml(
        (s.provider && s.provider.university) || ''
      )}</small></td>
        <td><span class="card-tag">${escapeHtml(s.category)}</span></td>
        <td><span style="text-transform: capitalize;">${escapeHtml(s.serviceType)}</span></td>
        <td><strong>${s.serviceType === 'exchange' ? 'Free Barter' : `₹${s.price}`}</strong></td>
        <td><span class="status-badge ${isPaused ? 'status-badge-cancelled' : 'status-badge-accepted'}">${s.status}</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 3px 8px;" onclick="toggleAdminServiceStatus('${s._id}', '${s.status}')">
              ${isPaused ? 'Activate' : 'Pause'}
            </button>
            <button class="btn btn-outline btn-sm" style="font-size: 0.75rem; padding: 3px 8px; color: #dc2626; border-color: #fecaca;" onclick="deleteAdminService('${s._id}', '${escapeHtml(s.title)}')">
              Delete
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join('');
}

function filterAdminServices() {
  const search = (document.getElementById('adminServiceSearch')?.value || '').toLowerCase().trim();
  const status = document.getElementById('adminServiceStatusFilter')?.value || 'all';

  let filtered = adminServicesCache.filter((s) => {
    const matchSearch =
      !search ||
      s.title.toLowerCase().includes(search) ||
      (s.provider && s.provider.name && s.provider.name.toLowerCase().includes(search));
    const matchStatus = status === 'all' || s.status === status;
    return matchSearch && matchStatus;
  });

  renderAdminServicesTable(filtered);
}

async function toggleAdminServiceStatus(id, currentStatus) {
  const newStatus = currentStatus === 'active' ? 'paused' : 'active';
  try {
    const res = await fetch(`/api/admin/services/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      loadAdminServices();
      loadServices();
    } else {
      showToast(result.message || 'Error updating status', 'info');
    }
  } catch (e) {
    showToast('Failed to update service status', 'info');
  }
}

async function deleteAdminService(id, title) {
  if (!confirm(`Are you sure you want to remove listing "${title}" from the marketplace?`)) return;

  try {
    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();
    if (result.success) {
      showToast('Service listing removed by admin.', 'success');
      loadAdminServices();
      loadServices();
      loadStats();
    } else {
      showToast(result.message || 'Error deleting service', 'info');
    }
  } catch (e) {
    showToast('Failed to delete service', 'info');
  }
}

async function loadAdminBookings() {
  const tbody = document.getElementById('adminBookingsTableBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">Loading bookings...</td></tr>`;

  const status = document.getElementById('adminBookingStatusFilter')?.value || 'all';
  const query = status !== 'all' ? `?status=${status}` : '';

  try {
    const res = await fetch(`/api/admin/bookings${query}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();

    if (result.success && result.data) {
      if (result.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">No bookings found.</td></tr>`;
        return;
      }

      tbody.innerHTML = result.data
        .map(
          (b) => `
        <tr>
          <td><strong>${escapeHtml(b.serviceTitle)}</strong></td>
          <td><span style="text-transform: capitalize;">${escapeHtml(b.serviceType)}</span></td>
          <td>${escapeHtml(b.clientName)} <small style="display:block; color:#64748b;">${escapeHtml(
            b.clientUniversity || 'Student'
          )}</small></td>
          <td>${escapeHtml(b.providerName)}</td>
          <td>${b.serviceType === 'exchange' ? `⇄ Barter: "${escapeHtml(b.exchangeOffer)}"` : `₹${b.price}`}</td>
          <td><span class="status-badge status-badge-${b.status}">${b.status.toUpperCase()}</span></td>
          <td>${new Date(b.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}</td>
        </tr>
      `
        )
        .join('');
    } else {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626;">${result.message || 'Failed to load bookings.'}</td></tr>`;
    }
  } catch (err) {
    console.error('Error fetching admin bookings:', err);
  }
}

async function claimPlatformAdmin() {
  try {
    const res = await fetch('/api/admin/claim-owner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message, 'success');
      await checkAuthStatus();
      loadAdminStats();
    } else {
      showToast(result.message || 'Unable to claim admin.', 'info');
    }
  } catch (err) {
    showToast('Failed to claim admin.', 'info');
  }
}

/* ==========================================================================
   💬 In-App Student Messaging / Chat System Functions
   ========================================================================== */
let activeChatPartnerId = null;
let chatPollingTimer = null;

/**
 * Fetch total unread message count and update badges
 */
async function fetchUnreadCount() {
  if (!authToken || !currentUser) {
    const navDot = document.getElementById('navUnreadDot');
    if (navDot) navDot.style.display = 'none';
    return;
  }

  try {
    const res = await fetch('/api/messages/unread-count', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();

    if (result.success) {
      const count = result.unreadCount || 0;
      const navDot = document.getElementById('navUnreadDot');
      if (navDot) {
        navDot.style.display = count > 0 ? 'inline-block' : 'none';
      }

      const dashCount = document.getElementById('countMessages');
      if (dashCount) {
        dashCount.textContent = count;
      }
    }
  } catch (err) {
    console.warn('Could not fetch unread messages count:', err);
  }
}

/**
 * Open Messages from Navbar
 */
async function openMessagesFromNav() {
  if (!currentUser || !authToken) {
    openModal('loginModal');
    return;
  }

  await openDashboard();
  // Switch to messages tab
  const msgTab = document.querySelector('.dash-tab[data-tab="myMessages"]');
  if (msgTab) {
    msgTab.click();
  }
}

/**
 * Open Direct Chat Modal with a specific student peer
 */
async function openDirectChat(partnerId, partnerName, partnerCollege, serviceId, serviceTitle, bookingId) {
  if (!currentUser || !authToken) {
    showToast('Please sign in or register to message student peers.', 'info');
    openModal('loginModal');
    return;
  }

  const currentId = (currentUser._id || currentUser.id).toString();
  if (partnerId && partnerId.toString() === currentId) {
    showToast('This is your own profile.', 'info');
    return;
  }

  activeChatPartnerId = partnerId;

  // Set form hidden inputs
  const partnerInput = document.getElementById('chatPartnerId');
  if (partnerInput) partnerInput.value = partnerId;

  const srvInput = document.getElementById('chatServiceId');
  if (srvInput) srvInput.value = serviceId || '';

  const bkgInput = document.getElementById('chatBookingId');
  if (bkgInput) bkgInput.value = bookingId || '';

  // Set header info
  const nameEl = document.getElementById('chatModalPartnerName');
  if (nameEl) nameEl.textContent = partnerName || 'Student Peer';

  const collegeEl = document.getElementById('chatModalPartnerCollege');
  if (collegeEl) collegeEl.textContent = partnerCollege || 'Campus Peer';

  const avatarEl = document.getElementById('chatModalAvatar');
  if (avatarEl) {
    const initials = (partnerName || 'ST')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2);
    avatarEl.textContent = initials;
  }

  // Context banner
  const contextBanner = document.getElementById('chatContextBanner');
  const contextText = document.getElementById('chatContextText');
  if (contextBanner && contextText) {
    if (serviceTitle) {
      contextBanner.style.display = 'flex';
      contextText.textContent = `Discussing: ${serviceTitle}`;
    } else {
      contextBanner.style.display = 'none';
    }
  }

  // Clear previous message text
  const inputEl = document.getElementById('chatInputText');
  if (inputEl) inputEl.value = '';

  openModal('chatModal');
  await loadThread(partnerId);

  // Focus message input
  setTimeout(() => {
    if (inputEl) inputEl.focus();
  }, 150);
}

/**
 * Load Message Thread in Chat Modal
 */
async function loadThread(partnerId) {
  const stream = document.getElementById('chatMessageStream');
  if (!stream) return;

  try {
    const res = await fetch(`/api/messages/thread/${partnerId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();

    if (result.success) {
      const messages = result.data || [];
      const currentId = (currentUser._id || currentUser.id).toString();

      if (messages.length === 0) {
        stream.innerHTML = `
          <div style="text-align: center; padding: 40px 16px; color: #94a3b8;">
            <div style="font-size: 2rem; margin-bottom: 8px;">👋</div>
            <p style="margin: 0; font-size: 0.95rem; font-weight: 600; color: #475569;">Start the conversation!</p>
            <p style="margin: 4px 0 0; font-size: 0.8rem;">Ask about availability, project details, or barter ideas.</p>
          </div>
        `;
      } else {
        stream.innerHTML = messages
          .map((msg) => {
            const isMine = (msg.sender && (msg.sender._id || msg.sender).toString()) === currentId;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            return `
              <div class="chat-bubble ${isMine ? 'chat-bubble-sent' : 'chat-bubble-received'}">
                ${
                  msg.service && msg.service.title
                    ? `<div style="font-size: 0.72rem; opacity: 0.85; margin-bottom: 3px; font-weight: 600;">📌 Re: ${escapeHtml(msg.service.title)}</div>`
                    : ''
                }
                <div>${escapeHtml(msg.content)}</div>
                <span class="chat-time ${isMine ? 'chat-time-sent' : 'chat-time-received'}">
                  ${timeStr} ${isMine ? (msg.read ? '✓✓' : '✓') : ''}
                </span>
              </div>
            `;
          })
          .join('');
      }

      // Auto-scroll to bottom of stream
      stream.scrollTop = stream.scrollHeight;
      fetchUnreadCount();
    } else {
      stream.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">${result.message || 'Failed to load messages.'}</div>`;
    }
  } catch (err) {
    console.error('Error loading thread:', err);
    stream.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px;">Network error loading messages.</div>`;
  }
}

/**
 * Handle sending a message in the Chat Modal
 */
async function handleSendMessage(e) {
  e.preventDefault();
  const inputEl = document.getElementById('chatInputText');
  const partnerInput = document.getElementById('chatPartnerId');
  const srvInput = document.getElementById('chatServiceId');
  const bkgInput = document.getElementById('chatBookingId');
  const sendBtn = document.getElementById('chatSendBtn');

  if (!inputEl || !partnerInput) return;

  const content = inputEl.value.trim();
  const recipientId = partnerInput.value;
  const serviceId = srvInput?.value || null;
  const bookingId = bkgInput?.value || null;

  if (!content) return;

  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        recipientId,
        content,
        serviceId,
        bookingId,
      }),
    });

    const result = await res.json();

    if (result.success) {
      inputEl.value = '';
      await loadThread(recipientId);
    } else {
      showToast(result.message || 'Could not send message.', 'info');
    }
  } catch (err) {
    console.error('Send message error:', err);
    showToast('Failed to connect to messaging server.', 'info');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    inputEl.focus();
  }
}

/**
 * Refresh current active thread
 */
function refreshActiveThread() {
  if (activeChatPartnerId) {
    loadThread(activeChatPartnerId);
    showToast('Thread refreshed.', 'info');
  }
}

/**
 * Close chat modal
 */
function closeChatModal() {
  activeChatPartnerId = null;
  closeModal('chatModal');
}

/**
 * Load Conversations for Dashboard Tab
 */
async function loadDashboardConversations() {
  const listEl = document.getElementById('dashConversationsList');
  if (!listEl || !authToken) return;

  listEl.innerHTML = `<div style="text-align: center; padding: 24px 12px; color: #94a3b8; font-size: 0.85rem;">Loading conversations...</div>`;

  try {
    const res = await fetch('/api/messages/conversations', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();

    if (result.success) {
      const convos = result.data || [];
      document.getElementById('countMessages').textContent = result.count || 0;

      if (convos.length === 0) {
        listEl.innerHTML = `
          <div style="text-align: center; padding: 32px 14px; color: #94a3b8; font-size: 0.82rem;">
            <p style="margin: 0;">No active chats yet.</p>
            <p style="margin: 6px 0 0; color: #64748b;">Browse student listings or profiles to start chatting!</p>
          </div>
        `;
        return;
      }

      listEl.innerHTML = convos
        .map((conv) => {
          const partner = conv.partner;
          const initials = (partner.name || 'ST')
            .split(' ')
            .map((n) => n[0])
            .join('')
            .substring(0, 2);
          const timeStr = new Date(conv.lastMessage.createdAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
          });

          return `
            <div class="conv-item" onclick="selectDashboardConversation('${partner._id}', '${escapeHtml(partner.name)}', '${escapeHtml(partner.university || '')}')">
              <div class="avatar-circle" style="width: 36px; height: 36px; font-size: 0.85rem;">${escapeHtml(initials)}</div>
              <div class="conv-info">
                <div class="conv-name-row">
                  <span class="conv-name">${escapeHtml(partner.name)}</span>
                  <span class="conv-time">${timeStr}</span>
                </div>
                <div class="conv-snippet-row">
                  <p class="conv-snippet">${escapeHtml(conv.lastMessage.content)}</p>
                  ${conv.unreadCount > 0 ? `<span class="unread-badge-pill">${conv.unreadCount}</span>` : ''}
                </div>
              </div>
            </div>
          `;
        })
        .join('');
    } else {
      listEl.innerHTML = `<div style="text-align: center; padding: 20px; color: #dc2626; font-size: 0.82rem;">Failed to load conversations.</div>`;
    }
  } catch (err) {
    console.error('Error loading conversations:', err);
    listEl.innerHTML = `<div style="text-align: center; padding: 20px; color: #dc2626; font-size: 0.82rem;">Connection error.</div>`;
  }
}

/**
 * Select and open conversation thread inside Student Dashboard
 */
async function selectDashboardConversation(partnerId, partnerName, partnerCollege) {
  // Highlight active conversation
  document.querySelectorAll('#dashConversationsList .conv-item').forEach((item) => {
    item.classList.remove('active');
  });

  const mainPane = document.getElementById('dashMessengerMain');
  if (!mainPane) return;

  const initials = (partnerName || 'ST')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2);

  mainPane.innerHTML = `
    <div class="chat-modal-header" style="background: white; border-bottom: 1px solid #e2e8f0;">
      <div class="chat-header-user">
        <div class="avatar-circle" style="width: 40px; height: 40px;">${escapeHtml(initials)}</div>
        <div>
          <h4 style="margin: 0; font-size: 0.98rem; font-weight: 700; color: #0f172a;">${escapeHtml(partnerName)}</h4>
          <span style="font-size: 0.78rem; color: #2563eb; font-weight: 600;">${escapeHtml(partnerCollege || 'Student Peer')}</span>
        </div>
      </div>
      <button class="btn btn-outline btn-xs" onclick="selectDashboardConversation('${partnerId}', '${escapeHtml(partnerName)}', '${escapeHtml(partnerCollege)}')">🔄 Refresh</button>
    </div>

    <div class="chat-message-stream" id="dashChatStream" style="height: 330px; flex: 1;">
      <div style="text-align: center; padding: 24px; color: #94a3b8;">Loading messages...</div>
    </div>

    <form id="dashChatSendForm" class="chat-input-bar" onsubmit="handleSendDashboardMessage(event, '${partnerId}', '${escapeHtml(partnerName)}', '${escapeHtml(partnerCollege)}')">
      <input type="text" id="dashChatInputText" class="chat-input" placeholder="Type a message to ${escapeHtml(partnerName)}..." required autocomplete="off">
      <button type="submit" class="btn btn-primary btn-chat-send" id="dashChatSendBtn">
        <span>Send</span>
      </button>
    </form>
  `;

  // Fetch thread messages
  try {
    const res = await fetch(`/api/messages/thread/${partnerId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();
    const stream = document.getElementById('dashChatStream');

    if (result.success && stream) {
      const messages = result.data || [];
      const currentId = (currentUser._id || currentUser.id).toString();

      if (messages.length === 0) {
        stream.innerHTML = `<div style="text-align: center; padding: 32px; color: #94a3b8;">No messages yet. Send a greeting!</div>`;
      } else {
        stream.innerHTML = messages
          .map((msg) => {
            const isMine = (msg.sender && (msg.sender._id || msg.sender).toString()) === currentId;
            const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
              <div class="chat-bubble ${isMine ? 'chat-bubble-sent' : 'chat-bubble-received'}">
                ${msg.service && msg.service.title ? `<div style="font-size: 0.72rem; opacity: 0.85; margin-bottom: 2px;">📌 Re: ${escapeHtml(msg.service.title)}</div>` : ''}
                <div>${escapeHtml(msg.content)}</div>
                <span class="chat-time ${isMine ? 'chat-time-sent' : 'chat-time-received'}">${timeStr}</span>
              </div>
            `;
          })
          .join('');
      }

      stream.scrollTop = stream.scrollHeight;
      fetchUnreadCount();
    }
  } catch (err) {
    console.error('Error fetching dashboard thread:', err);
  }
}

/**
 * Handle sending message from Dashboard Chat
 */
async function handleSendDashboardMessage(e, partnerId, partnerName, partnerCollege) {
  e.preventDefault();
  const input = document.getElementById('dashChatInputText');
  const btn = document.getElementById('dashChatSendBtn');
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        recipientId: partnerId,
        content,
      }),
    });

    const result = await res.json();
    if (result.success) {
      input.value = '';
      await selectDashboardConversation(partnerId, partnerName, partnerCollege);
      loadDashboardConversations();
    } else {
      showToast(result.message || 'Failed to send message.', 'info');
    }
  } catch (err) {
    console.error('Dashboard send error:', err);
    showToast('Failed to connect to messaging server.', 'info');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Background poller for unread messages (every 25 seconds when logged in)
setInterval(() => {
  if (currentUser && authToken) {
    fetchUnreadCount();
  }
}, 25000);


