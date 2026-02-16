# Embedding Service

本地 Embedding 服务，使用 bge-base-zh-v1.5 模型。

## 快速启动

### 方式1: Python直接运行

```bash
pip install -r requirements.txt
python main.py
```

### 方式2: Docker

```bash
docker build -t embedding-service .
docker run -p 8000:8000 embedding-service
```

## API

### 健康检查
```bash
curl http://localhost:8000/health
```

### 生成Embedding
```bash
curl -X POST http://localhost:8000/embeddings \
  -H "Content-Type: application/json" \
  -d '{"texts": ["这是一段测试文本"]}'
```

## 响应格式

```json
{
  "embeddings": [[0.1, 0.2, ...]]
}
```
