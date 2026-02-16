# Embedding服务部署指南

## 快速部署

### 1. 安装依赖
```bash
cd embedding-service
pip3 install -r requirements.txt
```

### 2. 启动服务
```bash
python3 main.py
```

服务将在 http://localhost:8000 启动

### 3. 测试服务
```bash
# 安装测试依赖
pip3 install -r test-requirements.txt

# 运行测试
python3 test.py
```

## Docker部署（推荐）

```bash
cd embedding-service
docker build -t embedding-service .
docker run -d -p 8000:8000 --name embedding embedding-service
```

## API使用示例

### 健康检查
```bash
curl http://localhost:8000/health
```

### 生成Embedding
```bash
curl -X POST http://localhost:8000/embeddings \
  -H "Content-Type: application/json" \
  -d '{"texts": ["测试文本1", "测试文本2"]}'
```

## 集成到项目

在Edge Function中调用：
```typescript
const response = await fetch('http://embedding-service:8000/embeddings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ texts: ['文本内容'] })
});
const { embeddings } = await response.json();
```

## 注意事项

1. 首次启动会自动下载 bge-base-zh-v1.5 模型（约500MB）
2. 建议使用Docker部署以保证环境一致性
3. 生产环境建议配置反向代理和负载均衡
