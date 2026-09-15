const dialog = document.querySelector<HTMLDialogElement>('#settings-dialog')!;
const reader = window.readerSettings;
const font = document.querySelector<HTMLInputElement>('#font-size')!;
const note = document.querySelector<HTMLElement>('#storage-note')!;
let deferredInstall: InstallPrompt | null = null;
let previousFocus: HTMLElement | null = null;

function syncSettings() {
  const { theme, fontSize } = reader.value;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--reading-size', `${fontSize}px`);
  // CSS owns the palette, including the browser's theme color.
  document.querySelector<HTMLMetaElement>('#theme-color')!.content = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
  font.value = String(fontSize);
  document.querySelector('#font-value')!.textContent = `${fontSize} px`;
  document.querySelector<HTMLButtonElement>('#font-smaller')!.disabled = fontSize <= 16;
  document.querySelector<HTMLButtonElement>('#font-larger')!.disabled = fontSize >= 26;
  note.textContent = reader.available ? '设置仅保存在当前浏览器，无需登录。' : '设置已在本次阅读生效；浏览器未能保存，下次打开可能恢复默认。';
  window.dispatchEvent(new CustomEvent('reader:settings', { detail: reader.value }));
}
function saveSettings() {
  try { localStorage.setItem(reader.key, JSON.stringify(reader.value)); reader.available = true; }
  catch { reader.available = false; }
  syncSettings();
}
function openSettings() {
  previousFocus = document.activeElement as HTMLElement;
  if (!dialog.open) dialog.showModal();
}
document.querySelector('#open-settings')!.addEventListener('click', openSettings);
document.querySelector('#article-settings')?.addEventListener('click', openSettings);
document.querySelector('#close-settings')!.addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => previousFocus?.focus());
dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
});
document.querySelectorAll<HTMLButtonElement>('[data-theme-choice]').forEach(button => button.addEventListener('click', () => {
  reader.value.theme = button.dataset.themeChoice === 'dark' ? 'dark' : 'light'; saveSettings();
}));
function setFont(value: number) { reader.value.fontSize = Math.max(16, Math.min(26, value)); saveSettings(); }
font.addEventListener('input', () => setFont(Number(font.value)));
document.querySelector('#font-smaller')!.addEventListener('click', () => setFont(reader.value.fontSize - 1));
document.querySelector('#font-larger')!.addEventListener('click', () => setFont(reader.value.fontSize + 1));
document.querySelector('#reset-settings')!.addEventListener('click', () => {
  reader.value = { version: 1, theme: 'light', fontSize: 18 }; saveSettings();
});
window.addEventListener('storage', event => {
  if (event.key !== reader.key) return;
  try {
    const data = JSON.parse(event.newValue ?? 'null');
    reader.value = { version: 1, theme: data?.version === 1 && data.theme === 'dark' ? 'dark' : 'light',
      fontSize: data?.version === 1 && Number.isFinite(data.fontSize) && data.fontSize >= 16 && data.fontSize <= 26 ? data.fontSize : 18 };
    syncSettings();
  } catch { /* A corrupted other-tab value must not replace a valid in-memory preference. */ }
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); deferredInstall = event as InstallPrompt;
});
async function install() {
  if (matchMedia('(display-mode: standalone)').matches) {
    openSettings(); document.querySelector('#install-help')!.textContent = '当前已经在应用窗口中运行。';
    (document.querySelector('#install-help') as HTMLElement).hidden = false; return;
  }
  if (deferredInstall) {
    const prompt = deferredInstall; deferredInstall = null;
    await prompt.prompt(); await prompt.userChoice;
  } else { openSettings(); (document.querySelector('#install-help') as HTMLElement).hidden = false; }
}
document.querySelector('#install-app')!.addEventListener('click', () => void install());
document.querySelector('#footer-install')!.addEventListener('click', () => void install());
window.addEventListener('appinstalled', () => { deferredInstall = null; });
syncSettings();

// Only the main site's worker may be registered/updated here. Other project Pages keep their own workers.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(registration => {
    const notice = document.querySelector<HTMLElement>('#update-notice')!;
    let applyingUpdate = false;
    function offerUpdate() { if (registration.waiting && navigator.serviceWorker.controller) notice.hidden = false; }
    offerUpdate();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', offerUpdate);
    });
    document.querySelector('#apply-update')!.addEventListener('click', () => {
      applyingUpdate = true;
      window.dispatchEvent(new Event('reader:save'));
      registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });
    document.querySelector('#dismiss-update')!.addEventListener('click', () => { notice.hidden = true; });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (applyingUpdate) location.reload(); });
    navigator.serviceWorker.ready.then(active => active.active?.postMessage({ type: 'CACHE_PAGE', url: location.href }));
  }).catch(error => { console.warn('本站离线功能暂不可用，在线阅读不受影响。', error); });
}
