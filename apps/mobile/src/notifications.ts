import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { chats } from "@/api/client";

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
    void requestNotificationPermission();

    const poll = async () => {
      try {
        const d = await chats.list();
        if (cancelled) return;
        const unread = d.unread ?? {};
        const names = new Map(d.chats.map((c) => [c.conversationid, c.name]));
        if (baseline.current) {
          for (const [cid, n] of Object.entries(unread)) {
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
