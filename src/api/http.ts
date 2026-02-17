import { supabase } from '@/db/supabase';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const inferredBaseUrl = typeof window !== 'undefined' && window.location.hostname.endsWith('cowrite.top')
  ? 'https://api.cowrite.top'
  : '';
const apiBaseUrl = (rawBaseUrl || inferredBaseUrl).replace(/\/$/, '');

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

  const url = buildUrl(path);
  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    return response;
  } catch (error) {
    console.error('API 请求失败:', {
      url,
      method: options.method || (options.body === undefined ? 'GET' : 'POST'),
      hasBody: options.body !== undefined && options.body !== null
    }, error);
    throw error;
  }
}

function buildErrorMessage(
  response: Response,
  errorText: string,
  parsed: any
) {
  const isSameOrigin =
    typeof window !== 'undefined' &&
    response.url.startsWith(window.location.origin);

  if (response.status === 405 && !apiBaseUrl && isSameOrigin) {
    return '当前未配置 VITE_API_BASE_URL，请将请求指向自建 API 服务';
  }

  if (parsed?.error) {
    if (parsed.details) {
      return `${parsed.error}: ${parsed.details}`;
    }
    return parsed.error as string;
  }

  if (errorText) {
    return errorText;
  }

  return `请求失败: ${response.status} ${response.statusText}`.trim();
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
    let parsed: any = null;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = null;
    }
    const message = buildErrorMessage(response, errorText, parsed);
    console.error('API 响应错误:', {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      message,
      body: parsed ?? errorText
    });
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
    let parsed: any = null;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = null;
    }
    const message = buildErrorMessage(response, errorText, parsed);
    console.error('API SSE 响应错误:', {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      message,
      body: parsed ?? errorText
    });
    throw new Error(message);
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
