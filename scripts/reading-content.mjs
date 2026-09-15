import { visit, SKIP } from 'unist-util-visit';
import path from 'node:path';
import sharp from 'sharp';
const el = (tagName, properties, children) => ({ type: 'element', tagName, properties, children });
const text = value => ({ type: 'text', value });

/** Keep diagram sources accessible; never interpret article strings as HTML. */
export function readingContent() {
  return async tree => {
    const images = [];
    visit(tree, 'element', (node, index, parent) => {
      if (!parent || index == null) return;
      if (node.tagName === 'pre' && node.children[0]?.tagName === 'code' &&
          node.children[0].properties?.className?.includes('language-mermaid')) {
        const source = node.children[0].children.map(child => child.value ?? '').join('');
        parent.children[index] = el('figure', { className: ['diagram'], 'data-mermaid': '' }, [
          el('div', { className: ['diagram-output'], 'aria-label': 'Mermaid 图表' }, []),
          el('details', { className: ['diagram-source'], open: true }, [
            el('summary', {}, [text('查看图表源码')]),
            el('pre', {}, [el('code', {}, [text(source)])]),
          ]),
        ]);
      }
      if (node.tagName === 'img') images.push(node);
      if (node.tagName === 'p' && node.children.length === 1 && node.children[0]?.tagName === 'img') {
        const image = node.children[0];
        const caption = image.properties.title;
        image.properties.loading = 'lazy';
        image.properties.decoding = 'async';
        parent.children[index] = el('figure', { className: ['article-image'] }, [image,
          ...(caption ? [el('figcaption', {}, [text(String(caption))])] : []),
        ]);
      }
      if (node.tagName === 'table') {
        parent.children[index] = el('div', { className: ['table-scroll'], tabIndex: 0, role: 'region', 'aria-label': '可横向滚动的表格' }, [node]);
        return SKIP;
      }
    });
    // Reserve local image geometry before lazy loading. This keeps text, anchors,
    // progress measurement and explicit resume stable while images arrive.
    const publicRoot = path.resolve('public');
    await Promise.all(images.map(async image => {
      const src = image.properties.src;
      if (typeof src !== 'string' || !src.startsWith('/') || src.startsWith('//')) return;
      const filename = path.resolve(publicRoot, '.' + decodeURIComponent(src.split(/[?#]/)[0]));
      if (!filename.startsWith(publicRoot + path.sep)) throw new Error(`Image path escapes public: ${src}`);
      const metadata = await sharp(filename).metadata();
      if (!metadata.width || !metadata.height) throw new Error(`Image dimensions unavailable: ${src}`);
      if (image.properties.width == null) image.properties.width = metadata.width;
      if (image.properties.height == null) image.properties.height = metadata.height;
    }));
  };
}

export function mermaidBlocks() {
  return tree => visit(tree, 'code', node => {
    if (node.lang !== 'mermaid') return;
    const value = node.value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    node.type = 'html';
    node.value = `<figure class="diagram" data-mermaid><div class="diagram-output" aria-label="Mermaid 图表"></div><details class="diagram-source" open><summary>查看图表源码</summary><pre><code>${value}</code></pre></details></figure>`;
  });
}
