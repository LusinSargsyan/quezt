(function () {
  'use strict';
  // Screen list
  fetch('pages.json').then(r => r.json()).then(pages => {
    const groups = {
      dash: { el: document.getElementById('g-dash'), test: p => p.w === 1440 && !p.file.startsWith('W') },
      player: { el: document.getElementById('g-player'), test: p => p.file.startsWith('P') || p.file === 'WHub.html' },
      widget: { el: document.getElementById('g-widget'), test: p => p.file.startsWith('W') && p.file !== 'WHub.html' },
      comp: { el: document.getElementById('g-comp'), test: p => p.file === 'Sidebar.html' }
    };
    const order = t => { const m = t.match(/^(\w)?(\d+)(b?)/); return m ? parseInt(m[2]) + (m[3] ? 0.5 : 0) : 99; };
    pages.sort((a, b) => order(a.title.replace(/^[A-Z]/, '')) - order(b.title.replace(/^[A-Z]/, '')));
    for (const p of pages) {
      const g = Object.values(groups).find(g => g.test(p)); if (!g) continue;
      const [num, ...rest] = p.title.split(' · ');
      const a = document.createElement('a');
      a.className = 'card screen'; a.href = p.file;
      a.innerHTML = `<span class="chip">${num}</span><span class="title">${rest.join(' · ') || num}</span><span class="caption">${p.w} × ${p.h}</span>`;
      g.el.appendChild(a);
    }
  });

  // QR code to this live link (Day X)
  try {
    const url = location.origin + location.pathname.replace(/index\.html$/, '');
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    document.getElementById('qr').innerHTML = qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
    document.getElementById('qr-url').textContent = url;
  } catch (e) {}

  // Waitlist form: saved in localStorage + sent to Make webhook (if set)
  const KEY = 'qz:waitlist';
  const list = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  const form = document.getElementById('waitlist');
  const status = document.getElementById('wl-status');
  const count = document.getElementById('wl-count');
  const showCount = () => { const n = list().length; count.textContent = n ? `${n} sign-up${n > 1 ? 's' : ''} saved in this browser` : ''; };
  showCount();

  const fieldErr = (name, msg) => {
    const input = form.elements[name], box = document.getElementById('err-' + name);
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (box) box.textContent = msg || '';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form).entries());
    fieldErr('name', d.name.trim() ? '' : 'Add your name so we know who to reply to.');
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim());
    fieldErr('email', emailOk ? '' : 'Check the email — it needs a name, @ and a domain, like you@company.com.');
    fieldErr('consent', d.consent ? '' : 'Tick the box so we may email you about the pilot.');
    const ok = !!d.name.trim() && emailOk && !!d.consent;
    if (!ok) { status.className = 'help err-text'; status.textContent = 'Fix the marked fields — your answers are kept.'; return; }

    const entry = { name: d.name.trim(), email: d.email.trim(), company: d.company.trim(), product: d.product, goal: d.goal.trim(), source: 'quezt-live', created_at: new Date().toISOString() };
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; btn.setAttribute('aria-busy', 'true'); status.className = 'help'; status.textContent = 'Saving…';

    const all = list(); all.push(entry);
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (err) {}

    const hook = (window.QZ_CONFIG || {}).makeWebhook;
    try {
      if (hook) {
        // form-encoded = simple request, no CORS preflight; Make parses it into fields
        const r = await fetch(hook, { method: 'POST', body: new URLSearchParams(entry) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        status.textContent = 'Saved. You are on the pilot list — we will email you.';
      } else {
        status.textContent = 'Saved in this browser. (Make webhook not connected yet.)';
      }
      status.className = 'help ok-text';
      form.reset();
    } catch (err) {
      status.className = 'help err-text';
      status.textContent = 'QZ-WL-001 Could not reach the server (' + err.message + '). Your sign-up is saved in this browser — try again in a minute.';
    } finally {
      btn.disabled = false; btn.removeAttribute('aria-busy'); showCount();
    }
  });
})();
