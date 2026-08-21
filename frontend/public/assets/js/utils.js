// Toast notification
let _toastTimer = null;
function showToast(message, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'fixed bottom-5 right-5 z-50 px-5 py-3 rounded-lg shadow-lg text-white text-sm transition-all duration-300';
    document.body.appendChild(el);
  }
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600', warning: 'bg-yellow-500' };
  el.className = el.className.replace(/bg-\S+/, '') + ' ' + (colors[type] || colors.info);
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 3500);
}

function formatDate(dateStr, includeTime = false) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  if (includeTime) { opts.hour = '2-digit'; opts.minute = '2-digit'; }
  return d.toLocaleDateString('en-PH', opts);
}

function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

function $(selector, parent = document) { return parent.querySelector(selector); }
function $$(selector, parent = document) { return [...parent.querySelectorAll(selector)]; }

function setText(selector, text) {
  const el = $(selector);
  if (el) el.textContent = text;
}

function setHref(selector, href) {
  const el = $(selector);
  if (el) el.href = href;
}

function show(selector) { const el = $(selector); if (el) el.classList.remove('hidden'); }
function hide(selector) { const el = $(selector); if (el) el.classList.add('hidden'); }

function stripHtml(str) {
  const d = document.createElement('div');
  d.innerHTML = str;
  return d.textContent || '';
}

