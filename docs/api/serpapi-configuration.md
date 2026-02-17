# SerpAPI 配置说明

## 用途
用于 Scholar / News / Web 搜索。

## 配置方式
### 方式一：环境变量（推荐）
```
SERPAPI_API_KEY=your_key
```

### 方式二：管理面板写入数据库
在管理面板保存搜索密钥后，会写入 `system_config.search_api_key`，API Server 会自动读取。

## 接口
- `/api/serpapi-search`：多引擎/单引擎聚合搜索
- `/api/web-search`：简化 Web 搜索入口

## 常见错误
- `SERPAPI_API_KEY 未配置`：环境变量与数据库均无密钥
- `Your account has run out of searches`：额度已耗尽
