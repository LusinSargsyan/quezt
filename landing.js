(function () {
  'use strict';
  // Product tabs (keyboard: arrows)
  const tabs = Array.from(document.querySelectorAll('.lp-tabs [role=tab]'));
  function show(t) {
    tabs.forEach((x) => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
    });
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      show(n); n.focus();
    });
  });
  // Sticky mobile CTA hides when the form is on screen
  const sticky = document.querySelector('.lp-sticky');
  const pilot = document.getElementById('pilot');
  if (sticky && pilot && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => sticky.classList.toggle('is-hidden', e.isIntersecting)).observe(pilot);
  }
})();
