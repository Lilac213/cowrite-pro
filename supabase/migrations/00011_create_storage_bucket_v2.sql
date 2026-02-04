
-- 创建存储桶用于文件上传
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cowrite-files',
  'cowrite-files',
  true,
  5242880, -- 5MB
  ARRAY['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- 删除可能存在的旧策略
DROP POLICY IF EXISTS "认证用户可以上传文件" ON storage.objects;
DROP POLICY IF EXISTS "用户可以查看自己的文件" ON storage.objects;
DROP POLICY IF EXISTS "所有人可以查看公开文件" ON storage.objects;
DROP POLICY IF EXISTS "用户可以删除自己的文件" ON storage.objects;

-- 创建存储策略：允许认证用户上传文件
CREATE POLICY "认证用户可以上传文件"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'cowrite-files');

-- 创建存储策略：允许认证用户查看自己的文件
CREATE POLICY "用户可以查看自己的文件"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'cowrite-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 创建存储策略：允许所有人查看公开文件
CREATE POLICY "所有人可以查看公开文件"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'cowrite-files');

-- 创建存储策略：允许用户删除自己的文件
CREATE POLICY "用户可以删除自己的文件"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'cowrite-files' AND auth.uid()::text = (storage.foldername(name))[1]);
