/** Bound the full response, including reading the body, so panels always recover. */
export async function fetchRemoteJson<T>(input: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<{ response: Response; body: T }> {
  const controller = new AbortController();
  const cancel = () => controller.abort(init.signal?.reason);
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener("abort", cancel, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(new DOMException("Request timed out", "TimeoutError")), timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const body = await response.json() as T;
    return { response, body };
  } finally {
    globalThis.clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancel);
  }
}
