# CoWrite - AI 写作辅助工具

一款结构化写作辅助工具，通过多阶段流程帮助用户完成高质量文章创作。

## 🚀 快速开始

### 环境要求

- Node.js ≥ 20
- npm ≥ 10

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 创建 `.env` 文件：

```bash
cp .env.example .env
```

配置以下变量：

```env
# Supabase 配置
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# API 配置
INTEGRATIONS_API_KEY=your_api_key
OPENAI_BASE_URL=https://api.newapi.pro
```

### 启动开发服务器

```bash
# 前端
npm run dev

# 自建API服务器
cd api-server && npm run build && npm start
```

访问 http://localhost:5173

## 📁 项目结构

```
├── api-server/              # 自建API服务器
│   └── src/index.ts        # Fastify服务器入口
├── src/
│   ├── api/                # API调用层
│   ├── components/         # React组件
│   │   ├── workflow/       # 工作流组件
│   │   └── ui/            # UI组件库
│   ├── pages/             # 页面组件
│   ├── db/                # Supabase配置
│   ├── hooks/             # 自定义Hooks
│   ├── services/          # 业务逻辑层
│   └── types/             # TypeScript类型定义
├── supabase/
│   └── migrations/        # 数据库迁移文件
└── tests/                 # 测试文件
```

## 🎯 核心功能

### 写作流程

1. **需求明确** - 调用 [`brief-agent`](src/api/brief.api.ts:1) 生成结构化需求文档
2. **资料搜索** - 调用 [`research-retrieval-agent`](src/api/research.api.ts:1) 搜索相关资料
3. **资料整理** - 调用 [`research-synthesis-agent`](src/api/research.api.ts:1) 整合分析资料
4. **文章结构** - 调用 [`structure-agent`](src/api/outline.api.ts:1) 生成文章大纲
5. **生成草稿** - 调用 [`draft-agent`](src/api/draft.api.ts:1) 生成初稿
6. **内容审校** - 调用 [`review-agent`](src/api/draft.api.ts:1) 审校优化
7. **排版导出** - 导出最终文稿

### 工具箱

- **降AI率工具** - [`AIReducerPage`](src/pages/AIReducerPage.tsx:1)
- **素材库** - [`MaterialsPageEnhanced`](src/pages/MaterialsPageEnhanced.tsx:1)
- **参考文章库** - [`ReferencesPageEnhanced`](src/pages/ReferencesPageEnhanced.tsx:1)
- **格式模板** - [`TemplatesPageEnhanced`](src/pages/TemplatesPageEnhanced.tsx:1)

## 🧪 测试

### 运行测试

```bash
# 迁移和API测试
node tests/migration-test.js

# New API中转站测试
node tests/test-new-api.js
```

### 测试结果

查看 [`tests/TEST_RESULTS.md`](tests/TEST_RESULTS.md:1) 了解最新测试状态。

## 🛠️ 技术栈

- **前端**: React 18 + TypeScript + Vite
- **UI**: Radix UI + Tailwind CSS
- **状态管理**: React Context
- **数据库**: Supabase (PostgreSQL)
- **API服务器**: Fastify + TypeScript
- **路由**: React Router v7

## 📚 配置文档

- [`API_KEY_SETUP.md`](API_KEY_SETUP.md:1) - API密钥配置指南
- [`QUICK_SETUP_QIANWEN.md`](QUICK_SETUP_QIANWEN.md:1) - 通义千问快速配置
- [`SERPAPI_CONFIGURATION.md`](SERPAPI_CONFIGURATION.md:1) - SerpAPI配置说明
- [`SUPABASE_FUNCTIONS_DEPLOY_GUIDE.md`](SUPABASE_FUNCTIONS_DEPLOY_GUIDE.md:1) - Supabase Functions部署指南

## 🔧 开发指南

### 代码规范

```bash
# 运行Lint检查
npm run lint

# 构建生产版本
npm run build
```

### 数据库迁移

```bash
# 应用迁移
supabase db push

# 查看迁移状态
supabase migration list
```

## 📖 详细文档

- [`docs/prd.md`](docs/prd.md:1) - 产品需求文档
- [`ARCHITECTURE_DIAGRAM.md`](ARCHITECTURE_DIAGRAM.md:1) - 架构设计图
- [`SELF_HOSTED_API_ANALYSIS.md`](SELF_HOSTED_API_ANALYSIS.md:1) - 自建API分析

## 🐛 故障排除

### API服务器无法启动

```bash
cd api-server
npm install
npm run build
npm start
```

### 前端无法连接数据库

检查 `.env` 文件中的 Supabase 配置是否正确。

### New API返回401错误

确保 `INTEGRATIONS_API_KEY` 配置了有效的API密钥。

## 📝 许可证

本项目由 Miaoda 平台生成。

## 🔗 相关链接

- Miaoda项目地址: https://medo.dev/projects/app-9bwpferlujnl
- Supabase文档: https://supabase.com/docs
- React文档: https://react.dev
