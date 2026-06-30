import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { channels, type ChannelRow } from "../db/engine-schema";
import { internalPlugin } from "./plugins/internal";
import type { ChannelPlugin, MessageReceipt, SendContext } from "./types";

/**
 * Spec 001 T2 — plugin registry + ChannelGatewayAdapter facade (FR-001).
 *
 * The engine resolves a ChannelPlugin by platformid and manages account
 * lifecycle through it. Only the internal plugin is registered in this repo;
 * the 23 external platform plugins register here once extensions/ is present.
 */
const registry = new Map<string, ChannelPlugin>();

export function registerPlugin(plugin: ChannelPlugin): void {
  registry.set(plugin.platformid, plugin);
}

export function getPlugin(platformid: string): ChannelPlugin | undefined {
  return registry.get(platformid);
}

// Built-in: the native internal channel.
registerPlugin(internalPlugin);

export class UnknownPlatformError extends Error {
  constructor(public platformid: string) {
    super(`unknown_platform:${platformid}`);
    this.name = "UnknownPlatformError";
  }
}

/** Start a channel's account; mark healthy/offline on the channels row. */
export async function startAccount(channel: ChannelRow): Promise<void> {
  const plugin = getPlugin(channel.platformid);
  if (!plugin) throw new UnknownPlatformError(channel.platformid);
  const db = getDb();
  try {
    await plugin.startAccount(channel);
    if (db) {
      await db
        .update(channels)
        .set({ status: "healthy", lastseenat: new Date() })
        .where(eq(channels.id, channel.id));
    }
  } catch (err) {
    if (db) await db.update(channels).set({ status: "degraded" }).where(eq(channels.id, channel.id));
    throw err;
  }
}

export async function stopAccount(channel: ChannelRow): Promise<void> {
  const plugin = getPlugin(channel.platformid);
  if (!plugin) return;
  await plugin.stopAccount(channel);
  const db = getDb();
  if (db) await db.update(channels).set({ status: "offline" }).where(eq(channels.id, channel.id));
}

/** Send one outbound message through the channel's plugin. */
export async function sendViaPlugin(ctx: SendContext): Promise<MessageReceipt> {
  const plugin = getPlugin(ctx.channel.platformid);
  if (!plugin) throw new UnknownPlatformError(ctx.channel.platformid);
  return plugin.send(ctx);
}
