import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { readingContent, mermaidBlocks } from './scripts/reading-content.mjs';

export default defineConfig({
  site: 'https://trojanbox.github.io',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' }, wrap: false },
    processor: unified({
      remarkPlugins: [remarkMath, mermaidBlocks],
      rehypePlugins: [
        [rehypeKatex, { strict: 'error', throwOnError: true, trust: false }],
        rehypeSlug,
        [rehypeAutolinkHeadings, {
          behavior: 'append',
          properties: { className: ['heading-anchor'], ariaLabel: '此章节的链接' },
          content: { type: 'text', value: '#' },
        }],
        readingContent,
      ],
      remarkRehype: { footnoteLabel: '注释', footnoteBackLabel: '返回正文' },
    }),
  },
  vite: { build: { chunkSizeWarningLimit: 1800 } },
});
