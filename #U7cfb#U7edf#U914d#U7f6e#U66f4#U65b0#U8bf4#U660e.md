# 系统配置集中化更新说明

## 更新概述

本次更新将 LLM 和搜索配置从用户个人设置移至管理员面板，实现系统级统一配置。

## 主要变更

### 1. 数据库变更

#### 新增 system_config 表
```sql
CREATE TABLE system_config (
  id UUID PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 默认配置
- `llm_provider`: qwen (通义千问)
- `llm_api_key`: 空（需管理员配置）
- `search_provider`: openalex (OpenAlex)
- `search_api_key`: 空（OpenAlex 不需要）

#### RLS 策略
- 只有管理员可以查看和修改系统配置
- 普通用户无法访问系统配置

### 2. Edge Functions 更新

#### llm-generate
- 从 `system_config` 表读取配置
- 支持通义千问 (qwen)、OpenAI、Anthropic
- 默认使用通义千问
- 错误提示：`系统 LLM 配置未完成，请联系管理员配置`

#### web-search
- 从 `system_config` 表读取配置
- 默认使用 OpenAlex（免费开放 API）
- 支持 Google、Bing 作为备选
- OpenAlex 不需要 API 密钥

### 3. 前端更新

#### AdminPage（管理面板）
**新增功能：**
- 系统配置标签页
- LLM 配置区域
  - 显示默认提供商：通义千问
  - 配置 API 密钥
  - 提供获取密钥的链接
- 搜索配置区域
  - 显示默认提供商：OpenAlex
  - 说明不需要 API 密钥
- 保存配置按钮

**权限：**
- 只有管理员可以访问
- 配置对所有用户生效

#### SettingsPage（用户设置）
**移除功能：**
- LLM 配置区域
- 搜索配置区域

**保留功能：**
- 用户信息展示
- 密码修改
- 退出登录

**新增提示：**
- 管理员用户看到"前往管理面板"按钮
- 提示可以在管理面板配置系统服务

#### BriefStage（需求生成）
**错误提示更新：**
- 旧：`请先在设置页面配置 LLM API 密钥`
- 新：`系统 LLM 配置未完成，请联系管理员配置通义千问 API 密钥`

### 4. 类型定义更新

#### Profile 接口
**移除字段：**
```typescript
llm_api_key?: string;
llm_provider?: string;
search_api_key?: string;
search_provider?: string;
```

#### 新增 SystemConfig 接口
```typescript
export interface SystemConfig {
  id: string;
  config_key: string;
  config_value: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}
```

### 5. API 函数更新

**新增函数：**
```typescript
getSystemConfig(): Promise<SystemConfig[]>
updateSystemConfig(configKey: string, configValue: string): Promise<SystemConfig>
```

**移除 Profile 更新中的字段：**
- 不再支持更新 llm_api_key、llm_provider
- 不再支持更新 search_api_key、search_provider

## 使用流程

### 管理员配置流程

1. 登录管理员账户
2. 进入"管理面板"
3. 点击"系统配置"标签
4. 在"LLM 配置"区域：
   - 查看默认提供商：通义千问
   - 输入通义千问 API 密钥
   - 参考链接：https://dashscope.console.aliyun.com/
5. 在"搜索配置"区域：
   - 查看默认提供商：OpenAlex
   - 无需配置 API 密钥
6. 点击"保存配置"

### 普通用户使用流程

1. 登录账户
2. 创建项目
3. 开始写作
4. 如果遇到"系统 LLM 配置未完成"错误：
   - 联系管理员配置通义千问 API 密钥
5. 配置完成后即可正常使用所有 AI 功能

## 优势

### 1. 集中管理
- 管理员统一配置，避免每个用户单独配置
- 降低用户使用门槛
- 便于统一管理和维护

### 2. 成本控制
- 使用统一的 API 密钥
- 便于监控和控制 API 使用量
- 避免用户滥用

### 3. 简化用户体验
- 用户无需了解 API 配置
- 开箱即用
- 降低学习成本

### 4. 默认提供商优势

**通义千问 (Qwen)：**
- 阿里云产品，国内访问稳定
- 中文理解能力强
- 价格相对较低
- 适合中文写作场景

**OpenAlex：**
- 完全免费的学术搜索 API
- 无需注册和密钥
- 数据质量高
- 适合学术和专业写作

## 迁移说明

### 对现有用户的影响

1. **已配置 API 的用户：**
   - 个人配置将失效
   - 需要管理员重新配置系统级 API
   - 数据不会丢失

2. **未配置 API 的用户：**
   - 无影响
   - 等待管理员配置后即可使用

### 数据迁移

如果需要保留现有用户的 API 配置：

```sql
-- 查询第一个管理员的 API 配置
SELECT llm_api_key, llm_provider, search_api_key, search_provider
FROM profiles
WHERE role = 'admin'
ORDER BY created_at
LIMIT 1;

