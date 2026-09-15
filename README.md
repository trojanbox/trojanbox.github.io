# trojanbox · 内容主站

Astro 7 静态内容站。权威需求：[`trojanbox/project-documents#52`](https://github.com/trojanbox/project-documents/issues/52)。

首页 / 文章 / 专题 / 归档。无个人介绍、精选推荐、账号或后台。文章正文支持 Mermaid、KaTeX 行内与块级公式、代码高亮、表格、图片图注、引用、脚注、章节锚点和目录；支持阅读设置、进度恢复、可安装应用和基础离线。

## 本地开发

要求 Node.js >= 22.12。

```sh
npm ci
npm run dev
```

```sh
npm run check
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run preview
```

`preview` 在 `http://127.0.0.1:4321` 提供生产构建；PWA 验收必须使用生产构建或真实 HTTPS 站点，开发服务器不注册 Service Worker。已有 Chromium 的环境可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。首次依赖由 npm 精确版本和 lockfile 固定，不依赖临时 Actions 制品。

## 写文章

在 `src/content/articles/` 添加 Markdown。文件名是长期稳定的英文短名（例如 `a-small-thought.md`），发布后避免重命名，以免改变 URL 和阅读进度身份。

```markdown
---
title: 一些想法
date: 2026-09-15
category: 随笔
tags: [阅读, 思考]
summary: 用一两句话描述这篇文章。
draft: false
---

正文从这里开始。
```

`category` 必须为单个非空字符串，`tags` 为数组。`updatedAt` 可选，不能早于发布日期。日期用 ISO 格式，日历展示统一使用 UTC 日期，避免不同时区跨天。`draft: true` 与晚于构建时刻的文章不进入路由、列表、RSS、标签或归档；未来日期文章到期仍需重新构建后才会发布。

内置 `reading-guide.md` 是明确标注的站点使用说明；`draft-example.md` 用于验证草稿排除，不应作为真实文章发布。

### 公式、图表、图片

行内：`$A = \pi r^2$`。块级使用单独行的 `$$` 包围公式。美元金额使用 `\$` 避免被识别为公式。

Mermaid 使用语言为 `mermaid` 的 fenced code block。图表随主题更新；源码保留为可展开内容。错误图表会显示明确提示和原始源码，不静默消失。

图片放在 `public/media/`，Markdown 写 `![替代文本](/media/example.png "图注")`。独立图片的 title 生成图注。离线保证范围为本地媒体；外部视频、外部图片和专题正文不在主站离线合同内。

### 发布文章

向 `master` 提交 Markdown 即触发校验、测试、构建与部署。分类、标签、归档、RSS 和 Sitemap 从已发布集合派生，无须手动登记。没有对应内容时不编造数量或显示假文章。

## 增加专题

在 `src/content/topics/` 新建 JSON：

```json
{
  "title": "专题名称",
  "summary": "简短说明。",
  "kind": "长期研究",
  "status": "ongoing",
  "url": "https://example.com/"
}
```

状态为 `ongoing` / `completed` / `paused`；`updatedAt` 可选，只有确知内容更新时间时填写。专题按已提供的更新时间、稳定 ID 排序；不自动读取外部仓库动态，不把正文搬回主站。现有连载入口为 `https://trojanbox.github.io/world-history-in-progress/`。

## 阅读设置与数据边界

主题与字号保存在 `trojanbox-main:settings:v1`，每篇阅读进度使用 `trojanbox-main:progress:v1:<articleId>`。未知配置版本恢复默认；浏览器拒绝存储时本次设置仍生效，正文继续可读。恢复默认只重置阅读偏好，不清理整个域名存储。

进度按正文高度计算，排除目录、导航和页脚；重新访问提供「继续阅读」，带章节 hash 时优先尊重章节地址。没有账号和跨设备同步。不同浏览器、操作系统以及安装应用的存储隔离方式遵循平台规则。

## PWA 与基础离线

`prepare-assets.mjs` 从源 SVG 生成标准 / maskable 图标。`build-offline.mjs` 根据实际生成文件生成 Service Worker、页面所有权清单、Sitemap 和 build version。

- 预缓存首页、栏目壳、离线页与构建后的脚本、样式、公式字体等必要资源。
- **不预缓存所有文章 HTML**。首次访问完成后通过受限消息缓存当前文章及本地引用资源。
- 文章导航网络优先，离线才取已缓存版本。未缓存文章返回明确的 503 离线页面；在线 404/5xx 保持真实状态。
- 新 Worker 等待用户同意或旧客户端退出后激活；不主动强制刷新。激活只删除本站旧 shell cache。浏览器可能回收离线数据；离线副本不等于永久备份。
- 根作用域 Worker 只处理构建清单中的本站页面及本站 `_astro` 资源。对其它项目路径不调用 `respondWith`，不会把连载站请求重定向到主站或改成离线页。
- 存储、Cache Storage 都使用 `trojanbox-main` 命名空间。禁止清空整个域名缓存或注销其它项目 Worker。
- 没有整站下载、专题下载、离线管理、后台同步或推送通知。

安装提示由浏览器决定；不支持 `beforeinstallprompt` 的平台显示原生安装方式。自动化只证明 Manifest 和网页行为，实际操作系统桌面/主屏安装需在对应设备验收。

## 部署与验证

GitHub Pages 发布源应为 GitHub Actions。`.github/workflows/site.yml` 在校验、单元测试、生产构建和 Chromium 浏览器测试全部成功后部署。`dist` 只通过 Pages artifact 发布，不把生成文件提交进源码根目录。

浏览器回归包括：导航、中文分类/标签、草稿不公开、Mermaid 与公式、深浅主题、字号持久化、进度恢复、存储不可用、首次文章离线、未缓存离线兜底、独立项目不受影响、窄屏不横向溢出、更新提示。

`tests/e2e` 中独立项目响应和 Worker 更新用例只修改本地 `dist` 临时文件，并在 finally 还原；不会修改独立连载仓库。
