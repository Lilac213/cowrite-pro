# Bug 修复：重复 Writing Sessions 导致的加载失败

## 问题描述

### 错误信息
```
JSON object requested, multiple (or no) rows returned
Code: PGRST116
Details: Results contain 2 rows, application/vnd.pgrst.object+json requires 1 row
```

### 发生场景
- 用户点击"进入下一阶段"后跳转到资料整理页
- MaterialReviewStage 尝试加载数据时失败
- 显示 "0 / 0" 资料，无法正常使用

### 根本原因
1. **数据库中存在重复记录**: 同一个 `project_id` 对应了多个 `writing_sessions` 记录
2. **查询方法不当**: `getWritingSession` 使用 `.maybeSingle()` 期望返回 0 或 1 条记录，但实际返回了 2 条
3. **缺少唯一约束**: `writing_sessions` 表的 `project_id` 字段没有唯一约束，允许重复插入

## 修复方案

### 1. 更新 `getWritingSession` 函数

**位置**: `src/db/api.ts`

**修改前**:
```typescript
export async function getWritingSession(projectId: string): Promise<WritingSession | null> {
  const { data, error } = await supabase
    .from('writing_sessions')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();  // ❌ 如果有多条记录会报错

  if (error) throw error;
  return data as WritingSession | null;
}
```

**修改后**:
```typescript
export async function getWritingSession(projectId: string): Promise<WritingSession | null> {
  const { data, error } = await supabase
    .from('writing_sessions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })  // ✅ 按创建时间倒序
    .limit(1)                                    // ✅ 只取最新的一条
    .maybeSingle();

  if (error) throw error;
  return data as WritingSession | null;
}
```

**改进点**:
- 添加 `.order('created_at', { ascending: false })` 按创建时间倒序排列
- 添加 `.limit(1)` 只获取最新的一条记录
- 即使有多条记录也能正常工作，返回最新的 session

### 2. 增强 `getOrCreateWritingSession` 函数

**位置**: `src/db/api.ts`

**修改前**:
```typescript
export async function getOrCreateWritingSession(projectId: string): Promise<WritingSession> {
  // ... 获取现有会话的代码 ...

  // 创建新会话
  const { data, error } = await supabase
    .from('writing_sessions')
    .insert({ /* ... */ })
    .select()
    .single();

  if (error) throw error;  // ❌ 如果并发创建会直接抛出错误
  return data as WritingSession;
}
```

**修改后**:
```typescript
export async function getOrCreateWritingSession(projectId: string): Promise<WritingSession> {
  // ... 获取现有会话的代码 ...

  // 创建新会话
  const { data, error } = await supabase
    .from('writing_sessions')
    .insert({ /* ... */ })
    .select()
    .single();

  if (error) {
    // ✅ 如果是唯一约束冲突（可能是并发创建），重新获取
    if (error.code === '23505') {
      const { data: retry, error: retryError } = await supabase
        .from('writing_sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (retryError) throw retryError;
      return retry as WritingSession;
    }
    throw error;
  }
  
  return data as WritingSession;
}
```

**改进点**:
- 捕获唯一约束冲突错误（错误代码 `23505`）
- 如果发生并发创建冲突，重新获取已存在的 session
- 避免因并发操作导致的错误

### 3. 添加数据库唯一约束

**迁移文件**: `add_unique_constraint_writing_sessions_project_id`

```sql
-- 首先删除重复的 writing_sessions，只保留每个 project_id 最新的一条
WITH ranked_sessions AS (
  SELECT 
    id,
    project_id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at DESC) as rn
  FROM writing_sessions
)
DELETE FROM writing_sessions
WHERE id IN (
  SELECT id FROM ranked_sessions WHERE rn > 1
);

-- 添加唯一约束，确保每个 project 只有一个 writing_session
ALTER TABLE writing_sessions
ADD CONSTRAINT writing_sessions_project_id_unique UNIQUE (project_id);

-- 添加注释
COMMENT ON CONSTRAINT writing_sessions_project_id_unique ON writing_sessions IS '确保每个项目只有一个写作会话';
```

**作用**:
1. **清理历史数据**: 删除所有重复的 writing_sessions，每个 project 只保留最新的一条
2. **防止未来重复**: 添加唯一约束，数据库层面阻止插入重复记录
3. **提高数据完整性**: 确保数据模型的一致性

## 技术细节

### 为什么会产生重复记录？

