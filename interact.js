/* Quezt prototype interactions: tabs/segments/filters switch, mapped controls change real state,
   everything else gives honest feedback instead of doing nothing. */
(function () {
  'use strict';
  const root = document.getElementById('qz-root');
  if (!root) return;

  /* ---------- toast ---------- */
  let tEl, tTimer;
  function toast(msg) {
    if (!tEl) {
      tEl = document.createElement('div');
      tEl.className = 'qz qz-toast';
      tEl.setAttribute('role', 'status');
      tEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(tEl);
    }
    tEl.textContent = msg;
    tEl.classList.add('show');
    clearTimeout(tTimer);
    tTimer = setTimeout(() => tEl.classList.remove('show'), 2600);
  }

  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim();
  const set = (k, v) => window.QZ && window.QZ.set(k, v);

  /* ---------- selection groups ---------- */
  const SELECTED_STYLE = /border:\s*2px solid var\(--accent\)/;
  function isSelected(el) {
    return el.classList.contains('on') || el.classList.contains('is-on') ||
      el.getAttribute('aria-pressed') === 'true' || el.getAttribute('aria-selected') === 'true' ||
      el.getAttribute('aria-checked') === 'true' || SELECTED_STYLE.test(el.getAttribute('style') || '');
  }
  function trySelect(el) {
    const p = el.parentElement;
    if (!p) return false;
    const sibs = Array.from(p.children).filter((c) => c.tagName === el.tagName);
    if (sibs.length < 2) return false;
    const cur = sibs.find(isSelected);
    if (!cur) return false;
    if (cur === el) return true;
    ['on', 'is-on'].forEach((c) => { if (cur.classList.contains(c)) { cur.classList.remove(c); el.classList.add(c); } });
    ['aria-pressed', 'aria-selected', 'aria-checked'].forEach((a) => {
      if (cur.getAttribute(a) === 'true') { cur.setAttribute(a, 'false'); el.setAttribute(a, 'true'); }
    });
    if (SELECTED_STYLE.test(cur.getAttribute('style') || '')) {
      const a = cur.getAttribute('style'), b = el.getAttribute('style') || '';
      cur.setAttribute('style', b); el.setAttribute('style', a);
    }
    return true;
  }

  /* ---------- controls mapped to real state (saved like Play mode) ---------- */
  function mapped(el, text) {
    const t = text.toLowerCase();
    if (/^numbers only/.test(t)) { set('icons', false); return 'Levels show numbers'; }
    if (/^with icons/.test(t)) { set('icons', true); return 'Levels show icons'; }
    if (/^open rewards/.test(t)) { set('open', true); return ''; }
    if (/^(close rewards|minimize)/.test(t) && document.body.innerHTML.includes('Your site]')) { set('open', false); return ''; }
    if (/^use this shade/.test(t)) {
      const hex = (el.parentElement.textContent.match(/#[0-9a-f]{6}/i) || [])[0];
      if (hex) { set('brand', hex.toUpperCase()); return 'Brand set to ' + hex.toUpperCase() + ' — passes AA'; }
    }
    if (/^(copy|copy record)$/.test(t)) {
      const box = el.closest('div');
      const src = box && (box.querySelector('input, textarea, pre, code, .mono'));
      const val = src ? (src.value || src.textContent) : '';
      if (val && navigator.clipboard) navigator.clipboard.writeText(val.trim()).catch(() => {});
      return 'Copied';
    }
    return null;
  }

  root.addEventListener('click', (e) => {
    const el = e.target.closest('button, a, [role="radio"], [role="option"], [role="tab"], .seg > span');
    if (!el || !root.contains(el)) return;
    const href = el.tagName === 'A' ? el.getAttribute('href') : null;
    if (href && href !== '#' && !href.startsWith('#')) return; // real navigation
    e.preventDefault();
    const text = label(el);
    if (el.getAttribute('aria-disabled') === 'true') { toast('Disabled — fill the required fields first'); return; }
    const m = mapped(el, text);
    if (m !== null) { if (m) toast(m); return; }
    if (trySelect(el)) return;
    toast('Prototype: “' + (text || 'this') + '” isn’t connected in the MVP demo');
  });

  /* brand hex field in Theme studio → live brand + contrast check */
  root.addEventListener('change', (e) => {
    const v = (e.target.value || '').trim();
    if (e.target.tagName === 'INPUT' && /^#?[0-9a-f]{6}$/i.test(v) && /#[0-9a-f]{6}/i.test(e.target.defaultValue || '')) {
      set('brand', (v[0] === '#' ? v : '#' + v).toUpperCase());
    }
  });
})();
