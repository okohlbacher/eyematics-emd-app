/* Phase 17 — FOUC prevention: apply the dark class before first paint.
 * Loaded as an external classic script from index.html: the production CSP (script-src 'self')
 * blocks inline scripts. No stored choice = 'system', same default as ThemeContext. */
try {
  var t = localStorage.getItem('emd-theme');
  if (t === 'dark' || ((t === null || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.add('dark');
  }
} catch (e) { /* storage blocked — ThemeContext applies the theme after mount */ }
