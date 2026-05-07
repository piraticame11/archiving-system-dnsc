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
