# 任务：优化资料搜索和整理流程

## 当前任务
- [x] 修复 research-synthesis-agent 日志详情
  - [x] 改进 Edge Function 错误日志
  - [x] 在 api.ts 中添加详细错误处理
  - [x] 添加资料整理日志追踪
  - [x] 创建独立的资料整理日志显示
  - [x] 重新部署 Edge Function

- [x] 实现搜索结果 localStorage 缓存
  - [x] 添加缓存保存/加载/清除函数
  - [x] 在搜索完成后保存到缓存
  - [x] 在组件初始化时从缓存加载
  - [x] 在刷新搜索时清除缓存

- [x] 简化资料选择流程
  - [x] 移除 MaterialSelectionPanel 组件
  - [x] 直接使用 SearchResultsPanel 进行选择
  - [x] 更新"资料整理"按钮逻辑
  - [x] 移除不必要的确认步骤

- [x] 修复资料选择同步问题
  - [x] 添加 updateRetrievedMaterialSelection 函数
  - [x] 添加 batchUpdateRetrievedMaterialSelection 函数
  - [x] 更新 handleToggleSelect 同步 retrieved_materials 表
  - [x] 更新 handleBatchFavorite 同步 retrieved_materials 表
  - [x] 确保选择状态在数据库和 UI 之间正确同步
  - [x] 修复缓存加载逻辑：优先从数据库加载资料
  - [x] 添加详细日志以便调试选择状态同步问题

- [x] 修改资料整理流程为自动处理所有资料
  - [x] 修改 handleOrganize 使用 getRetrievedMaterials 而非 getSelectedMaterials
  - [x] 移除"至少选择一条资料"的验证逻辑
  - [x] 更新 UI 提示文本，说明将自动整理所有搜索结果
  - [x] 更新搜索完成后的提示信息
  - [x] 保留复选框功能（供未来扩展使用）

## 重要提示：API 密钥配置

### 问题
Research Synthesis Agent 调用失败，错误信息：
- "Edge Function returned a non-2xx status code"
- "LLM API 调用失败 (401): Api key is invalid"

### 原因
Edge Function `research-synthesis-agent` 需要 `QIANWEN_API_KEY` 环境变量来调用 SiliconFlow API，但该密钥未配置或无效。

### 解决方案

#### 1. 获取 API 密钥
访问 https://cloud.siliconflow.cn 并完成以下步骤：
1. 注册账号并登录
2. 进入控制台
3. 创建 API Key
4. 复制生成的 API Key

#### 2. 配置密钥到 Supabase
在 Supabase 项目中配置密钥：
1. 打开 Supabase Dashboard
2. 进入 Project Settings → Edge Functions → Secrets
3. 添加新的 Secret：
   - Name: `QIANWEN_API_KEY`
   - Value: [粘贴你的 API Key]
4. 保存

#### 3. 重新部署 Edge Function
配置密钥后，需要重新部署 Edge Function 才能生效：
```bash
supabase functions deploy research-synthesis-agent
```

或者在 Miaoda 平台上点击"同步配置"按钮。