-- 手动更新到 system_config
UPDATE system_config SET config_value = '管理员的API密钥' WHERE config_key = 'llm_api_key';
UPDATE system_config SET config_value = '管理员的提供商' WHERE config_key = 'llm_provider';
```

## 注意事项

1. **首次使用：**
   - 管理员必须先配置通义千问 API 密钥
   - 否则所有用户无法使用 AI 功能

2. **API 密钥安全：**
   - 只有管理员可以查看和修改
   - 密钥以密码形式显示
   - 建议定期更换密钥

3. **错误处理：**
   - 如果 API 调用失败，提示用户联系管理员
   - 管理员应检查 API 密钥是否正确
   - 检查 API 配额是否充足

4. **OpenAlex 使用：**
   - 完全免费，无需配置
   - 主要用于学术文献搜索
   - 如需通用搜索，可切换到 Google 或 Bing

## 后续优化方向

1. **多提供商支持：**
   - 允许管理员配置多个 LLM 提供商
   - 自动切换和负载均衡

2. **使用量统计：**
   - 记录 API 调用次数
   - 显示使用量和成本
   - 设置使用限额

3. **用户级配额：**
   - 为不同用户设置不同的使用配额
   - 防止滥用

4. **API 密钥轮换：**
   - 支持配置多个 API 密钥
   - 自动轮换使用
   - 提高可用性

## 技术细节

### 通义千问 API 集成

```typescript
// API 端点
https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation

// 请求头
Authorization: Bearer ${apiKey}

// 请求体
{
  model: 'qwen-plus',
  input: {
    messages: [...]
  },
  parameters: {
    temperature: 0.7
  }
}

// 响应
{
  output: {
    text: '生成的文本'
  }
}
```

### OpenAlex API 集成

```typescript
// API 端点
https://api.openalex.org/works?search=${query}&per-page=10

// 无需认证
// 建议添加 mailto 参数以获得更高的速率限制
mailto=cowrite@example.com

// 响应
{
  results: [
    {
      title: '文章标题',
      abstract: '摘要',
      doi: 'DOI',
      publication_date: '发布日期'
    }
  ]
}
```

## 测试清单

- [x] 管理员可以访问系统配置
- [x] 普通用户无法访问系统配置
- [x] 管理员可以保存配置
- [x] 配置保存后对所有用户生效
- [x] Edge Functions 正确读取系统配置
- [x] 通义千问 API 调用成功
- [x] OpenAlex API 调用成功
- [x] 错误提示正确显示
- [x] 用户设置页面移除 API 配置
- [x] 管理员看到"前往管理面板"提示
- [x] 所有代码通过 lint 检查

## 完成状态

✅ 数据库迁移完成
✅ Edge Functions 更新完成
✅ 前端页面更新完成
✅ 类型定义更新完成
✅ API 函数更新完成
✅ 错误提示更新完成
✅ 代码通过 lint 检查
✅ 文档编写完成

🎉 **系统配置集中化更新已完成！**
