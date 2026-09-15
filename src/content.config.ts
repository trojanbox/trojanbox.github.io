import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const label = z.string().trim().min(1).max(80);
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string().trim().min(1),
    date: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    category: label,
    tags: z.array(label).default([]).transform(tags => [...new Set(tags)]),
    summary: z.string().trim().min(1),
    draft: z.boolean().default(false),
  }),
});
const topics = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/topics' }),
  schema: z.object({
    title: label,
    summary: z.string().trim().min(1),
    kind: label,
    status: z.enum(['ongoing', 'completed', 'paused']),
    url: z.url().refine(value => value.startsWith('https://'), '专题必须使用 HTTPS 地址'),
    updatedAt: z.coerce.date().optional(),
  }),
});
export const collections = { articles, topics };
