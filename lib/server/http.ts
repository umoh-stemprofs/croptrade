// Server-only HTTP helper for external calls (00-global §3: "Timeout 5 s, one retry").
// Never import this from client components.

export type FetchLike = typeof fetch;

export interface FetchJsonOptions {
  /** Hard timeout per attempt. Default 5 s. */
  timeoutMs?: number;
  /** Extra attempts after the first. Default 1 (= 2 attempts total). */
  retries?: number;
  fetchImpl?: FetchLike;
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const { timeoutMs = 5_000, retries = 1, fetchImpl = fetch } = opts;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Request failed with HTTP ${res.status}.`);
      return (await res.json()) as T;
    } catch (e) {
      lastError = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network request failed.");
}
