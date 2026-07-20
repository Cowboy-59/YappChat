import { useCallback, useState } from "react";
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { nav as navApi, type CommunitySpace } from "@/api/client";
import type { RootStackParamList } from "@/navigation/types";
import { Avatar, EmptyState, Row, screenStyles } from "@/components/list";

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Section = { title: string; data: CommunitySpace[] };

/**
 * Communities the caller belongs to, each rendered as a section of its spaces
 * (from /api/nav). Tapping a space opens its conversation — the ChatScreen handles
 * any conversation id, so no special-casing is needed here.
 */
export function CommunitiesScreen() {
  const navigation = useNavigation<Nav>();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await navApi.list();
      setSections((d.communities ?? []).map((c) => ({ title: c.name, data: c.spaces })));
      setError(null);
    } catch {
      setError("Couldn't load communities.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openSpace = (s: CommunitySpace) =>
    navigation.navigate("Chat", { conversationid: s.conversationid, title: s.name });

  if (loading) {
    return (
      <View style={screenStyles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SectionList
      style={screenStyles.list}
      sections={sections}
      keyExtractor={(s) => s.conversationid}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      ListEmptyComponent={<EmptyState message={error ?? "You're not in any communities yet."} />}
      renderSectionHeader={({ section }) => <Text style={styles.header}>{section.title}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => openSpace(item)} activeOpacity={0.6}>
          <Row left={<Avatar name={item.name} />} title={item.name} subtitle="Space" badge={item.unread} />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    color: "#80868b",
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
    backgroundColor: "#fff",
  },
});
