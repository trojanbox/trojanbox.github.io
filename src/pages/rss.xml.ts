import rss from '@astrojs/rss';
import { articles, site, articleUrl } from '../lib/content';
export async function GET() {
  return rss({ title: 'trojanbox · 文章', description: site.description, site: site.url,
    items: (await articles()).map(article => ({ title: article.data.title, pubDate: article.data.date,
      description: article.data.summary, link: articleUrl(article), categories: [article.data.category, ...article.data.tags] })),
    customData: '<language>zh-CN</language>',
  });
}
