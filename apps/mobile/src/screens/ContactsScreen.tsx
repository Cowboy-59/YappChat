import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { contacts as contactsApi, type Contact } from "@/api/client";
import type { RootStackParamList } from "@/navigation/types";
import { Avatar, EmptyState, Row, screenStyles } from "@/components/list";

type Nav = NativeStackNavigationProp<RootStackParamList>;

function label(c: Contact): string {
  return c.displayname?.trim() || c.email.split("@")[0];
}

/**
 * The user's accepted contacts. Tapping a contact opens their 1:1 conversation —
 * using the existing conversation if present, otherwise asking the server to open
 * it (`requestContact` is idempotent on an accepted pair).
 */
export function ContactsScreen() {
  const navigation = useNavigation<Nav>();
  const [items, setItems] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await contactsApi.list();
      setItems(d.contacts ?? []);
      setError(null);
    } catch {
      setError("Couldn't load contacts.");
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

  const openContact = async (c: Contact) => {
    if (opening) return;
    try {
      setOpening(c.id);
      const conversationid = c.conversationid ?? (await contactsApi.request(c.id)).conversationid;
      navigation.navigate("Chat", { conversationid, title: label(c) });
    } catch {
      setError("Couldn't open that conversation.");
    } finally {
      setOpening(null);
    }
  };

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
      keyExtractor={(c) => c.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      ListEmptyComponent={<EmptyState message={error ?? "No contacts yet."} />}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => void openContact(item)} activeOpacity={0.6} disabled={opening === item.id}>
          <Row
            left={<Avatar name={label(item)} />}
            title={label(item)}
            subtitle={opening === item.id ? "Opening…" : item.email}
          />
        </TouchableOpacity>
      )}
    />
  );
}
