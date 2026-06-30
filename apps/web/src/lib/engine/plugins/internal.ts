import { uuidv7 } from "uuidv7";
import type { ChannelPlugin, MessageReceipt } from "../types";

/**
 * Spec 001 T2 — the native internal channel plugin.
 *
 * `yappchat-internal` is the in-process platform for YappChatt-to-YappChatt and
 * agent messages. There is no external API: "delivery" is immediate and the
 * receipt carries a synthetic platform message id. External platform plugins
 * (Slack/Discord/etc.) implement this same contract in extensions/ (not in this
 * repo yet) and are loaded by platformid through the registry.
 */
export const INTERNAL_PLATFORM_ID = "yappchat-internal";

export const internalPlugin: ChannelPlugin = {
  platformid: INTERNAL_PLATFORM_ID,
  async startAccount() {
    /* in-process — nothing to connect */
  },
  async stopAccount() {
    /* in-process — nothing to disconnect */
  },
  async send(): Promise<MessageReceipt> {
    return {
      primaryPlatformMessageId: `int_${uuidv7()}`,
      platformMessageIds: [`int_${uuidv7()}`],
      sentAt: new Date(),
    };
  },
};
