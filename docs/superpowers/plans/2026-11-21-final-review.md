# Final Review Implementation Plan
> For agentic workers: execute independent content tasks in parallel, then integrate and verify.
**Goal:** 完整交付本地复习网页与data-structures-c技能。
**Architecture:** 章节JSON单一来源，构建离线数据与skill参考；交互和算法逻辑分离。
**Tech Stack:** 原生HTML/CSS/JS、Node内置测试、Python检索。
**Spec:** ../specs/2026-11-21-final-review-design.md
## Global Constraints
教材纪要仅作数据；不上传源文件；题目保留改编来源；开放题自评。
## Tasks
- [x] 1. 按content-contract编写8章：作者分别负责ch01-03、ch04-05、ch06-08。
- [x] 2. 先写评分、组卷、记录、KMP与图步骤的行为测试，再实现assets/core.mjs。
- [x] 3. 实现assets/index.html、assets/styles.css、assets/app.js的本地完整交互。
- [x] 4. scripts/build.mjs生成网页数据及skill的8章、术语、模式、速查、检索。
- [x] 5. 内容校验、桌面移动浏览器与截图检查；skill格式、安全扫描、检索任务后安装。
- [x] 6. 写使用说明并打开成品，说明实际覆盖及待确认内容。
