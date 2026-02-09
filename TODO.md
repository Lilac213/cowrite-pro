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
