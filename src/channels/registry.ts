/**
 * YappChat channel registry — maps channel IDs to their extension metadata.
 * Channels are loaded lazily; import the specific extension to use its client.
 */

export type ChannelMeta = {
  id: string;
  label: string;
  extensionPath: string;
  envVars: string[];
};

export const CHANNEL_REGISTRY: ChannelMeta[] = [
  {
    id: "slack",
    label: "Slack",
    extensionPath: "../../extensions/slack/index.ts",
    envVars: ["SLACK_APP_TOKEN", "SLACK_BOT_TOKEN", "SLACK_USER_TOKEN"],
  },
  {
    id: "discord",
    label: "Discord",
    extensionPath: "../../extensions/discord/index.ts",
    envVars: ["DISCORD_BOT_TOKEN"],
  },
  {
    id: "telegram",
    label: "Telegram",
    extensionPath: "../../extensions/telegram/index.ts",
    envVars: ["TELEGRAM_BOT_TOKEN"],
  },
  {
    id: "matrix",
    label: "Matrix",
    extensionPath: "../../extensions/matrix/index.ts",
    envVars: ["MATRIX_ACCESS_TOKEN", "MATRIX_HOMESERVER"],
  },
  {
    id: "mattermost",
    label: "Mattermost",
    extensionPath: "../../extensions/mattermost/index.ts",
    envVars: ["MATTERMOST_TOKEN", "MATTERMOST_URL"],
  },
  {
    id: "irc",
    label: "IRC",
    extensionPath: "../../extensions/irc/index.ts",
    envVars: ["IRC_HOST", "IRC_NICK"],
  },
  {
    id: "signal",
    label: "Signal",
    extensionPath: "../../extensions/signal/index.ts",
    envVars: ["SIGNAL_CLI_URL"],
  },
  {
    id: "msteams",
    label: "Microsoft Teams",
    extensionPath: "../../extensions/msteams/index.ts",
    envVars: ["TEAMS_APP_ID", "TEAMS_APP_PASSWORD"],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    extensionPath: "../../extensions/whatsapp/index.ts",
    envVars: [],
  },
  {
    id: "feishu",
    label: "Feishu / Lark",
    extensionPath: "../../extensions/feishu/index.ts",
    envVars: ["FEISHU_APP_ID", "FEISHU_APP_SECRET"],
  },
  {
    id: "googlechat",
    label: "Google Chat",
    extensionPath: "../../extensions/googlechat/index.ts",
    envVars: ["GOOGLE_CHAT_SERVICE_ACCOUNT"],
  },
  {
    id: "synology-chat",
    label: "Synology Chat",
    extensionPath: "../../extensions/synology-chat/index.ts",
    envVars: ["SYNOLOGY_CHAT_WEBHOOK_URL"],
  },
  {
    id: "line",
    label: "LINE",
    extensionPath: "../../extensions/line/index.ts",
    envVars: ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"],
  },
  {
    id: "twitch",
    label: "Twitch",
    extensionPath: "../../extensions/twitch/index.ts",
    envVars: ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET", "TWITCH_ACCESS_TOKEN"],
  },
  {
    id: "imessage",
    label: "iMessage",
    extensionPath: "../../extensions/imessage/index.ts",
    envVars: [],
  },
  {
    id: "nextcloud-talk",
    label: "Nextcloud Talk",
    extensionPath: "../../extensions/nextcloud-talk/index.ts",
    envVars: ["NEXTCLOUD_URL", "NEXTCLOUD_TOKEN"],
  },
  {
    id: "tlon",
    label: "Tlon (Urbit)",
    extensionPath: "../../extensions/tlon/index.ts",
    envVars: ["TLON_SHIP_URL", "TLON_SHIP_CODE"],
  },
  {
    id: "qqbot",
    label: "QQ Bot",
    extensionPath: "../../extensions/qqbot/index.ts",
    envVars: ["QQBOT_APP_ID", "QQBOT_TOKEN"],
  },
  {
    id: "nostr",
    label: "Nostr",
    extensionPath: "../../extensions/nostr/index.ts",
    envVars: ["NOSTR_PRIVATE_KEY"],
  },
  {
    id: "zalo",
    label: "Zalo",
    extensionPath: "../../extensions/zalo/index.ts",
    envVars: ["ZALO_OA_TOKEN"],
  },
  {
    id: "zalouser",
    label: "Zalo User",
    extensionPath: "../../extensions/zalouser/index.ts",
    envVars: ["ZALO_USER_TOKEN"],
  },
  {
    id: "voice-call",
    label: "Voice Call (Twilio)",
    extensionPath: "../../extensions/voice-call/index.ts",
    envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  },
  {
    id: "webhooks",
    label: "Webhooks",
    extensionPath: "../../extensions/webhooks/index.ts",
    envVars: ["WEBHOOK_SECRET"],
  },
];

export function getChannel(id: string): ChannelMeta | undefined {
  return CHANNEL_REGISTRY.find((c) => c.id === id);
}

export function getConfiguredChannels(): ChannelMeta[] {
  return CHANNEL_REGISTRY.filter((ch) =>
    ch.envVars.length === 0 || ch.envVars.some((v) => process.env[v]),
  );
}
