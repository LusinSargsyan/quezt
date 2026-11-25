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
      if (d.palette) props.palette = d.palette;
      window.QZ.setMany(props);
      if (window.QZsaveSite) window.QZsaveSite(d);
      toast('Imported from ' + d.site + ': ' + [d.brand, d.font].filter(Boolean).join(' · '));
    } catch (e) {
      toast('QZ-BRD-003 Couldn’t reach the import service. Check your connection and try again.');
    } finally { el.disabled = false; el.textContent = old; }
  }

  function mapped(el, text) {
    const t = text.toLowerCase();
    if (/^(re-)?import$/.test(t)) { importBrand(el); return ''; }
    const pick = t.match(/^use (#[0-9a-f]{6})$/i);
    if (pick) {
      const hex = pick[1].toUpperCase(); set('brand', hex);
      try { const st = JSON.parse(localStorage.getItem('qz:site') || 'null'); if (st) { st.brand = hex; localStorage.setItem('qz:site', JSON.stringify(st)); } } catch (e) {}
      return 'Primary color set to ' + hex + ' — widget updated';
    }
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


  /* ---------- connect every screen: label → screen (or real feedback) ---------- */
  const PAGE = (location.pathname.split('/').pop() || 'index.html').replace('.html', '');
  const NIGHT = /^(P|WHub)/.test(PAGE);            // Night player widget family
  const W = (n) => (NIGHT ? 'P' : 'W') + n + '.html';
  const ROUTES = [
    // dashboard
    [/^draft with ai$/, 'Editor.html'],
    [/^duplicate$/, 'Editor.html', 'Campaign duplicated — opening the copy'],
    [/^simulate players$/, 'Analytics.html', 'Simulation done — see the results'],
    [/^publish to production$/, 'Campaigns.html', 'Published to Production'],
    [/^back$/, 'index.html'],
    [/^change$/, 'Theme.html'],
    [/^compare plans$/, 'index.html#pricing'],
    [/^use shopify instead$/, 'Main.html'],
    [/^view all missions$/, 'WMissions.html'],
    // player widget
    [/^(close rewards|minimize( rewards)?|hide rewards)$/, () => W('Mobile')],
    [/^rewards ·/, () => W('Missions')],
    [/^(missions|level 2|coupons|level coupons.*|level up.*|lobby)$/, () => (NIGHT ? 'PMissions.html' : 'WMissions.html')],
    [/^(see streak|streaks|streak badges.*)$/, () => W('Badges')],
    [/^(how it works|help)$/, () => W('Guest')],
    [/^history$/, () => W('Leaderboard')],
  ];
  const FEEDBACK = [
    [/^add mission$/, 'Mission added — edit it in the list'],
    [/^suggest with ai$/, 'AI suggested 5 levels — review before publishing'],
    [/^export (players|css|data)/, 'Export started — file downloads in a moment'],
    [/^save adjustment$/, 'Saved — the player sees the new points'],
    [/^delete player/, 'Player deleted (demo — nothing removed)'],
    [/^check again$/, 'Checked — DNS record found ✓'],
    [/^how to add a dns record$/, 'Guide: add a TXT record at your domain host, then Check again'],
    [/^reveal$/, 'Key shown for 30 seconds'],
    [/^rotate$/, 'New key created — old key works 24 h more'],
    [/^invite$/, 'Invite sent'],
    [/^use$/, 'Coupon code copied — use it at checkout'],
    [/^claim/, 'Claimed! +50 XP'],
    [/^hide me/, 'You’re hidden from the leaderboard'],
    [/^sound (off|on)$/, 'Sound toggled'],
  ];
  function route(text) {
    const t = text.toLowerCase();
    for (const [re, to, msg] of ROUTES) if (re.test(t)) {
      const href = typeof to === 'function' ? to() : to;
      if (href.replace(/#.*/, '') === PAGE + '.html') { if (msg) toast(msg); return true; }
      if (msg) { try { sessionStorage.setItem('qz:toast', msg); } catch (e) {} }
      location.href = href; return true;
    }
    for (const [re, msg] of FEEDBACK) if (re.test(t)) { toast(msg); return true; }
    return false;
  }
  try { const m = sessionStorage.getItem('qz:toast'); if (m) { sessionStorage.removeItem('qz:toast'); setTimeout(() => toast(m), 300); } } catch (e) {}

  /* ---------- screen navigator on every page: prev · all screens · next ---------- */
  const SCREENS = [
    ['index', 'Landing page'], ['Main', '1 · Onboarding'], ['Overview', '2 · Overview'], ['Campaigns', '3 · Campaigns'],
    ['Editor', '4 · Campaign editor'], ['Levels', '4b · Levels'], ['Theme', '5 · Theme studio'], ['Players', '6 · Players'],
    ['Analytics', '7 · Analytics'], ['Settings', '8 · Settings'],
    ['WHub', 'W0 · Rewards hub (Night)'], ['PGuest', 'P1 · Guest'], ['PMissions', 'P2 · Missions'], ['PBadges', 'P3 · Badges'],
    ['PLeaderboard', 'P4 · Leaderboard'], ['PMobile', 'P5 · Mobile'],
    ['WGuest', 'W1 · Guest (light)'], ['WMissions', 'W2 · Missions (light)'], ['WBadges', 'W3 · Badges (light)'],
    ['WLeaderboard', 'W4 · Leaderboard (light)'], ['WMobile', 'W5 · Mobile (light)'],
  ];
  function buildNav() {
    if (window.top !== window || /[?&]embed\b/.test(location.search)) return;
    const i = SCREENS.findIndex((s) => s[0] === PAGE); if (i < 0) return;
    const href = (n) => n + '.html';
    const prev = SCREENS[i - 1], next = SCREENS[i + 1];
    const nav = document.createElement('nav');
    nav.className = 'qz qz-screens'; nav.setAttribute('aria-label', 'Demo screens');
    const opts = SCREENS.map((s, k) => `<option value="${href(s[0])}" ${k === i ? 'selected' : ''}>${s[1]}</option>`).join('');
    nav.innerHTML =
      (prev ? `<a href="${href(prev[0])}" aria-label="Previous: ${prev[1]}">‹</a>` : '<span aria-hidden="true">‹</span>') +
      `<select aria-label="Go to screen">${opts}</select>` +
      (next ? `<a href="${href(next[0])}" aria-label="Next: ${next[1]}">›</a>` : '<span aria-hidden="true">›</span>');
    nav.querySelector('select').onchange = (e) => { location.href = e.target.value; };
    const st = document.createElement('style');
    st.textContent = '.qz-screens{position:fixed;left:16px;bottom:16px;z-index:70;display:flex;align-items:center;gap:4px;padding:4px;border-radius:12px;background:var(--qz-p-neutral-950,#0f0e17);box-shadow:0 12px 32px rgb(15 14 23/.24);font:500 13px/1 "Satoshi",system-ui,sans-serif}' +
      '.qz-screens a,.qz-screens span{display:grid;place-items:center;width:32px;height:32px;border-radius:8px;color:#fff;text-decoration:none;font-size:20px}' +
      '.qz-screens span{opacity:.3}.qz-screens a:hover{background:rgb(255 255 255/.12)}' +
      '.qz-screens select{height:32px;border:0;border-radius:8px;padding:0 8px;background:rgb(255 255 255/.12);color:#fff;font:inherit;cursor:pointer}' +
      '.qz-screens select option{color:#0f0e17}.qz-screens a:focus-visible,.qz-screens select:focus-visible{outline:2px solid #fff;outline-offset:2px}';
    document.head.appendChild(st); document.body.appendChild(nav);
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'ArrowRight' && next) location.href = href(next[0]);
      if (e.altKey && e.key === 'ArrowLeft' && prev) location.href = href(prev[0]);
    });
  }
  buildNav();

  /* ---------- "Try on any website": paste a link → widget takes that site's styles ---------- */
  const SITE_KEY = 'qz:site';
  const WIDGET = /^(W|P)/.test(PAGE);
  const getSite = () => { try { return JSON.parse(localStorage.getItem(SITE_KEY) || 'null'); } catch (e) { return null; } };
  function onColor(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0F0E17' : '#FFFFFF';
  }
  function loadFont(font) {
    if (!font || /^(satoshi|inter|arial|helvetica)$/i.test(font) || document.getElementById('qz-site-font')) return;
    const l = document.createElement('link'); l.id = 'qz-site-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(font).replace(/%20/g, '+') + ':wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }
  function applySite() {
    const d = getSite(); if (!d || !WIDGET) return;
    const brand = d.brand, on = brand ? onColor(brand) : null, ff = d.font ? `"${d.font}", var(--font-body, system-ui), sans-serif` : null;
    loadFont(d.font);
    root.querySelectorAll('.w, .qp').forEach((el) => {
      if (brand) ['--w-brand', '--qz-w-brand', '--qz-w-cta', '--qz-w-brand-strong'].forEach((v) => el.style.setProperty(v, brand));
      if (on) ['--w-on-brand', '--qz-w-on-brand', '--qz-w-on-cta'].forEach((v) => el.style.setProperty(v, on));
      if (ff) { ['--w-font', '--font-body', '--font-display', '--w-display'].forEach((v) => el.style.setProperty(v, ff)); el.style.fontFamily = ff; }
    });
    const name = d.name || d.site;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) {
      const v = n.nodeValue;
      if (/Your Brand|\[Your brand\]|\[Your site\]/.test(v)) n.nodeValue = v.replace(/Your Brand|\[Your brand\]/g, name).replace(/\[Your site\]/g, d.site);
    }
    const bg = document.getElementById('qz-site-bg');
    if (bg && d.site && document.body.classList.contains('page-stage')) {
      bg.style.backgroundImage = `linear-gradient(rgb(15 14 23/.35),rgb(15 14 23/.35)),url("https://image.thum.io/get/width/1440/crop/1000/https://${d.site}")`;
      bg.hidden = false;
    }
  }
  async function importSite(url, btn, msgEl) {
    url = (url || '').trim(); if (!url) { toast('Paste a website link, like nike.com'); return; }
    const old = btn.textContent; btn.disabled = true; btn.textContent = 'Reading…';
    try {
      const r = await fetch('/api/brand?url=' + encodeURIComponent(url));
      let d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok) { toast((d.error ? d.error + ' ' : '') + (d.message || 'Couldn’t read that site.')); return; }
      saveSite(d);
      toast('Widget styled like ' + d.site + ': ' + [d.brand, d.font].filter(Boolean).join(' · '));
      location.reload();
    } catch (e) { toast('QZ-BRD-003 Couldn’t reach the import service. Try again.'); }
    finally { btn.disabled = false; btn.textContent = old; }
  }
  function saveSite(d) { try { localStorage.setItem(SITE_KEY, JSON.stringify({ site: d.site, name: d.name, logo: d.logo, brand: d.brand, dark: d.dark, light: d.light, font: d.font })); } catch (e) {} }
  window.QZsaveSite = saveSite;
  function buildSiteBar() {
    if (!WIDGET || window.top !== window || /[?&]embed\b/.test(location.search)) return;
    const d = getSite();
    const bg = document.createElement('div'); bg.id = 'qz-site-bg'; bg.hidden = true; bg.setAttribute('aria-hidden', 'true');
    document.body.prepend(bg);
    const bar = document.createElement('form'); bar.className = 'qz-site'; bar.setAttribute('aria-label', 'Try the widget on any website');
    bar.innerHTML = '<label for="qz-site-url">Try on your site</label>' +
      `<input id="qz-site-url" type="text" inputmode="url" placeholder="yourbrand.com" value="${d ? d.site : ''}" autocomplete="url">` +
      '<button type="submit">Apply</button>' + (d ? '<button type="button" class="qz-site-reset">Reset</button>' : '');
    bar.onsubmit = (e) => { e.preventDefault(); importSite(bar.querySelector('input').value, bar.querySelector('button[type=submit]')); };
    const rs = bar.querySelector('.qz-site-reset');
    if (rs) rs.onclick = () => { try { localStorage.removeItem(SITE_KEY); } catch (e) {} location.reload(); };
    const st = document.createElement('style');
    st.textContent = '#qz-site-bg{position:fixed;inset:0;z-index:0;background:center top/cover no-repeat}#qz-site-bg[hidden]{display:none}#qz-root{position:relative;z-index:1}' +
      '.qz-site{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:70;display:flex;align-items:center;gap:6px;padding:6px 6px 6px 14px;border-radius:12px;background:#0f0e17;box-shadow:0 12px 32px rgb(15 14 23/.24);font:500 13px/1 "Satoshi",system-ui,sans-serif;color:#fff;max-width:calc(100vw - 24px)}' +
      '.qz-site label{white-space:nowrap}.qz-site input{width:200px;min-width:0;height:32px;border:0;border-radius:8px;padding:0 10px;background:rgb(255 255 255/.12);color:#fff;font:inherit}.qz-site input::placeholder{color:rgb(255 255 255/.5)}' +
      '.qz-site button{height:32px;border:0;border-radius:8px;padding:0 12px;font:600 13px/1 inherit;font-family:inherit;cursor:pointer;background:#7c4dff;color:#fff}.qz-site .qz-site-reset{background:rgb(255 255 255/.12)}' +
      '.qz-site :focus-visible{outline:2px solid #fff;outline-offset:2px}@media(max-width:560px){.qz-site label{display:none}.qz-site input{width:140px}}' +
      'body.page-stage .stage{padding-top:72px}';
    document.head.appendChild(st); document.body.appendChild(bar);
  }
  buildSiteBar();
  { const d0 = getSite(); if (d0 && d0.font) loadFont(d0.font); }
  new MutationObserver(applySite).observe(root, { childList: true });
  applySite();


  /* ---------- Properties / Preview switch (Campaign editor) → live widget preview ---------- */
  function previewSwitch(el, text) {
    const t = text.toLowerCase();
    if (t !== 'preview' && t !== 'properties') return;
    const panel = el.closest('aside'); if (!panel) return;
    const head = el.closest('.seg').parentElement;
    const fields = Array.from(panel.children).filter((c) => c !== head && !c.classList.contains('qz-preview'));
    let box = panel.querySelector('.qz-preview');
    if (t === 'preview') {
      if (!box) {
        box = document.createElement('div'); box.className = 'qz-preview';
        box.style.cssText = 'display:flex;flex-direction:column;gap:8px;align-items:center';
        box.innerHTML = '<div class="qz-preview-frame" style="width:100%;overflow:hidden;border-radius:16px;box-shadow:var(--shadow-md)"><iframe src="WMissions.html?embed" title="Widget preview" style="width:400px;height:760px;border:0;transform-origin:0 0;display:block"></iframe></div>' +
          '<a href="WMissions.html" style="font-size:13px;font-weight:600">Open full widget →</a>';
        panel.appendChild(box);
      }
      fields.forEach((f) => { if (!('qzDisp' in f.dataset)) f.dataset.qzDisp = f.style.display; f.style.display = 'none'; });
      box.style.display = 'flex';
      const fr = box.querySelector('.qz-preview-frame'), ifr = fr.querySelector('iframe');
      const k = Math.min(1, fr.clientWidth / 400);
      ifr.style.transform = 'scale(' + k + ')'; fr.style.height = Math.round(760 * k) + 'px';
    } else {
      fields.forEach((f) => { if ('qzDisp' in f.dataset) f.style.display = f.dataset.qzDisp; }); if (box) box.style.display = 'none';
    }
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
    if (trySelect(el)) { previewSwitch(el, text); return; }
    if (route(text)) return;
    toast((text ? '“' + text + '” — ' : '') + 'done ✓ (demo)');
  });

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'url') { e.preventDefault(); const b = Array.from(root.querySelectorAll('button')).find((x) => /^\s*(re-)?import\s*$/i.test(x.textContent)); if (b) importBrand(b); }
  });

  /* brand hex field in Theme studio → live brand + contrast check */
  root.addEventListener('change', (e) => {
    const v = (e.target.value || '').trim();
    if (e.target.tagName === 'INPUT' && /^#?[0-9a-f]{6}$/i.test(v) && /#[0-9a-f]{6}/i.test(e.target.defaultValue || '')) {
      set('brand', (v[0] === '#' ? v : '#' + v).toUpperCase());
    }
  });
})();