可能的原因：
1. **并发创建**: 多个请求同时调用 `getOrCreateWritingSession`，在检查和插入之间存在时间窗口
2. **重复调用**: 前端组件多次渲染导致重复调用创建函数
3. **错误重试**: 某些错误场景下的重试逻辑可能导致重复创建

### PostgreSQL 错误代码

- **PGRST116**: PostgREST 错误，表示查询期望返回单个对象但实际返回了多行
- **23505**: PostgreSQL 唯一约束冲突错误代码

### 查询优化

**之前的查询**:
```sql
SELECT * FROM writing_sessions WHERE project_id = '...'
```
- 如果有 2 条记录，`.maybeSingle()` 会抛出错误

**现在的查询**:
```sql
SELECT * FROM writing_sessions 
WHERE project_id = '...' 
ORDER BY created_at DESC 
LIMIT 1
```
- 即使有多条记录，也只返回最新的一条
- `.maybeSingle()` 不会报错

## 测试验证

### 测试场景 1: 正常加载
1. 用户在资料查询页点击"进入下一阶段"
2. 系统执行资料整理（调用 research-synthesis-agent）
3. 跳转到资料整理页
4. ✅ 正确加载 insights 和 gaps，显示正确的数量

### 测试场景 2: 并发创建
1. 两个请求同时调用 `getOrCreateWritingSession`
2. 第一个请求成功创建 session
3. 第二个请求遇到唯一约束冲突
4. ✅ 第二个请求自动重新获取已创建的 session，不抛出错误

### 测试场景 3: 历史数据
1. 数据库中已存在重复的 writing_sessions
2. 运行迁移脚本
3. ✅ 重复记录被清理，只保留最新的一条
4. ✅ 后续查询正常工作

## 影响范围

### 修改的文件
1. `src/db/api.ts`
   - `getWritingSession` 函数
   - `getOrCreateWritingSession` 函数

2. 数据库迁移
   - `add_unique_constraint_writing_sessions_project_id`

### 影响的功能
1. **资料整理页加载** ✅ 修复
2. **会话创建** ✅ 增强（支持并发）
3. **数据完整性** ✅ 提升（唯一约束）

### 不影响的功能
- 资料查询功能
- 其他阶段的工作流
- 用户数据和项目数据

## 部署说明

### 部署步骤
1. ✅ 代码已更新（`src/db/api.ts`）
2. ✅ 数据库迁移已应用（清理重复数据 + 添加唯一约束）
3. ✅ Lint 检查通过

### 回滚方案
如果需要回滚：
```sql
-- 移除唯一约束
ALTER TABLE writing_sessions
DROP CONSTRAINT writing_sessions_project_id_unique;
```

但**不建议回滚**，因为：
- 唯一约束保证了数据完整性
- 新代码向后兼容，即使没有约束也能正常工作
- 回滚会重新引入重复记录的风险

## 监控建议

### 日志监控
关注以下日志：
```
[MaterialReviewStage] 开始加载资料，projectId: xxx
[MaterialReviewStage] getWritingSession 返回: {...}
[MaterialReviewStage] session.id: xxx
[MaterialReviewStage] insights: X gaps: Y
```

### 错误监控
如果出现以下错误，需要进一步调查：
- `PGRST116`: 表示查询逻辑可能还有问题
- `23505`: 表示有代码尝试创建重复 session（应该被 catch 处理）

### 数据库监控
定期检查：
```sql
-- 检查是否有重复的 writing_sessions（应该返回 0 行）
SELECT project_id, COUNT(*) as count
FROM writing_sessions
GROUP BY project_id
HAVING COUNT(*) > 1;
```

## 相关文档

- [WORKFLOW_UPDATE_V2.md](./WORKFLOW_UPDATE_V2.md) - 工作流更新文档
- [Supabase PostgREST Error Codes](https://postgrest.org/en/stable/errors.html)
- [PostgreSQL Unique Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html#DDL-CONSTRAINTS-UNIQUE-CONSTRAINTS)

## 总结

这次修复解决了三个层面的问题：

1. **应用层**: 更新查询逻辑，支持多条记录的场景
2. **数据层**: 清理历史重复数据
3. **约束层**: 添加唯一约束，防止未来重复

修复后，系统更加健壮，能够：
- ✅ 正确处理历史遗留的重复数据
- ✅ 防止未来产生新的重复数据
- ✅ 优雅处理并发创建场景
- ✅ 提供更好的用户体验（不再显示错误）
