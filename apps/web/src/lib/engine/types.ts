import type { ChannelRow, ConversationRow } from "../db/engine-schema";
import type { Attachment } from "../storage/s3";

/**
 * Spec 001 T2 — the engine's normalized contracts. These mirror the
 * ChannelPlugin / ChannelGatewayAdapter shapes (sendDurableMessageBatch,
 * MessageReceiveContext, MessageReceipt) so every platform plugin and every
 * caller speaks one Message type — no module touches a platform SDK directly.
 */

/** A normalized message as the rest of YappChatt sees it. */
export type NormalizedMessage = {
  id: string;
  channelid: string;
  conversationid: string | null;
  authorid: string;
  /** Account display name (spec 011), or the email local-part fallback; null if the author isn't a known user. */
  authorname: string | null;
  /** Attachments (presigned URL + filename + isImage), stored privately on S3 as keys. */
  media: Attachment[];
  content: string | null;
  messagetype: "chat" | "status";
  direction: "inbound" | "outbound";
  ackstate: "pending" | "acked" | "nacked";
  createdat: string;
};

/** Returned by a plugin's send(): the platform's own message id(s). */
export type MessageReceipt = {
  primaryPlatformMessageId: string;
  platformMessageIds: string[];
  sentAt: Date;
};

/** Context handed to a plugin to send one outbound text message. */
export type SendContext = {
  channel: ChannelRow;
  conversation: ConversationRow | null;
  authorid: string;
  content: string;
};

/**
 * A ChannelPlugin is the only thing that knows a specific platform. The engine
 * loads plugins by platformid and never imports platform code directly (FR-001).
 */
export interface ChannelPlugin {
  readonly platformid: string;
  /** Connect/refresh the account; throw to signal failure (account -> degraded). */
  startAccount(channel: ChannelRow): Promise<void>;
  stopAccount(channel: ChannelRow): Promise<void>;
  /** Deliver one outbound message; return the platform receipt. */
  send(ctx: SendContext): Promise<MessageReceipt>;
}
