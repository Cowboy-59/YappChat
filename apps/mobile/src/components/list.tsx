import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

/** Circular avatar with an initial fallback (no image source in v1). */
export function Avatar({ name }: { name: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{(name || "?").slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

/** A single list row: leading element, title, subtitle, optional unread badge. */
export function Row({
  left,
  title,
  subtitle,
  badge,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  badge?: number;
}) {
  return (
    <View style={styles.row}>
      {left}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

export const screenStyles = StyleSheet.create({
  list: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8eaed",
    gap: 12,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: "600", color: "#111" },
  rowSubtitle: { fontSize: 13, color: "#80868b", marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#4F46E5", fontWeight: "700", fontSize: 18 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4F46E5",
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 64, paddingHorizontal: 24 },
  emptyText: { color: "#80868b", fontSize: 15, textAlign: "center" },
});
