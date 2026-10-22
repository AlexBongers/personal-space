export type ParroConnectResponse = { ok?: boolean; connectionSaved?: boolean; state?: string; needsSignIn?: boolean; error?: unknown };

type ParroConnectOutcome =
  | { connected: true; syncError: string | null }
  | { connected: false; error: string };

const responseMessage = (result: ParroConnectResponse) =>
  typeof result.error === "string" && result.error.trim() ? result.error : null;

export function parroConnectOutcome(
  responseOk: boolean,
  result: ParroConnectResponse,
  connectFallback: string,
  syncFallback: string,
): ParroConnectOutcome {
  const message = responseMessage(result);
  // Saved tokens can belong to an older login; authentication rejection always wins.
  if (result.state === "sign_in_required" || result.needsSignIn) {
    return { connected: false, error: message ?? connectFallback };
  }
  if (result.connectionSaved) {
    return { connected: true, syncError: message ?? (responseOk && result.ok ? null : syncFallback) };
  }
  if (!responseOk || !result.ok) return { connected: false, error: message ?? connectFallback };
  return { connected: true, syncError: null };
}