function statusBadgeClass(status) {
  const map = {
    draft:             'bg-gray-100 text-gray-700',
    submitted:         'bg-blue-100 text-blue-700',
    under_review:      'bg-yellow-100 text-yellow-700',
    approved:          'bg-green-100 text-green-700',
    rejected:          'bg-red-100 text-red-700',
    revision_required: 'bg-orange-100 text-orange-700',
    scheduled:         'bg-blue-100 text-blue-700',
    completed:         'bg-green-100 text-green-700',
    cancelled:         'bg-red-100 text-red-700',
    rescheduled:       'bg-purple-100 text-purple-700',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
}

function statusLabel(status) {
  return (status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Appends invisible filler rows to a paginated table body so a short page
// (e.g. the last page, or a filtered result set) doesn't visibly shrink the
// table. `lines` should match the tallest real row's line count so filler
// rows take up roughly the same height.
function padTableRows(tbody, rowCount, pageSize, colspan, lines = 1) {
  const fillerCount = pageSize - rowCount;
  if (!tbody || rowCount <= 0 || fillerCount <= 0) return;
  const content = lines >= 2 ? '&nbsp;<br>&nbsp;' : '&nbsp;';
  let html = '';
  for (let i = 0; i < fillerCount; i++) {
    html += `<tr class="border-b border-gray-100" aria-hidden="true"><td colspan="${colspan}" class="px-4 py-3">${content}</td></tr>`;
  }
  tbody.insertAdjacentHTML('beforeend', html);
}

// Adds a show/hide eye icon to every password field on the page (including
// fields inside modals that are hidden at load time). Runs once per input.
const EYE_ICON_SVG = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
</svg>`;
const EYE_SLASH_ICON_SVG = `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
</svg>`;

function initPasswordToggles() {
  document.querySelectorAll('input[type="password"]').forEach(input => {
    if (input.dataset.toggleAttached) return;
    input.dataset.toggleAttached = '1';

    let wrapper = input.parentElement;
    if (!wrapper.classList.contains('relative')) {
      wrapper = document.createElement('div');
      wrapper.className = 'relative';
      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);
    }
    input.classList.add('pr-10');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Show password');
    btn.className = 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600';
    btn.innerHTML = EYE_ICON_SVG;
    btn.addEventListener('click', () => {
      const hidden = input.type === 'password';
      input.type = hidden ? 'text' : 'password';
      btn.innerHTML = hidden ? EYE_SLASH_ICON_SVG : EYE_ICON_SVG;
      btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
    });
    wrapper.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', initPasswordToggles);

// Hover-triggered quick-navigation menu, injected into the top nav bar of
// every role page so users don't have to return to the dashboard to move
// between pages.
const NAV_ITEMS = {
  superadmin: [
    { label: 'Dashboard', href: '/pages/superadmin/dashboard.html' },
    { label: 'Users',     href: '/pages/superadmin/users.html' },
  ],
  admin: [
    { label: 'Dashboard',    href: '/pages/admin/dashboard.html' },
    { label: 'Users',        href: '/pages/admin/users.html' },
    { label: 'Panelists',    href: '/pages/admin/panelists.html' },
    { label: 'Venues',       href: '/pages/admin/venues.html' },
    { label: 'Schedules',    href: '/pages/admin/schedules.html' },
    { label: 'Submissions',  href: '/pages/admin/submissions.html' },
    { label: 'Archive',      href: '/pages/admin/archive.html' },
    { label: 'Upload Templates', href: '/pages/admin/upload-imrad.html' },
  ],
  instructor: [
    { label: 'Dashboard',               href: '/pages/instructor/dashboard.html' },
    { label: 'My Advisees',             href: '/pages/instructor/my-advisees.html' },
    { label: 'Group Requests',          href: '/pages/instructor/group-requests.html' },
    { label: 'Create Student Accounts', href: '/pages/instructor/import-students.html' },
    { label: 'Upload Adviser List',     href: '/pages/instructor/upload-adviser-list.html' },
    { label: 'Guidelines',              href: '/pages/instructor/guidelines.html' },
    { label: 'Account Settings',        href: '/pages/instructor/settings.html' },
  ],
  panelist: [
    { label: 'Dashboard',    href: '/pages/panelist/dashboard.html' },
    { label: 'My Schedules', href: '/pages/panelist/my-schedules.html' },
  ],
  student: [
    { label: 'Dashboard',       href: '/pages/student/dashboard.html' },
    { label: 'My Group',        href: '/pages/student/my-group.html' },
    { label: 'Upload Document', href: '/pages/student/upload-document.html' },
    { label: 'My Schedule',     href: '/pages/student/my-schedule.html' },
    { label: 'My Results',      href: '/pages/student/my-scores.html' },
    { label: 'Browse Archive',  href: '/pages/student/browse-archive.html' },
    { label: 'Guidelines & Templates', href: '/pages/student/guidelines.html' },
    { label: 'Account Settings', href: '/pages/student/settings.html' },
  ],
};

const NAV_ICONS = {
  'Dashboard': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
  'Users': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
  'Panelists': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  'Venues': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  'Schedules': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  'My Schedules': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  'My Schedule': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`,
  'Submissions': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`,
  'Archive': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>`,
  'Browse Archive': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>`,
  'My Group': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  'My Advisees': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`,
  'Group Requests': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>`,
  'Create Student Accounts': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/></svg>`,
  'Upload Adviser List': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>`,
  'Upload Templates': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>`,
  'Upload Document': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>`,
  'My Results': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`,
  'Guidelines': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
  'Guidelines & Templates': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>`,
  'Account Settings': `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
};

function _waitForNavUser(maxMs = 4000) {
  return new Promise(resolve => {
    const start = Date.now();
    (function poll() {
      if (typeof getUser === 'function') {
        const u = getUser();
        if (u) return resolve(u);
      }
      if (Date.now() - start >= maxMs) return resolve(null);
      setTimeout(poll, 100);
    })();
  });
}

function initHoverNav() {
  if (document.getElementById('side-nav-tab')) return;

  const navGroup = document.querySelector('nav .flex.items-center.gap-3');
  if (!navGroup) return;

  _waitForNavUser().then(user => {
    const items = user && NAV_ITEMS[user.role];
    if (!items || !items.length) return;

    const currentPath = window.location.pathname;
    const roleTitle = (user.role || 'User').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const userName = user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : (user.email || 'User');
    const userInitial = (user.first_name ? user.first_name[0] : (user.email ? user.email[0] : 'U')).toUpperCase();

    // Hamburger button in top nav
    const tab = document.createElement('button');
    tab.id = 'side-nav-tab';
    tab.type = 'button';
    tab.setAttribute('aria-label', 'Open navigation menu');
    tab.setAttribute('aria-haspopup', 'true');
    tab.setAttribute('aria-expanded', 'false');
    tab.className = 'p-2 -ml-1 text-primary-100 hover:text-white hover:bg-primary-600/70 rounded-xl transition-all cursor-pointer flex items-center justify-center';
    tab.innerHTML = `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 6h16M4 12h16M4 18h16"/></svg>`;

    // Backdrop overlay
    const backdrop = document.createElement('div');
    backdrop.id = 'side-nav-backdrop';
    backdrop.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 opacity-0 pointer-events-none transition-opacity duration-200';

    // Slide-out Drawer Panel (Spacious w-72 layout)
    const panel = document.createElement('div');
    panel.id = 'side-nav-panel';
    panel.className = 'fixed left-0 top-0 h-full w-72 bg-white shadow-2xl z-50 -translate-x-full transition-transform duration-200 flex flex-col border-r border-gray-200';
    panel.innerHTML = `
      <!-- Brand Header -->
      <div class="bg-gradient-to-r from-primary-800 to-primary-700 text-white px-5 py-5 flex items-center justify-between border-b border-primary-900/30">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-white p-1.5 flex items-center justify-center flex-shrink-0 shadow-sm">
            <img src="/assets/img/aw.webp" alt="DNSC Logo" class="w-full h-full object-contain">
          </div>
          <div class="min-w-0">
            <h2 class="font-bold text-base text-white tracking-tight leading-tight truncate">ACES Research</h2>
            <p class="text-xs text-primary-200 font-medium tracking-wide truncate">${roleTitle} Portal</p>
          </div>
        </div>
        <button type="button" id="side-nav-close" aria-label="Close navigation menu" class="p-1.5 text-primary-200 hover:text-white hover:bg-white/15 rounded-xl transition-all cursor-pointer flex-shrink-0 ml-1">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Navigation Section -->
      <div class="flex-1 overflow-y-auto px-3 py-4">
        <div class="px-3 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          Menu Navigation
        </div>
        <nav class="space-y-1.5">
          ${items.map(item => {
            const active = currentPath === item.href || (item.label === 'My Schedules' && currentPath.includes('/evaluate.html'));
            const icon = NAV_ICONS[item.label] || `<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>`;
            return `
              <a href="${item.href}" class="flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${active
                ? 'bg-primary-700 text-white font-semibold shadow-sm'
                : 'text-gray-600 hover:bg-primary-50/80 hover:text-primary-800 hover:translate-x-0.5'}">
                <span class="${active ? 'text-white' : 'text-gray-400 group-hover:text-primary-600 transition-colors'}">${icon}</span>
                <span class="truncate">${item.label}</span>
                ${active ? '<span class="ml-auto w-1.5 h-1.5 rounded-full bg-white flex-shrink-0"></span>' : ''}
              </a>
            `;
          }).join('')}
        </nav>
      </div>

      <!-- User Profile Footer -->
      <div class="p-4 border-t border-gray-100 bg-gray-50/60">
        <div class="flex items-center justify-between gap-3 p-2.5 bg-white rounded-xl shadow-xs border border-gray-200/70">
          <div class="w-9 h-9 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-sm flex-shrink-0">
            ${userInitial}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-gray-900 truncate leading-tight">${userName}</p>
            <p class="text-[11px] text-gray-500 capitalize leading-tight mt-0.5">${user.role || ''}</p>
          </div>
          <button onclick="logout()" title="Sign out" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer flex-shrink-0">
            <svg class="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
          </button>
        </div>
      </div>
    `;

    function openPanel() {
      panel.classList.remove('-translate-x-full');
      backdrop.classList.remove('opacity-0', 'pointer-events-none');
      backdrop.classList.add('opacity-100');
      tab.setAttribute('aria-expanded', 'true');
    }

    function closePanel() {
      panel.classList.add('-translate-x-full');
      backdrop.classList.remove('opacity-100');
      backdrop.classList.add('opacity-0', 'pointer-events-none');
      tab.setAttribute('aria-expanded', 'false');
    }

    tab.addEventListener('click', openPanel);
    panel.querySelector('#side-nav-close').addEventListener('click', closePanel);
    backdrop.addEventListener('click', closePanel);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

    navGroup.insertBefore(tab, navGroup.firstChild);
    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
  });
}

document.addEventListener('DOMContentLoaded', initHoverNav);

