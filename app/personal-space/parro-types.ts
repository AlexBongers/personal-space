export type ParroMessageKind = "announcement" | "chatroom";

export type ParroMessage = {
  id: string;
  kind: ParroMessageKind;
  title: string;
  body: string;
  sender: string;
  roomName: string;
  publishedAt: string;
  unread: boolean;
  unreadCount: number;
  externalUrl: string;
  attachmentCount: number;
  attachmentNames: string[];
};

export type ParroMessagesResponse = {
  state: "connected" | "empty" | "unavailable" | "unconfigured" | "sign_in_required";
  messages: ParroMessage[];
  syncedAt?: string;
  unread?: number;
  error?: string;
};
