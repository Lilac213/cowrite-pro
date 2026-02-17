import { supabase } from '@/db/supabase';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const apiBaseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/$/, '') : '';

function buildUrl(path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return apiBaseUrl ? `${apiBaseUrl}${normalized}` : normalized;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  auth = false
) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && options.body !== null;
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (auth) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers
  });

  return response;
}

export async function apiJson<T = any>(
  path: string,
  body?: any,
  auth = false,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(
    path,
    {
      method: body === undefined ? 'GET' : 'POST',
      ...options,
      body: body === undefined ? undefined : JSON.stringify(body)
    },
    auth
  );

  if (!response.ok) {
    const errorText = await response.text();
    let message = errorText || response.statusText;
    try {
      const parsed = JSON.parse(errorText);
      if (parsed?.error) {
        message = parsed.error;
        if (parsed.details) {
          message = `${message}: ${parsed.details}`;
        }
      }
    } catch {
      message = errorText || response.statusText;
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function apiSSE<T = any>(
  path: string,
  body: any,
  auth = false
): Promise<T> {
  const response = await apiFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body)
    },
    auth
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }

  if (!response.body) {
    throw new Error('响应体为空');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalData: any = null;
  let lastEvent: any = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';

    for (const part of parts) {
      const lines = part.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const jsonText = line.replace(/^data:\s*/, '').trim();
        if (!jsonText) continue;
        const event = JSON.parse(jsonText);
        lastEvent = event;
        if (event.stage === 'error') {
          throw new Error(event.message || '请求失败');
        }
        if (event.stage === 'final') {
          finalData = event.data;
        }
      }
    }
  }

  if (finalData !== null) {
    return finalData as T;
  }

  if (lastEvent?.data) {
    return lastEvent.data as T;
  }

  throw new Error('未收到有效响应');
}
