# 数据结构期末复习

## 开始复习

在浏览器里打开 [复习网页](dist/index.html)。复制或移动网页时，请保留整个 `dist` 文件夹。页面可以离线运行。

- **章节知识**支持关键词查找。每个主题有概念、步骤、条件、例题、易错点和教材页码，可手动标记已掌握。
- **题型练习**可按章节和题型抽题。选择和程序填空自动评分。计算、编程及综合题请先独立作答，再展开解法自评。
- **100 分模拟卷**每次从题库抽取一套练习。选择题按 20 道、每道 2 分组卷，采用纪要正文和饼图里的 40 分口径。其余部分包括 4 道填空共 10 空、4 道计算、2 道编程和 1 道综合。
- **算法演练**提供 KMP 的 `next` 表和失配回退、BFS 的出队与发现顺序，以及末元素 Lomuto 快排的分区过程。
- **错题与记录**允许重做错题、导出 JSON 备份或恢复记录。答对后会移出错题列表。导入备份会替换当前学习记录。浏览器、配置文件或网页路径发生变化时，可用备份迁移。

## 在 Codex 中使用技能

项目技能位于 [data-structures-c](.agents/skills/data-structures-c/SKILL.md)。可以在本项目的对话中输入 `用 $data-structures-c 带我按教材下标约定演算一道 KMP 题`。

在项目目录执行下列命令可离线定位主题。结果包含参考文件、行号、概述和教材页码。

```powershell
python .agents/skills/data-structures-c/scripts/search.py "KMP nextval"
python .agents/skills/data-structures-c/scripts/search.py "最小生成树" --limit 1
```

## 教材与考试口径

题库包含 **8 章、37 个知识主题、100 道自编练习**。教材节号、印刷页码和 PDF 页码标明在各主题下。正式选择题题量、考试时长、具体考题与编程语言要求，以任课老师的通知为准。纪要中的选择题分值差异、循环队列判空判满以及图综合题的概率性描述见 [考试范围与知识库建设依据](docs/考试范围与知识库建设依据.md)。

## 从源数据重新构建

在项目目录使用 Node.js 24 和 Python 3 执行以下命令。浏览器验收使用 Chrome，如果安装路径不同，可设置 `CHROME_PATH` 指向 Chrome 可执行文件。

```powershell
node scripts/build.mjs
node --test tests/*.test.mjs
node tests/browser-smoke.mjs
```

章节内容从 `knowledge/chapters` 下的 JSON 生成。构建同时更新网页和技能参考。桌面和手机的验收截图位于 [docs/verification](docs/verification)。
## 验证状态（2026-11-21）

已完成一次完整的本地交付验收：

- `node scripts/build.mjs`：8 章、37 个主题、100 道练习，模拟卷合计 100 分。
- `node --test tests/*.test.mjs`：13/13 通过，覆盖评分、组卷、记录、搜索、KMP、BFS、快排和哈夫曼等核心逻辑。
- `node tests/browser-smoke.mjs`：桌面与移动布局、搜索、掌握度、练习、模拟卷、自评、错题重做、记录导入导出、算法演练、范围页和溢出检查通过；浏览器错误 0，外部请求 0。
- 验收截图：`docs/verification/desktop-overview.png`、`mobile-overview.png`、`mobile-kmp.png`。

## 待确认内容

题库是自编/改编练习，不等同于教材原题、历年真题或押题。正式考试的题量、时长、选择题分值、编程语言和具体考点仍以任课教师的最新通知为准；纪要中标记为“可能/建议”的内容也应按课堂口径调整。