### 使用的 API
- **服务商**: SiliconFlow (https://api.siliconflow.cn)
- **模型**: Qwen/Qwen2.5-7B-Instruct
- **用途**: Research Synthesis Agent 的 LLM 推理

### 代码位置
- Edge Function: `/supabase/functions/research-synthesis-agent/index.ts`
- API 调用: Line 230-245
- 密钥获取: Line 28

## 实现详情

### 1. 改进资料整理日志

#### Edge Function 错误日志增强
在 `research-synthesis-agent/index.ts` 中：

```typescript
} catch (error: any) {
  console.error("Research Synthesis Agent 错误:", error);
  console.error("错误堆栈:", error.stack);
  console.error("错误详情:", JSON.stringify(error, null, 2));
  
  // 构建详细的错误响应
  const errorResponse = {
    error: error.message || "处理失败",
    details: {
      type: error.name || "UnknownError",
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    },
    timestamp: new Date().toISOString(),
  };
  
  return new Response(
    JSON.stringify(errorResponse),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

#### API 错误处理增强
在 `api.ts` 的 `callResearchSynthesisAgent` 函数中：

```typescript
if (error) {
  console.error('[callResearchSynthesisAgent] Edge Function 错误:', error);
  console.error('[callResearchSynthesisAgent] 错误详情:', JSON.stringify(error, null, 2));
  
  // 尝试获取更详细的错误信息
  if (error.context) {
    console.error('[callResearchSynthesisAgent] 错误上下文:', error.context);
    try {
      const contextText = await error.context.text();
      console.error('[callResearchSynthesisAgent] 上下文文本:', contextText);
      
      // 尝试解析 JSON 错误响应
      try {
        const errorData = JSON.parse(contextText);
        throw new Error(
          `资料整理失败: ${errorData.error || error.message}\n` +
          `详情: ${errorData.details ? JSON.stringify(errorData.details, null, 2) : '无'}\n` +
          `时间: ${errorData.timestamp || '未知'}`
        );
      } catch (parseError) {
        // 如果不是 JSON，直接使用文本
        throw new Error(`资料整理失败: ${contextText || error.message}`);
      }
    } catch (textError) {
      console.error('[callResearchSynthesisAgent] 无法读取上下文文本:', textError);
    }
  }
  
  throw new Error(`资料整理失败: ${error.message || 'Edge Function 调用失败'}`);
}
```

#### 资料整理日志追踪
在 `KnowledgeStage.tsx` 的 `handleOrganize` 函数中添加详细日志：

```typescript
setSynthesisLogs([]); // 清空旧日志

// 添加初始日志
setSynthesisLogs(['[' + new Date().toLocaleTimeString('zh-CN') + '] 开始资料整理...']);

// 1. 获取选中的资料
setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在获取选中的资料...']);
const selectedMaterials = await getSelectedMaterials(writingSession.id);
setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 已选择 ' + selectedMaterials.length + ' 条资料']);

// 2. 保存资料
setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在保存资料到知识库...']);
// ... 保存逻辑
setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 资料保存完成，新增 ' + savedCount + ' 条']);

// 3. 调用 Agent
setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 🤖 启动 Research Synthesis Agent...']);
setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在分析资料并生成研究洞察...']);
const result = await callResearchSynthesisAgent(projectId, writingSession.id);
setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] ✅ Research Synthesis Agent 完成']);

// 错误处理
catch (error: any) {
  setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] ❌ 资料整理失败: ' + error.message]);
}
```

#### 独立的资料整理日志显示
在 `SearchLogsDialog.tsx` 中添加日志类型支持：

```typescript
interface SearchLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectTitle: string;
  logs: string[];
  logType?: 'search' | 'synthesis'; // 新增：日志类型
}

