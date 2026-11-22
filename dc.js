/* Quezt mini-runtime: renders the Claude Design (.dc) screens as static pages.
   Supports {{expr}}, <template data-sc="for|if">, <dc-import>, renderVals(),
   plus Play mode: live prop controls saved in localStorage (data survives reload). */
(function () {
  'use strict';
  class DCLogic { constructor(props) { this.props = props || {}; } renderVals() { return {}; } }
  window.DCLogic = DCLogic;

  const STORE = 'qz:props';
  const SHARED = ['dark', 'brand']; // shared across pages so Theme studio choices follow you
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) { return {}; } };
  const save = (o) => { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} };

  function evalExpr(expr, scope) {
    try { return Function(...Object.keys(scope), '"use strict";return (' + expr + ');')(...Object.values(scope)); }
    catch (e) { return undefined; }
  }
  const RE = /\{\{([^}]+)\}\}/g;
  function interp(str, scope) {
    const whole = str.match(/^\s*\{\{([^}]+)\}\}\s*$/);
    if (whole) return evalExpr(whole[1], scope);
    return str.replace(RE, (_, e) => { const v = evalExpr(e, scope); return v == null ? '' : v; });
  }

  function parseComp(doc) {
    const tpl = doc.querySelector('template#qz-tpl');
    const s = doc.querySelector('script[type="text/x-dc"]');
    let schema = {}; try { schema = JSON.parse(s.getAttribute('data-props') || '{}'); } catch (e) {}
    delete schema.$preview;
    const Comp = Function('DCLogic', s.textContent + '\n;return Component;')(DCLogic);
    return { tpl, schema, Comp };
  }

  const cache = {};
  async function fetchComp(name) {
    if (!cache[name]) cache[name] = fetch(name + '.html').then(r => r.text()).then(t => parseComp(new DOMParser().parseFromString(t, 'text/html')));
    return cache[name];
  }

  function defaults(schema) { const o = {}; for (const k in schema) o[k] = schema[k].default; return o; }

  async function renderComp(comp, props, host) {
    const vals = new comp.Comp({ ...defaults(comp.schema), ...props }).renderVals() || {};
    const frag = comp.tpl.content.cloneNode(true);
    await walk(frag, vals);
    host.replaceChildren(frag);
  }

  async function walk(node, scope) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) { if (child.nodeValue.includes('{{')) child.nodeValue = interp(child.nodeValue, scope) ?? ''; continue; }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'template' && child.dataset.sc) {
        const out = document.createDocumentFragment();
        if (child.dataset.sc === 'for') {
          const list = interp(child.getAttribute('list'), scope) || [];
          const as = child.getAttribute('as') || 'item';
          for (const [i, item] of Array.from(list).entries()) {
            const f = child.content.cloneNode(true);
            await walk(f, { ...scope, [as]: item, index: i });
            out.appendChild(f);
          }
        } else if (interp(child.getAttribute('value'), scope)) {
          const f = child.content.cloneNode(true); await walk(f, scope); out.appendChild(f);
        }
        child.replaceWith(out);
        continue;
      }
      for (const a of Array.from(child.attributes)) if (a.value.includes('{{')) { const v = interp(a.value, scope); child.setAttribute(a.name, v == null ? '' : String(v)); }
      if (tag === 'dc-import') {
        const props = {};
        for (const a of Array.from(child.attributes)) if (!['name', 'hint-size'].includes(a.name)) props[a.name] = a.value === 'true' ? true : a.value === 'false' ? false : a.value;
        const host = document.createElement('div'); host.style.height = '100%';
        await renderComp(await fetchComp(child.getAttribute('name')), props, host);
        child.replaceWith(host);
        continue;
      }
      await walk(child, scope);
    }
  }

  /* ---------- Play mode panel ---------- */
  const page = location.pathname.split('/').pop().replace('.html', '') || 'index';
  function getProps(schema) {
    const all = load(), mine = all[page] || {}, out = {};
    for (const k in schema) {
      if (k in mine) out[k] = mine[k];
      else if (SHARED.includes(k) && all._shared && k in all._shared) {
        const v = all._shared[k];
        if (k !== 'brand' || !schema[k].options || schema[k].options.includes(v)) out[k] = v;
      }
    }
    return out;
  }
  function setProp(schema, k, v) {
    const all = load(); all[page] = all[page] || {}; all[page][k] = v;
    if (SHARED.includes(k)) { all._shared = all._shared || {}; all._shared[k] = v; }
    save(all);
  }

  function buildPanel(schema, rerender) {
    const keys = Object.keys(schema);
    const wrap = document.createElement('div'); wrap.className = 'qz play';
    wrap.innerHTML = '<button class="play-btn" aria-expanded="false" aria-controls="play-panel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>Play mode</button><div class="play-panel" id="play-panel" hidden role="region" aria-label="Play mode"></div>';
    const btn = wrap.querySelector('.play-btn'), panel = wrap.querySelector('.play-panel');
    btn.onclick = () => { const o = panel.hidden; panel.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
    const draw = () => {
      const cur = { ...defaults(schema), ...getProps(schema) };
      panel.innerHTML = '<p class="play-h">Try the states</p>';
      if (!keys.length) panel.innerHTML += '<p class="play-note">This screen has no switches.</p>';
      for (const k of keys) {
        const s = schema[k], row = document.createElement('div'); row.className = 'play-row';
        const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
        if (s.editor === 'boolean') {
          row.innerHTML = `<label><input type="checkbox" ${cur[k] ? 'checked' : ''}> ${label}</label>`;
          row.querySelector('input').onchange = e => { setProp(schema, k, e.target.checked); rerender(); };
        } else if (s.editor === 'enum') {
          row.innerHTML = `<label>${label} <select>${s.options.map(o => `<option ${o === cur[k] ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`;
          row.querySelector('select').onchange = e => { setProp(schema, k, e.target.value); rerender(); };
        } else if (s.editor === 'color') {
          row.innerHTML = `<span>${label}</span><span class="play-sw">${(s.options || [s.default]).map(o => `<button type="button" aria-label="${o}" aria-pressed="${o === cur[k]}" style="background:${o}"></button>`).join('')}</span>`;
          row.querySelectorAll('button').forEach(b => b.onclick = () => { setProp(schema, k, b.getAttribute('aria-label')); rerender(); });
        }
        panel.appendChild(row);
      }
      const r = document.createElement('button'); r.className = 'play-reset'; r.textContent = 'Reset to design';
      r.onclick = () => { const all = load(); delete all[page]; delete all._shared; save(all); rerender(); };
      panel.appendChild(r);
      panel.insertAdjacentHTML('beforeend', '<p class="play-note">Saved in this browser — stays after reload.</p>');
    };
    draw();
    document.body.appendChild(wrap);
    return draw;
  }

  async function boot() {
    const comp = parseComp(document);
    const root = document.getElementById('qz-root');
    let redraw;
    const rerender = async () => {
      const props = getProps(comp.schema);
      await renderComp(comp, props, root);
      const dark = { ...defaults(comp.schema), ...props }.dark;
      document.documentElement.classList.toggle('is-dark', !!dark);
      const pw = document.querySelector('.play'); if (pw) pw.classList.toggle('dark', !!dark);
      if (redraw) redraw();
    };
    await rerender();
    redraw = buildPanel(comp.schema, rerender);
    document.querySelector('.play').classList.toggle('dark', document.documentElement.classList.contains('is-dark'));
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
})();
