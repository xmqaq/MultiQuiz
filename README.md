# MultiQuiz

一个纯前端的题库管理与刷题应用，基于 Vue 3 构建，所有数据存储在浏览器本地。

## 功能

- **科目管理** — 创建、编辑、删除科目，按科目组织题库
- **题目导入** — 支持导入 Excel (.xlsx) 和文本文件，自动解析题目格式
- **浏览模式** — 按科目浏览题目，可切换显示/隐藏答案
- **考试模式** — 限时答题，支持自定义题目数量、时间限制、错题优先、权重选题、收藏夹选题
- **错题本** — 自动记录错题，支持错题重练和手动移除
- **考试历史** — 查看历史考试记录和每道题的作答详情
- **练习统计** — 可视化统计练习次数、正确率等数据
- **标签与收藏** — 为题目打标签、收藏题目，方便分类筛选
- **数据备份** — 支持导出/导入 JSON 备份文件，轻松迁移数据
- **响应式布局** — 桌面端侧边栏导航，移动端底部导航，适配不同屏幕

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 (Composition API, `<script setup>`) |
| 语言 | TypeScript |
| 构建 | Vite 6 |
| 状态管理 | Pinia 3 |
| 路由 | Vue Router 5 |
| 表格解析 | xlsx |
| 测试 | Vitest + jsdom |

## 项目结构

```
src/
├── components/
│   ├── common/       # 通用组件 (Modal, Toast, EmptyState, TabIcon)
│   ├── layout/       # 布局组件 (SidebarNav, MobileNav)
│   └── pages/        # 页面组件 (7 个页面)
├── services/         # 业务逻辑层
│   ├── storage.ts    # localStorage 读写
│   ├── backup.ts     # 数据备份/恢复
│   ├── importer.ts   # 题目文件解析
│   ├── examLogic.ts  # 考试选题算法
│   ├── migrations.ts # 数据迁移与修复
│   ├── validators.ts # 题目格式校验
│   ├── utils.ts      # 工具函数
│   └── constants.ts  # 常量定义
├── stores/           # Pinia 状态管理
│   ├── library.ts    # 题库核心 (科目、题目、错题、收藏、标签)
│   ├── exam.ts       # 考试会话
│   ├── browse.ts     # 浏览模式
│   ├── stats.ts      # 统计数据
│   └── ui.ts         # UI 状态 (侧边栏、Toast、Modal)
├── types/            # TypeScript 类型定义
├── router/           # 路由配置
├── tests/            # 单元测试
├── App.vue           # 根组件
└── main.ts           # 应用入口
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建产物
npm run preview

# 运行测试
npm test

# 类型检查
npm run typecheck

# 一键检查 (类型 + 测试 + 构建)
npm run check
```

## 数据存储

所有数据存储在浏览器的 `localStorage` 中，不上传任何服务器。可通过"备份"功能导出 JSON 文件进行数据备份或迁移。
