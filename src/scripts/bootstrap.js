(function () {
  const key = 'trojanbox-main:settings:v1';
  const defaults = { version: 1, theme: 'light', fontSize: 18 };
  let settings = { ...defaults };
  let available = true;
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (value && value.version === 1) {
      if (['light', 'dark'].includes(value.theme)) settings.theme = value.theme;
      if (Number.isFinite(value.fontSize) && value.fontSize >= 16 && value.fontSize <= 26) settings.fontSize = value.fontSize;
    }
  } catch { available = false; }
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.style.setProperty('--reading-size', settings.fontSize + 'px');
  window.readerSettings = { key, value: settings, available };
})();