// 根据日志类型定义不同的阶段标识
const synthesisStagePatterns = [
  { pattern: /开始资料整理/, stage: '开始资料整理', status: 'success' as const },
  { pattern: /正在获取选中的资料/, stage: '正在获取选中的资料', status: 'running' as const },
  { pattern: /已选择.*条资料/, stage: '资料选择完成', status: 'success' as const },
  { pattern: /正在保存资料到知识库/, stage: '正在保存资料到知识库', status: 'running' as const },
  { pattern: /资料保存完成/, stage: '资料保存完成', status: 'success' as const },
  { pattern: /启动 Research Synthesis Agent/, stage: '启动 Research Synthesis Agent', status: 'running' as const },
  { pattern: /正在分析资料并生成研究洞察/, stage: '正在分析资料并生成研究洞察', status: 'running' as const },
  { pattern: /Research Synthesis Agent 完成/, stage: 'Research Synthesis Agent 完成', status: 'success' as const },
  { pattern: /正在加载研究洞察和空白/, stage: '正在加载研究洞察和空白', status: 'running' as const },
  { pattern: /已生成.*条研究洞察/, stage: '研究洞察生成完成', status: 'success' as const },
  { pattern: /错误|失败|Error|❌/, stage: '资料整理出现错误', status: 'error' as const },
];
```

在 `KnowledgeStage.tsx` 中添加资料整理日志栏：

```typescript
{/* 资料整理日志 - 固定底部日志栏 */}
{synthesisLogs.length > 0 && synthesizing && (
  <div 
    className="fixed bottom-0 left-0 right-0 bg-purple-900 text-white border-t border-purple-700 shadow-lg z-50 cursor-pointer hover:bg-purple-800 transition-colors"
    onClick={() => {
      setLogDialogType('synthesis');
      setShowLogsDialog(true);
    }}
  >
    <div className="container mx-auto px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${synthesizing ? 'bg-purple-300 animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-sm font-medium text-purple-200">资料整理日志</span>
          </div>
          {/* ... 日志内容显示 */}
        </div>
      </div>
    </div>
  </div>
)}
```

### 2. localStorage 缓存实现

#### 缓存函数
在 `KnowledgeStage.tsx` 中添加：

```typescript
// localStorage 缓存相关函数
const getCacheKey = (projectId: string) => `search_cache_${projectId}`;

const saveSearchCache = (projectId: string, data: {
  searchPlan: any;
  retrievedMaterials: RetrievedMaterial[];
  searchLogs: string[];
  lastSearchTime: string;
  query: string;
}) => {
  try {
    const cacheKey = getCacheKey(projectId);
    localStorage.setItem(cacheKey, JSON.stringify(data));
    console.log('[saveSearchCache] 缓存已保存:', cacheKey);
  } catch (error) {
    console.error('[saveSearchCache] 保存缓存失败:', error);
  }
};

const loadSearchCache = (projectId: string) => {
  try {
    const cacheKey = getCacheKey(projectId);
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      console.log('[loadSearchCache] 缓存已加载:', data);
      return data;
    }
  } catch (error) {
    console.error('[loadSearchCache] 加载缓存失败:', error);
  }
  return null;
};

const clearSearchCache = (projectId: string) => {
  try {
    const cacheKey = getCacheKey(projectId);
    localStorage.removeItem(cacheKey);
    console.log('[clearSearchCache] 缓存已清除:', cacheKey);
  } catch (error) {
    console.error('[clearSearchCache] 清除缓存失败:', error);
  }
};
```

#### 初始化时加载缓存
在 `useEffect` 中：

```typescript
// 尝试从缓存加载搜索结果
const cached = loadSearchCache(projectId);
if (cached && cached.retrievedMaterials && cached.retrievedMaterials.length > 0) {
  console.log('[initSession] 从缓存加载搜索结果');
  setSearchPlan(cached.searchPlan);
  setRetrievedMaterials(cached.retrievedMaterials);
  setSearchLogs(cached.searchLogs || []);
  setLastSearchTime(cached.lastSearchTime || '');
  setQuery(cached.query || '');
  
  // 转换为 knowledge 格式
  const knowledgeItems: KnowledgeBase[] = cached.retrievedMaterials.map((material: RetrievedMaterial) => {
    // ... 转换逻辑
  });
  setKnowledge(knowledgeItems);
  setAutoSearched(true); // 标记为已搜索，避免重复搜索
  
  toast({
    title: '已加载缓存的搜索结果',
    description: `共 ${cached.retrievedMaterials.length} 条资料`,
  });
}
```

#### 搜索完成后保存缓存
在 `handleSearch` 函数中：

```typescript
// 更新最后搜索时间
const searchTime = new Date().toLocaleString('zh-CN');
setLastSearchTime(searchTime);

