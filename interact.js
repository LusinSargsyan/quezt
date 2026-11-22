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
  /* Brand import: Re-import → /api/brand (server reads the homepage once) */
  async function importBrand(el) {
    const input = root.querySelector('#url');
    const url = input ? input.value.trim() : '';
    if (!url) { toast('Add your website address first, like yourbrand.com'); return; }
    el.disabled = true; const old = el.textContent; el.textContent = 'Reading…';
    try {
      const r = await fetch('/api/brand?url=' + encodeURIComponent(url));
      let d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok) {
        toast(r.status === 404 ? 'QZ-BRD-404 Brand import isn’t deployed yet — add api/brand.js to the repo.' : (d.error ? d.error + ' ' : '') + (d.message || 'Couldn’t read that site. Set your brand in Theme studio.'));
        return;
      }
      if (d.font) {
        const l = document.createElement('link'); l.rel = 'stylesheet';
        l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(d.font).replace(/%20/g, '+') + ':wght@400;600;700&display=swap';
        document.head.appendChild(l);
      }
      const props = { site: url, brandName: d.name || d.site, logo: d.logo || '', font: d.font || 'Satoshi' };
      if (d.brand) props.brand = d.brand;
      if (d.dark) props.c2 = d.dark;
      if (d.light) props.c3 = d.light;
      window.QZ.setMany(props);
      toast('Imported from ' + d.site + ': ' + [d.brand, d.font].filter(Boolean).join(' · '));
    } catch (e) {
      toast('QZ-BRD-003 Couldn’t reach the import service. Check your connection and try again.');
    } finally { el.disabled = false; el.textContent = old; }
  }

  function mapped(el, text) {
    const t = text.toLowerCase();
    if (/^re-import$/.test(t)) { importBrand(el); return ''; }
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

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'url') { e.preventDefault(); const b = Array.from(root.querySelectorAll('button')).find((x) => /re-import/i.test(x.textContent)); if (b) importBrand(b); }
  });

  /* brand hex field in Theme studio → live brand + contrast check */
  root.addEventListener('change', (e) => {
    const v = (e.target.value || '').trim();
    if (e.target.tagName === 'INPUT' && /^#?[0-9a-f]{6}$/i.test(v) && /#[0-9a-f]{6}/i.test(e.target.defaultValue || '')) {
      set('brand', (v[0] === '#' ? v : '#' + v).toUpperCase());
    }
  });
})();
