export { CHANNEL_REGISTRY, getChannel, getConfiguredChannels } from "./registry.js";
export type { ChannelMeta } from "./registry.js";

// Direct client re-exports for the most common channels.
// For other channels, import from their extension directly:
//   import { createSlackWebClient } from "@yappchat/ext-slack";
export { createSlackWebClient, getSlackWriteClient } from "../../extensions/slack/src/client.js";