// 保存搜索结果到 localStorage 缓存
saveSearchCache(projectId, {
  searchPlan: retrievalResults?.search_summary || null,
  retrievedMaterials: loadedMaterials,
  searchLogs: [...searchLogs, '[' + new Date().toLocaleTimeString('zh-CN') + '] ✅ 资料检索完成'],
  lastSearchTime: searchTime,
  query: queryToUse,
});
```

#### 刷新时清除缓存
在 `handleRefreshSearch` 函数中：

```typescript
const handleRefreshSearch = () => {
  // 清除缓存
  clearSearchCache(projectId);
  
  setRetrievedMaterials([]);
  setAutoSearched(false); // 重置自动搜索标记
  
  // 触发重新搜索
  if (query.trim()) {
    handleSearch();
  } else {
    // 如果没有查询词，尝试从需求文档自动搜索
    autoSearchFromBrief();
  }
};
```

### 3. 简化资料选择流程

#### 移除 MaterialSelectionPanel
- 删除 `import MaterialSelectionPanel from './MaterialSelectionPanel';`
- 删除 `showMaterialSelection` 和 `materialsConfirmed` 状态变量
- 删除 `handleMaterialSelectionConfirm` 函数
- 移除 MaterialSelectionPanel 组件的渲染

#### 直接使用 SearchResultsPanel
SearchResultsPanel 已经支持：
- 复选框选择
- 批量操作
- 过滤和搜索

用户可以直接在搜索结果中选择资料，无需额外的确认步骤。

#### 更新"资料整理"按钮
```typescript
<Button 
  onClick={handleOrganize} 
  variant="outline"
  className="min-w-[140px]"
  disabled={synthesizing || retrievedMaterials.length === 0}
>
  <Sparkles className="h-4 w-4 mr-2" />
  {synthesizing ? '整理中...' : '资料整理'}
</Button>
```

按钮现在：
- 只要有检索到的资料就可以点击
- 不需要先确认资料选择
- 直接调用 `handleOrganize` 进行整理

#### 更新提示文本
```typescript
{researchStageComplete ? (
  <span className="text-green-600 font-medium flex items-center gap-2">
    <CheckCircle2 className="h-4 w-4" />
    研究阶段已完成，可以进入下一阶段
  </span>
) : retrievedMaterials.length > 0 ? (
  <span>
    请从搜索结果中选择资料，然后点击"资料整理"
  </span>
) : (
  <span>
    请先进行资料搜索
  </span>
)}
```

### 4. 修复资料选择同步问题

#### 问题描述
用户在 SearchResultsPanel 中勾选资料后，点击"资料整理"按钮时提示"至少选择一条资料才能继续"。

**根本原因**：
1. SearchResultsPanel 的选择操作调用 `handleToggleSelect`
2. `handleToggleSelect` 只更新了 `knowledge_base` 表的 `selected` 字段
3. 但 `handleOrganize` 调用 `getSelectedMaterials(sessionId)` 查询的是 `retrieved_materials` 表的 `is_selected` 字段
4. 两个表的选择状态没有同步，导致查询结果为空

#### 解决方案

##### 1. 添加 API 函数
在 `api.ts` 中添加：

```typescript
// 更新检索资料的选中状态
export async function updateRetrievedMaterialSelection(
  materialId: string,
  isSelected: boolean
): Promise<void> {
  const { error } = await supabase
    .from('retrieved_materials')
    .update({ is_selected: isSelected })
    .eq('id', materialId);

  if (error) {
    console.error('[updateRetrievedMaterialSelection] 更新失败:', error);
    throw error;
  }
  console.log('[updateRetrievedMaterialSelection] 更新成功:', materialId, isSelected);
}

