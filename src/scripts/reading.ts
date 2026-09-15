const body = document.querySelector<HTMLElement>('#article-body')!;
const progressBar = document.querySelector<HTMLElement>('.reading-progress')!;
const fill = document.querySelector<HTMLElement>('#reading-progress-fill')!;
const percent = document.querySelector('#reading-percent')!;
const key = `trojanbox-main:progress:v1:${body.dataset.articleId}`;
let current = 0;
let interacted = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let scheduled = false;
function measure() {
  const start = body.getBoundingClientRect().top + window.scrollY;
  const range = Math.max(0, body.offsetHeight - window.innerHeight);
  current = range === 0 ? (window.scrollY >= start ? 1 : 0) : Math.max(0, Math.min(1, (window.scrollY - start) / range));
  fill.style.transform = `scaleX(${current})`;
  const value = Math.round(current * 100);
  percent.textContent = `${value}%`;
  progressBar.setAttribute('aria-valuenow', String(value));
}
function save() {
  if (!interacted) return;
  try { localStorage.setItem(key, JSON.stringify({ version: 1, progress: current })); }
  catch { /* Optional persistence may be denied; article remains readable. */ }
}
try {
  const saved = JSON.parse(localStorage.getItem(key) ?? 'null');
  if (!location.hash && saved?.version === 1 && Number.isFinite(saved.progress) && saved.progress > .02 && saved.progress < .98) {
    const resume = document.querySelector<HTMLElement>('#resume-reading')!;
    resume.hidden = false;
    document.querySelector('#resume-label')!.textContent = `上次读到 ${Math.round(saved.progress * 100)}%`;
    document.querySelector('#resume-button')!.addEventListener('click', () => {
      resume.hidden = true; interacted = true;
      const start = body.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: start + saved.progress * Math.max(0, body.offsetHeight - innerHeight), behavior: 'instant' });
      measure(); save();
    });
  }
} catch { /* A damaged progress entry is ignored independently from all other preferences. */ }
window.addEventListener('scroll', () => {
  interacted = true;
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    measure(); scheduled = false;
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 180);
  });
}, { passive: true });
window.addEventListener('pagehide', save);
window.addEventListener('reader:save', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
new ResizeObserver(measure).observe(body);
window.addEventListener('resize', measure);
measure();

let toastTimer: ReturnType<typeof setTimeout>;
function toast(message: string) {
  const node = document.querySelector<HTMLElement>('#toast')!;
  node.textContent = message; node.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { node.hidden = true; }, 2400);
}
async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); toast('已复制'); }
  catch { toast('当前浏览器未允许复制，请手动选择内容。'); }
}
document.querySelector('#copy-link')!.addEventListener('click', () => void copy(location.href));
body.querySelectorAll<HTMLElement>('pre').forEach(pre => {
  if (pre.closest('[data-mermaid]')) return;
  const wrapper = document.createElement('div'); wrapper.className = 'code-wrap';
  pre.before(wrapper); wrapper.append(pre);
  const button = document.createElement('button'); button.textContent = '复制代码'; button.className = 'copy-code';
  button.addEventListener('click', () => void copy(pre.querySelector('code')?.textContent ?? pre.textContent ?? ''));
  wrapper.append(button);
});

const diagrams = [...body.querySelectorAll<HTMLElement>('[data-mermaid]')];
if (diagrams.length) {
  const sources = diagrams.map(node => node.querySelector('pre')?.textContent ?? '');
  let revision = 0;
  let renderQueue = Promise.resolve();
  const mermaidModule = import('mermaid');
  function renderDiagrams() {
    const requested = ++revision;
    renderQueue = renderQueue.then(async () => {
      if (requested !== revision) return;
      const { default: mermaid } = await mermaidModule;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'neutral',
        fontFamily: 'system-ui, sans-serif', flowchart: { htmlLabels: false }, suppressErrorRendering: true });
      for (let index = 0; index < diagrams.length; index++) {
        const node = diagrams[index];
        try {
          const { svg } = await mermaid.render(`main-diagram-${requested}-${index}`, sources[index]);
          if (requested !== revision) return;
          node.querySelector('.diagram-output')!.innerHTML = svg;
          node.querySelector<HTMLDetailsElement>('details')!.open = false;
          node.querySelector('.diagram-error')?.remove();
          node.dataset.rendered = 'true';
        } catch (error) {
          node.querySelector<HTMLDetailsElement>('details')!.open = true;
          if (!node.querySelector('.diagram-error')) {
            const message = document.createElement('p'); message.className = 'diagram-error';
            message.textContent = '图表未能渲染，下面保留完整源码。'; node.prepend(message);
          }
          console.error('Mermaid 渲染失败', error);
        }
      }
      measure();
    }).catch(error => { console.error('Mermaid 加载失败；图表源码仍可阅读。', error); });
  }
  window.addEventListener('reader:settings', renderDiagrams);
  renderDiagrams();
}
