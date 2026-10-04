(function () {
  var key = 'mcr_theme';
  var root = document.documentElement;
  var saved = null;
  try {
    saved = localStorage.getItem(key);
  } catch (error) {
    saved = null;
  }
  var apply = function (value) {
    root.dataset.theme = value;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', value === 'light' ? '#f4f5f7' : '#0e1116');
  };
  apply(saved === 'light' || saved === 'dark' ? saved : (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'));
  document.addEventListener('click', function (event) {
    var button = event.target.closest && event.target.closest('[data-theme-toggle]');
    if (!button) return;
    var next = root.dataset.theme === 'light' ? 'dark' : 'light';
    apply(next);
    try {
      localStorage.setItem(key, next);
    } catch (error) {
      return;
    }
  });
})();