// 批量更新检索资料的选中状态
export async function batchUpdateRetrievedMaterialSelection(
  sessionId: string,
  materialIds: string[],
  isSelected: boolean
): Promise<void> {
  const { error } = await supabase
    .from('retrieved_materials')
    .update({ is_selected: isSelected })
    .eq('session_id', sessionId)
    .in('id', materialIds);

  if (error) {
    console.error('[batchUpdateRetrievedMaterialSelection] 批量更新失败:', error);
    throw error;
  }
  console.log('[batchUpdateRetrievedMaterialSelection] 批量更新成功:', materialIds.length, '条资料');
}
```

##### 2. 更新 handleToggleSelect
```typescript
const handleToggleSelect = async (id: string, selected: boolean) => {
  try {
    // 同时更新 retrieved_materials 表
    await updateRetrievedMaterialSelection(id, selected);
    
    // 更新本地状态
    setRetrievedMaterials(prev => 
      prev.map(m => m.id === id ? { ...m, is_selected: selected } : m)
    );
    
    // 尝试更新 knowledge_base 表（如果存在）
    try {
      await updateKnowledgeBase(id, { selected });
    } catch (kbError) {
      // knowledge_base 中可能还不存在该记录，忽略错误
      console.log('[handleToggleSelect] knowledge_base 更新跳过（记录可能不存在）:', id);
    }
    
    await loadKnowledge();
  } catch (error) {
    console.error('更新选中状态失败:', error);
    toast({
      title: '更新失败',
      description: '请稍后重试',
      variant: 'destructive',
    });
  }
};
```

##### 3. 更新 handleBatchFavorite
```typescript
const handleBatchFavorite = async (ids: string[], selected: boolean) => {
  if (!writingSession) {
    toast({
      title: '会话未初始化',
      description: '请刷新页面重试',
      variant: 'destructive',
    });
    return;
  }
  
  try {
    // 批量更新 retrieved_materials 表
    await batchUpdateRetrievedMaterialSelection(writingSession.id, ids, selected);
    
    // 更新本地状态
    setRetrievedMaterials(prev => 
      prev.map(m => ids.includes(m.id) ? { ...m, is_selected: selected } : m)
    );
    
    // 尝试更新 knowledge_base 表（如果存在）
    for (const id of ids) {
      try {
        await updateKnowledgeBase(id, { selected });
      } catch (kbError) {
        console.log('[handleBatchFavorite] knowledge_base 更新跳过（记录可能不存在）:', id);
      }
    }
    
    await loadKnowledge();
    toast({
      title: '✅ 批量收藏成功',
      description: `已收藏 ${ids.length} 条资料`,
    });
  } catch (error) {
    console.error('批量收藏失败:', error);
    toast({
      title: '❌ 批量收藏失败',
      description: '操作失败，请重试',
      variant: 'destructive',
    });
  }
};
```

#### 关键改进
1. **优先更新 retrieved_materials**：这是 `getSelectedMaterials` 查询的表
2. **同步更新本地状态**：立即更新 `retrievedMaterials` 状态，提供即时反馈
3. **容错处理**：knowledge_base 表中可能还没有记录（用户还没点击"资料整理"），所以用 try-catch 包裹，忽略错误
4. **批量操作优化**：使用 `batchUpdateRetrievedMaterialSelection` 一次性更新多条记录

#### 数据流
```
用户勾选 → handleToggleSelect
           ↓
    1. 更新 retrieved_materials.is_selected (数据库)
           ↓
    2. 更新 retrievedMaterials 状态 (本地)
           ↓
    3. 尝试更新 knowledge_base.selected (数据库，可选)
           ↓
    4. 重新加载 knowledge 显示
           ↓
用户点击"资料整理" → handleOrganize
           ↓
    getSelectedMaterials(sessionId) → 查询 retrieved_materials.is_selected = true
           ↓
    返回选中的资料 ✅
```

#### 第二次修复：优先从数据库加载资料

**问题**：
即使添加了同步逻辑，用户刷新页面后，资料是从 localStorage 缓存加载的，而不是从数据库加载。这导致：
1. 缓存中的资料可能没有最新的 `is_selected` 状态
2. 用户勾选后刷新页面，选择状态丢失
3. 缓存和数据库状态不一致

**解决方案**：
修改 `initSession` 中的加载逻辑，优先从数据库加载资料：

```typescript
// 1. 首先尝试从数据库加载检索资料
const dbMaterials = await getRetrievedMaterials(session.id);

