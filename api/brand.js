// Vercel serverless function: GET /api/brand?url=yourbrand.com
// Reads a homepage once (server-side, so no browser CORS limits) and returns
// logo, brand colors and font. Nothing is stored.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 QueztBrandImport/1.0';

async function get(url, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,text/css,*/*' }, redirect: 'follow', signal: ctl.signal });
    const text = (await r.text()).slice(0, 600000);
    return { ok: r.ok, status: r.status, text, url: r.url || url };
  } finally { clearTimeout(t); }
}

const abs = (href, base) => { try { return new URL(href.replace(/&amp;/g, '&'), base).href; } catch (e) { return null; } };
const attr = (tag, name) => { const m = tag.match(new RegExp(name + '\\s*=\\s*["\']([^"\']+)["\']', 'i')); return m ? m[1] : null; };

function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
}
const toHex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
function hsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
  return { s, l };
}

function collectColors(css) {
  const counts = new Map();
  const add = (rgb) => { const k = toHex(rgb); counts.set(k, (counts.get(k) || 0) + 1); };
  for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) add(hexToRgb(m[1]));
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi)) add([+m[1], +m[2], +m[3]]);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

const GENERIC = /^(inherit|initial|unset|sans-serif|serif|monospace|system-ui|-apple-system|blinkmacsystemfont|arial|helvetica|helvetica neue|times new roman|segoe ui|roboto|var\(.*|.*icon.*|.*awesome.*|material.*|swiper.*|slick.*)$/i;
function pickFont(html, css) {
  const g = html.match(/fonts\.googleapis\.com\/css2?\?family=([^"'&:]+)/i);
  if (g) return decodeURIComponent(g[1]).replace(/\+/g, ' ');
  const counts = new Map();
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1].split(',')[0].trim().replace(/["']/g, '');
    if (first && !GENERIC.test(first) && first.length < 40) counts.set(first, (counts.get(first) || 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

function pickLogo(html, base) {
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const logoImg = imgs.find((t) => /logo/i.test(t));
  if (logoImg) { const s = attr(logoImg, 'src') || attr(logoImg, 'data-src'); if (s && !/^data:/.test(s)) return abs(s, base); }
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const apple = links.find((t) => /apple-touch-icon/i.test(attr(t, 'rel') || ''));
  if (apple) return abs(attr(apple, 'href'), base);
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]*>/i);
  if (og) return abs(attr(og[0], 'content'), base);
  const icon = links.find((t) => /\bicon\b/i.test(attr(t, 'rel') || ''));
  if (icon) return abs(attr(icon, 'href'), base);
  return abs('/favicon.ico', base);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const raw = String((req.query && req.query.url) || '').trim();
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch (e) { u = null; }
  if (!u || !/\./.test(u.hostname) || /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(u.hostname)) {
    return res.status(400).json({ error: 'QZ-BRD-002', message: 'That doesn’t look like a public website. Try an address like yourbrand.com.' });
  }
  try {
    const page = await get(u.href, 8000);
    if (!page.ok || page.text.length < 200) {
      return res.status(502).json({ error: 'QZ-BRD-001', message: `We couldn’t read ${u.hostname} (status ${page.status}). The site may block automatic readers — set your color and font in Theme studio instead.` });
    }
    const html = page.text, base = page.url;
    let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
    css += '\n' + [...html.matchAll(/style\s*=\s*"([^"]+)"/gi)].map((m) => m[1]).join('\n');
    const sheets = [...html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)]
      .map((m) => abs(attr(m[0], 'href') || '', base)).filter((h) => h && !/fonts\.googleapis/.test(h)).slice(0, 4);
    const got = await Promise.allSettled(sheets.map((h) => get(h, 5000)));
    got.forEach((g) => { if (g.status === 'fulfilled' && g.value.ok) css += '\n' + g.value.text; });

    const colors = collectColors(css);
    const themeTag = html.match(/<meta[^>]+name=["']theme-color["'][^>]*>/i);
    const theme = themeTag && /^#[0-9a-f]{3,6}$/i.test(attr(themeTag[0], 'content') || '') ? toHex(hexToRgb(attr(themeTag[0], 'content'))) : null;
    // brand = most-used saturated mid-tone color (usually the CTA); theme-color as fallback
    const saturated = colors.filter(([c]) => { const x = hsl(hexToRgb(c)); return x.s > 0.35 && x.l > 0.22 && x.l < 0.78; });
    const brand = (saturated[0] && saturated[0][0]) || theme || null;
    const byL = colors.slice(0, 40).map(([c]) => [c, hsl(hexToRgb(c)).l]);
    const dark = (byL.filter(([, l]) => l < 0.25)[0] || ['#18171F'])[0];
    const light = (byL.filter(([, l]) => l > 0.9)[0] || ['#F7F6FA'])[0];
    // palette: up to 6 distinct, saturated brand colors (most used first)
    const palette = [];
    for (const [c] of saturated) {
      const [r, g, bb] = hexToRgb(c);
      if (palette.every((p) => { const [r2, g2, b2] = hexToRgb(p); return Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(bb - b2) > 60; })) palette.push(c);
      if (palette.length >= 6) break;
    }
    const nameTag = html.match(/<meta[^>]+property=["']og:site_name["'][^>]*>/i);
    const title = (html.match(/<title[^>]*>([^<]{1,80})/i) || [])[1];
    const name = (nameTag && attr(nameTag[0], 'content')) || (title ? title.split(/[|\-–—:]/)[0].trim() : u.hostname.replace(/^www\./, ''));

    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
    return res.status(200).json({
      site: u.hostname.replace(/^www\./, ''), name, logo: pickLogo(html, base),
      brand, dark, light, palette, font: pickFont(html, css), colorsFound: colors.length
    });
  } catch (e) {
    return res.status(504).json({ error: 'QZ-BRD-003', message: `${u.hostname} took too long to answer. Try again, or set your brand in Theme studio.` });
  }
};
