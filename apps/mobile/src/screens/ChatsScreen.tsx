import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { chats as chatsApi, type Chat } from "@/api/client";
import type { RootStackParamList } from "@/navigation/types";
import { Avatar, EmptyState, Row, screenStyles } from "@/components/list";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** The user's chat rooms/DMs. Tapping one opens its conversation. */
export function ChatsScreen() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<Chat[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await chatsApi.list();
      setItems(d.chats ?? []);
      setUnread(d.unread ?? {});
      setError(null);
    } catch {
      setError("Couldn't load chats.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload whenever the tab regains focus (e.g. returning from a chat).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openChat = (c: Chat) =>
    navigation.navigate("Chat", { conversationid: c.conversationid, title: c.name });

  if (loading) {
    return (
      <View style={screenStyles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={screenStyles.list}
      data={items}
      keyExtractor={(c) => c.conversationid}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      ListEmptyComponent={<EmptyState message={error ?? "No chats yet."} />}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => openChat(item)} activeOpacity={0.6}>
          <Row
            left={<Avatar name={item.name} />}
            title={item.name}
            subtitle={item.solo ? "Project room" : item.kind === "group" ? "Group" : "Direct message"}
            badge={unread[item.conversationid]}
          />
        </TouchableOpacity>
      )}
    />
  );
}