if (dbMaterials.length > 0) {
  // 使用数据库的数据（包含最新的 is_selected 状态）
  setRetrievedMaterials(dbMaterials);
  
  // 转换为 knowledge 格式
  const knowledgeItems = dbMaterials.map(material => ({...}));
  setKnowledge(knowledgeItems);
  
  // 从缓存加载其他信息（搜索计划、日志等）
  const cached = loadSearchCache(projectId);
  if (cached) {
    setSearchPlan(cached.searchPlan);
    setSearchLogs(cached.searchLogs || []);
    setLastSearchTime(cached.lastSearchTime || '');
    setQuery(cached.query || '');
  }
} else {
  // 如果数据库中没有资料，才从缓存加载
  const cached = loadSearchCache(projectId);
  if (cached && cached.retrievedMaterials) {
    setRetrievedMaterials(cached.retrievedMaterials);
    // ...
  }
}
```

**关键改进**：
1. **数据库优先**：始终优先从数据库加载资料，确保获取最新的 `is_selected` 状态
2. **缓存辅助**：缓存只用于加载搜索计划、日志等辅助信息
3. **状态一致性**：数据库是唯一的真实数据源，避免缓存和数据库不一致
4. **详细日志**：添加详细的 console.log，方便调试数据加载流程

**新的数据流**：
```
页面加载 → initSession
           ↓
    1. 创建/获取 writingSession
           ↓
    2. 从数据库加载 retrieved_materials (包含 is_selected 状态)
           ↓
    3. 设置 retrievedMaterials 和 knowledge 状态
           ↓
    4. 从缓存加载搜索计划和日志（辅助信息）
           ↓
用户看到的资料列表 ✅ (包含正确的选择状态)
```

#### 调试日志

为了方便调试，添加了详细的日志：

**handleToggleSelect**:
```typescript
console.log('[handleToggleSelect] 开始更新选中状态:', { id, selected });
console.log('[handleToggleSelect] 更新 retrieved_materials 表');
console.log('[handleToggleSelect] retrieved_materials 表更新成功');
console.log('[handleToggleSelect] 本地状态已更新，选中数量:', count);
console.log('[handleToggleSelect] knowledge_base 表更新成功');
console.log('[handleToggleSelect] 完成');
```

**handleOrganize**:
```typescript
console.log('[handleOrganize] 开始资料整理');
console.log('[handleOrganize] writingSession:', writingSession);
console.log('[handleOrganize] knowledge.length:', knowledge.length);
console.log('[handleOrganize] retrievedMaterials.length:', retrievedMaterials.length);
console.log('[handleOrganize] retrievedMaterials 选中数量:', count);
console.log('[handleOrganize] 调用 getSelectedMaterials，sessionId:', sessionId);
console.log('[handleOrganize] getSelectedMaterials 返回结果:', selectedMaterials);
console.log('[handleOrganize] 选中资料数量:', selectedMaterials.length);
```

**initSession**:
```typescript
console.log('[initSession] 尝试从数据库加载检索资料，sessionId:', session.id);
console.log('[initSession] 从数据库加载的资料数量:', dbMaterials.length);
console.log('[initSession] 使用数据库中的资料');
console.log('[initSession] 从缓存加载搜索计划和日志');
```

这些日志可以帮助我们追踪：
1. 资料是从哪里加载的（数据库 vs 缓存）
2. 选择状态是否正确更新
3. getSelectedMaterials 返回了多少条资料
4. 每个步骤的执行顺序和结果

### 5. 修改资料整理流程为自动处理所有资料

#### 问题描述
用户希望 Research Synthesis Agent 自动处理所有搜索结果，而不需要手动选择资料。

#### 解决方案

##### 1. 修改 handleOrganize 函数
将 `getSelectedMaterials` 改为 `getRetrievedMaterials`，处理所有检索到的资料：

```typescript
// 1. 获取所有检索到的资料（不再只获取选中的资料）
console.log('[handleOrganize] 调用 getRetrievedMaterials，sessionId:', writingSession.id);
setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 正在获取检索到的资料...']);
const allMaterials = await getRetrievedMaterials(writingSession.id);
console.log('[handleOrganize] getRetrievedMaterials 返回结果:', allMaterials);
console.log('[handleOrganize] 资料总数:', allMaterials.length);

