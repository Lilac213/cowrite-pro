# 配置 Supabase CLI 环境变量

## 快速设置（复制粘贴即可）

打开终端，执行以下命令：

```bash
# 1. 将 Homebrew 路径添加到 .zshrc
echo 'export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"' >> ~/.zshrc

# 2. 立即生效
source ~/.zshrc

# 3. 验证
which supabase
supabase --version
```

## 或者手动编辑

1. 打开 `.zshrc` 文件：
```bash
open ~/.zshrc
```

2. 在文件开头添加以下内容：
```bash
# Homebrew
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"
```

3. 保存并关闭文件

4. 重新加载配置：
```bash
source ~/.zshrc
```

5. 验证安装：
```bash
supabase --version
```

## 下一步

配置好环境变量后，就可以开始部署函数了：

```bash
# 登录
supabase login

# 链接项目
supabase link --project-ref YOUR_PROJECT_REF

# 部署函数
supabase functions deploy research-retrieval-agent
supabase functions deploy research-retrieval-streaming
```
