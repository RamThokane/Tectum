// Apply theme and text size before first paint to avoid a flash. Dark is the default look;
// with no saved choice we follow the device (light only if it asks for light).
// The page background is painted here too, so there is never a white flash before the CSS loads.
// (A separate file rather than an inline script so a strict Content-Security-Policy allows it.)
(function () {
  var root = document.documentElement;
  var dark;
  try {
    var saved = localStorage.getItem('tectum-theme');
    dark = saved ? saved !== 'light' : !window.matchMedia('(prefers-color-scheme: light)').matches;
    var size = { sm: '14px', lg: '18px' }[localStorage.getItem('tectum-text-size')];
    if (size) root.style.fontSize = size;
  } catch (e) {
    dark = true;
  }
  if (dark) root.classList.add('dark');
  root.style.backgroundColor = dark ? '#0b0d12' : '#f6f7f9';
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
