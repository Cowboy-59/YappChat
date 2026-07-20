import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { api, chats, nav } from "@/api/client";

/**
 * Message notifications (spec 008 / spec 009 seam).
 *
 * v1 scope: **local notifications while the app is running.** A lightweight poll of
 * /api/chats detects when a conversation's unread count rises and presents a local
 * notification. This works in Expo Go and in a foreground/recently-backgrounded app.
 *
 * TRUE background/closed push (delivered by APNs/FCM when the app isn't running)
 * requires a custom dev build + server-side push (spec 009) — it cannot work in
 * Expo Go. This module is the client seam that spec 009 plugs a push token into.
 */

// Show a banner + play a sound even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = "messages";

// The conversation currently open on screen — we never notify for it (you're
// already reading it). Set by ChatScreen on focus, cleared on blur.
let activeConversationId: string | null = null;
export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Messages",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Ask for notification permission (idempotent). Returns whether it's granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

// The Expo push token registered for this device this session (for unregister).
let pushToken: string | null = null;

/**
 * Register this device's Expo push token with the server so the backend can push
 * even when the app is closed (spec 009). No-op in Expo Go / without credentials —
 * getExpoPushTokenAsync throws there, so real background push needs a dev/prod build.
 */
export async function registerForPush(): Promise<void> {
  try {
    if (!(await requestNotificationPermission())) return;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    pushToken = data;
    await api.post("/api/mobile/push/register", { token: data, platform: Platform.OS });
  } catch {
    /* Expo Go (no remote push) or missing push credentials — silently skip. */
  }
}

/** Remove this device's push token on sign-out. */
export async function unregisterPush(): Promise<void> {
  try {
    if (pushToken) await api.del(`/api/mobile/push/register?token=${encodeURIComponent(pushToken)}`);
  } catch {
    /* ignore */
  }
  pushToken = null;
}

/** Present an immediate local notification for a new message. */
export async function presentMessageNotification(title: string, body: string): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null, // deliver now
  });
}

/**
 * While `enabled` (i.e. signed in), poll the chat list and fire a local notification
 * whenever a conversation's unread count increases. Seeds a baseline on the first
 * poll so existing unread messages don't notify on launch.
 */
export function useNewMessageNotifier(enabled: boolean): void {
  const baseline = useRef<Record<string, number> | null>(null);

  useEffect(() => {
    if (!enabled) {
      baseline.current = null;
      return;
    }
    let cancelled = false;
    // Request permission + register this device's push token for background push.
    void registerForPush();

    const poll = async () => {
      try {
        // Watch both direct/group chats and community spaces so foreground local
        // notifications fire for every conversation kind (background push is handled
        // server-side by the message-send fanout, spec 009).
        const [d, n] = await Promise.all([chats.list(), nav.list().catch(() => ({ communities: [] }))]);
        if (cancelled) return;
        const unread: Record<string, number> = { ...(d.unread ?? {}) };
        const names = new Map<string, string>(d.chats.map((c) => [c.conversationid, c.name]));
        for (const community of n.communities ?? []) {
          for (const space of community.spaces) {
            unread[space.conversationid] = space.unread;
            names.set(space.conversationid, space.name);
          }
        }
        if (baseline.current) {
          for (const [cid, n] of Object.entries(unread)) {
            // Skip the chat you're currently viewing — no ping while you read it.
            if (cid === activeConversationId) continue;
            if (n > (baseline.current[cid] ?? 0)) {
              await presentMessageNotification(names.get(cid) ?? "New message", "You have a new message");
            }
          }
        }
        baseline.current = unread;
      } catch {
        /* transient network error — try again next tick */
      }
    };

    void poll();
    const t = setInterval(() => void poll(), 15000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [enabled]);
}
