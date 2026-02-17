# 通义千问 API 快速配置

## 适用场景
当 Gemini 不可用时，系统会回退使用 Qwen。配置 `QIANWEN_API_KEY` 后回退才能生效。

## 获取 API Key
1. 访问 https://dashscope.console.aliyun.com/
2. 登录后进入 API-KEY 管理
3. 创建并复制 API Key

## 配置方式
在自建 API 服务环境变量中设置：
```bash
export QIANWEN_API_KEY="your_key"
```

也可使用 `QWEN_API_KEY`，但推荐使用 `QIANWEN_API_KEY`。

## 验证
当 Gemini 调用失败时，日志会显示 Qwen 的请求结果。
