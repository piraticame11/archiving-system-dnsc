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
    { label: 'Create Student Accounts', href: '/pages/instructor/import-students.html' },
    { label: 'Upload Adviser List',     href: '/pages/instructor/upload-adviser-list.html' },
    { label: 'Title Approval',          href: '/pages/instructor/title-approval.html' },
    { label: 'Guidelines',              href: '/pages/instructor/guidelines.html' },
  ],
  panelist: [
    { label: 'Dashboard',    href: '/pages/panelist/dashboard.html' },
    { label: 'My Schedules', href: '/pages/panelist/my-schedules.html' },
  ],
  student: [
    { label: 'Dashboard',       href: '/pages/student/dashboard.html' },
    { label: 'My Group',        href: '/pages/student/my-group.html' },
    { label: 'Submit Title',    href: '/pages/student/submit-title.html' },
    { label: 'My Submissions',  href: '/pages/student/my-submissions.html' },
    { label: 'Upload Document', href: '/pages/student/upload-document.html' },
    { label: 'My Schedule',     href: '/pages/student/my-schedule.html' },
    { label: 'My Results',      href: '/pages/student/my-scores.html' },
    { label: 'Browse Archive',  href: '/pages/student/browse-archive.html' },
    { label: 'Guidelines & Templates', href: '/pages/student/guidelines.html' },
  ],
};

// getUser() only becomes available once requireAuthAsync() (called by the
// page itself) restores the session, so poll briefly instead of racing it.
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
  const nav = document.querySelector('nav');
  if (!nav || document.getElementById('hover-nav-wrap')) return;

  _waitForNavUser().then(user => {
    const items = user && NAV_ITEMS[user.role];
    if (!items || !items.length) return;

    const brandGroup = nav.querySelector('div');
    if (!brandGroup) return;

    const currentPath = window.location.pathname;
    const wrap = document.createElement('div');
    wrap.id = 'hover-nav-wrap';
    wrap.className = 'relative';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.className = 'flex items-center gap-1 text-sm text-primary-100 hover:text-white hover:bg-primary-800 transition-colors px-2.5 py-1.5 rounded-lg';
    trigger.innerHTML = `Menu <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>`;

    const panel = document.createElement('div');
    panel.className = 'hidden absolute left-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1.5 z-50';
    panel.innerHTML = items.map(item => {
      const active = currentPath === item.href;
      return `<a href="${item.href}" class="block px-3 py-2 text-sm ${active ? 'font-semibold text-primary-700 bg-primary-50' : 'text-gray-700 hover:bg-gray-50'}">${item.label}</a>`;
    }).join('');

    let closeTimer = null;
    function openPanel()  { clearTimeout(closeTimer); panel.classList.remove('hidden'); trigger.setAttribute('aria-expanded', 'true'); }
    function closePanel() { panel.classList.add('hidden'); trigger.setAttribute('aria-expanded', 'false'); }
    function scheduleClose() { closeTimer = setTimeout(closePanel, 150); }

    wrap.addEventListener('mouseenter', openPanel);
    wrap.addEventListener('mouseleave', scheduleClose);
    trigger.addEventListener('click', () => panel.classList.contains('hidden') ? openPanel() : closePanel());
    document.addEventListener('click', e => { if (!wrap.contains(e.target)) closePanel(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });

    wrap.appendChild(trigger);
    wrap.appendChild(panel);
    brandGroup.appendChild(wrap);
  });
}

document.addEventListener('DOMContentLoaded', initHoverNav);
