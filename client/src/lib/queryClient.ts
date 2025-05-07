import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// パフォーマンス最適化: カスタムヘッダー対応、タイムアウト設定可能
export type ApiRequestOptions = {
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
};

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: ApiRequestOptions,
): Promise<Response> {
  // 基本ヘッダーを設定
  const headers: Record<string, string> = {
    ...(data ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers || {})  // 追加のヘッダーをマージ
  };

  // タイムアウト処理
  let timeoutId: NodeJS.Timeout | null = null;
  let abortController: AbortController | null = null;
  
  if (options?.timeout && options.timeout > 0 && !options.signal) {
    abortController = new AbortController();
    timeoutId = setTimeout(() => abortController?.abort(), options.timeout);
  }

  try {
    // リクエストの実行
    const res = await fetch(url, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
      signal: options?.signal || abortController?.signal,
    });

    await throwIfResNotOk(res);
    return res;
  } finally {
    // タイムアウトのクリア
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// パフォーマンス最適化されたQueryClient
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,  // ウィンドウフォーカス時に自動再取得
      staleTime: 1000 * 60 * 5,    // 5分間はキャッシュを新鮮と見なす
      gcTime: 1000 * 60 * 30,      // 30分間キャッシュを保持
      retry: (failureCount, error) => {
        // ネットワークエラーのみ再試行し、401/403/404/500などのサーバーエラーは再試行しない
        return failureCount < 2 && !(error instanceof Error && 'status' in error);
      }
    },
    mutations: {
      retry: false,                // ミューテーションは再試行しない
      onSuccess: () => {
        // バックグラウンドで特定のデータをプリフェッチするオプション
        // queryClient.prefetchQuery(...) を呼び出すことも可能
      }
    },
  },
});
