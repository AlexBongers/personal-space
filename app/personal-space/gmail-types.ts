export type GmailMessage = {
  id: string; threadId: string; subject: string; sender: string; snippet: string;
  receivedAt: string; unread: boolean; url: string;
};
export type GmailState = "connected" | "connect" | "permission_required" | "api_disabled" | "unavailable" | "unconfigured" | "sign_in_required";
export type GmailInboxResponse = {
  state: GmailState; messages: GmailMessage[]; emailAddress?: string;
  total?: number; unread?: number; nextPageToken?: string; fetchedAt?: string;
};