if (allMaterials.length === 0) {
  console.error('[handleOrganize] 没有可用的资料');
  toast({
    title: '暂无资料',
    description: '请先进行资料搜索',
    variant: 'destructive',
  });
  setSynthesizing(false);
  return;
}

setSynthesisLogs(prev => [...prev, '[' + new Date().toLocaleTimeString('zh-CN') + '] 共 ' + allMaterials.length + ' 条资料待整理']);
```

##### 2. 更新验证逻辑
- 移除"至少选择一条资料"的验证
- 改为检查是否有任何检索到的资料
- 使用 `retrievedMaterials.length` 而非 `knowledge.length` 进行验证

##### 3. 更新 UI 提示文本
```typescript
{researchStageComplete ? (
  <span className="text-green-600 font-medium flex items-center gap-2">
    <CheckCircle2 className="h-4 w-4" />
    研究阶段已完成，可以进入下一阶段
  </span>
) : retrievedMaterials.length > 0 ? (
  <span>
    点击"资料整理"将自动整理所有搜索结果
  </span>
) : (
  <span>
    请先进行资料搜索
  </span>
)}
```

##### 4. 更新搜索完成提示
```typescript
toast({
  title: '✅ 资料检索完成',
  description: `已检索到 ${loadedMaterials.length} 条资料，可以开始资料整理`,
});
```

#### 新的工作流程
```
用户搜索 → 资料检索完成
           ↓
    显示所有搜索结果（无需选择）
           ↓
用户点击"资料整理" → handleOrganize
           ↓
    getRetrievedMaterials(sessionId) → 获取所有资料
           ↓
    保存所有资料到 knowledge_base
           ↓
    调用 Research Synthesis Agent
           ↓
    生成研究洞察和空白
           ↓
    显示审阅界面 ✅
```

#### 关键改进
1. **自动处理**：无需用户手动选择，自动处理所有搜索结果
2. **简化流程**：减少用户操作步骤，提升效率
3. **保留复选框**：复选框功能保留，供未来扩展使用（如删除、标记等）
4. **清晰提示**：UI 提示明确告知用户将处理所有资料

#### 用户体验
- 搜索完成后，用户可以直接点击"资料整理"
- 系统自动处理所有搜索结果
- 无需手动勾选资料
- 流程更加流畅和高效

## 用户体验改进

### 1. 日志详情
- 用户可以点击底部日志栏查看详细的资料整理日志
- 日志包含每个步骤的时间戳和状态
- 错误信息更加详细，包含错误类型、堆栈和时间戳

### 2. 缓存机制
- 搜索结果自动保存到 localStorage
- 下次进入页面时自动加载缓存
- 点击"刷新"按钮清除缓存并重新搜索
- 避免重复搜索，提升用户体验

### 3. 简化流程
- 移除了中间的资料选择确认步骤
- 用户可以直接在搜索结果中选择资料
- 选择后直接点击"资料整理"即可
- 减少了操作步骤，提升效率

## 相关文件
- `/supabase/functions/research-synthesis-agent/index.ts` - Edge Function 错误日志增强
- `/src/db/api.ts` - API 错误处理增强
- `/src/components/workflow/KnowledgeStage.tsx` - 主要逻辑修改
- `/src/components/workflow/SearchLogsDialog.tsx` - 日志显示增强
