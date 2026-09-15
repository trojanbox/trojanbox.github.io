import { getCollection, type CollectionEntry } from 'astro:content';
export type Article = CollectionEntry<'articles'>;
export type Topic = CollectionEntry<'topics'>;
export const site = {
  title: 'trojanbox',
  description: '文章、随笔与持续生长的专题。',
  url: 'https://trojanbox.github.io',
};
export const statusText = { ongoing: '持续更新', completed: '已完结', paused: '暂停更新' };
export async function articles() {
  const entries = await getCollection('articles', ({ data }) => !data.draft && data.date.getTime() <= Date.now());
  for (const entry of entries) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) throw new Error(`文章需要稳定的英文 slug: ${entry.id}`);
    if (!entry.body?.trim()) throw new Error(`文章正文为空: ${entry.id}`);
    if (entry.data.updatedAt && entry.data.updatedAt < entry.data.date) throw new Error(`更新时间早于发布时间: ${entry.id}`);
  }
  return entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime() || a.id.localeCompare(b.id));
}
export async function topics() {
  return (await getCollection('topics')).sort((a, b) =>
    (b.data.updatedAt?.getTime() ?? 0) - (a.data.updatedAt?.getTime() ?? 0) || a.id.localeCompare(b.id));
}
export const articleUrl = (article: Article) => `/articles/${article.id}/`;
export const taxonomyUrl = (kind: 'categories' | 'tags', name: string) => `/${kind}/${encodeURIComponent(name)}/`;
export const dateText = (date: Date) => date.toISOString().slice(0, 10).replaceAll('-', '.');
export function groups(entries: Article[], kind: 'category' | 'tags') {
  const map = new Map<string, Article[]>();
  for (const article of entries) {
    const labels = kind === 'category' ? [article.data.category] : article.data.tags;
    for (const name of labels) map.set(name, [...(map.get(name) ?? []), article]);
  }
  return [...map].sort(([a], [b]) => a.localeCompare(b, 'zh-CN'));
}
export function archiveGroups(entries: Article[]) {
  const map = new Map<string, Article[]>();
  for (const article of entries) {
    const year = article.data.date.getUTCFullYear().toString();
    map.set(year, [...(map.get(year) ?? []), article]);
  }
  return [...map].sort(([a], [b]) => Number(b) - Number(a));
}
