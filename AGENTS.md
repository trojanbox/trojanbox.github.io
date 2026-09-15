# trojanbox 内容主站

权威需求：trojanbox/project-documents#52；#51 仅保留讨论历史。

- 这是多页面内容站，导航为首页、文章、专题、归档。禁止恢复个人介绍、头像、精选、推荐、热门、评论、账号或云同步。
- 使用 Astro 静态生成、TypeScript、Markdown Content Collections、原生 CSS。不得增加 React/Vue/SPA 或后台。
- 每篇文章一个主分类、零到多个标签；专题只保存外部入口与元数据，不能复制独立专题正文。
- 默认浅色，支持深色；现代出版物排版，正文单栏。Mermaid、行内/块级公式、阅读设置、阅读进度和基础离线均须回归。
- Service Worker 注册在根作用域，但只处理构建清单内属于本站的 URL。不得拦截、缓存、离线兜底其它项目 Pages；禁止全域 caches.delete、localStorage.clear 或注销其它项目的 Service Worker。
- 所有设置/缓存使用 `trojanbox-main` 命名空间。存储不可用不能阻断阅读。更新不得强制刷新正在阅读的页面。
- 不编造用户文章、阅读量或专题更新日期；演示内容须标明用途，draft 不得进入公开路由、RSS、分类或归档。
- 修改前阅读本文件和相关源码。执行 `npm run check`、`npm test`、`npm run build`、`npm run test:e2e`；结果必须真实记录。
- 一个完整逻辑修改统一 Git 提交，修复后重新验证；不要逐文件提交。发布必须由成功的验证任务放行。
