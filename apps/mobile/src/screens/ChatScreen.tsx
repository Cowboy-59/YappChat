import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { conversations as convApi, type Message } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

const POLL_MS = 8000;

/** A single conversation: history + a composer. Polls for new messages (v1). */
export function ChatScreen({ route }: Props) {
  const { conversationid } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    try {
      const d = await convApi.messages(conversationid);
      setMessages(d.messages ?? []);
      setError(null);
    } catch {
      setError("Couldn't load messages.");
    } finally {
      setLoading(false);
    }
  }, [conversationid]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText("");
    try {
      const { message } = await convApi.send(conversationid, content);
      setMessages((prev) => [...prev, message]);
    } catch {
      setError("Message failed to send.");
      setText(content); // restore so the user doesn't lose it
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          data={messages}
          keyExtractor={(m) => m.id}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <Bubble message={item} mine={item.authorid === user?.id} />}
          ListEmptyComponent={<Text style={styles.empty}>{error ?? "No messages yet — say hello."}</Text>}
        />
        {error && messages.length > 0 ? <Text style={styles.errorBar}>{error}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor="#9aa0a6"
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            <Text style={styles.sendText}>{sending ? "…" : "Send"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const SYSTEM_AUTHORS = ["yappchat-contact", "yappchat-project", "yappchat-system"];

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const isSystem = SYSTEM_AUTHORS.includes(message.authorid);
  const body = message.deletedat ? "This message was deleted" : (message.content ?? "");

  if (isSystem) {
    return <Text style={styles.system}>{body}</Text>;
  }
  return (
    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
      {!mine && message.authorname ? <Text style={styles.author}>{message.authorname}</Text> : null}
      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine, message.deletedat ? styles.deleted : null]}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  listContent: { padding: 12, gap: 6 },
  empty: { textAlign: "center", color: "#80868b", marginTop: 48 },
  bubble: { maxWidth: "82%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMine: { alignSelf: "flex-end", backgroundColor: "#1a73e8" },
  bubbleTheirs: { alignSelf: "flex-start", backgroundColor: "#f1f3f4" },
  author: { fontSize: 11, fontWeight: "700", color: "#5f6368", marginBottom: 2 },
  bubbleText: { fontSize: 15, color: "#111" },
  bubbleTextMine: { color: "#fff" },
  deleted: { fontStyle: "italic", opacity: 0.7 },
  system: { textAlign: "center", fontSize: 12, color: "#9aa0a6", fontStyle: "italic", marginVertical: 4 },
  errorBar: { color: "#c5221f", textAlign: "center", paddingVertical: 4, fontSize: 13 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e8eaed",
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: "#111",
  },
  sendBtn: { backgroundColor: "#1a73e8", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: "#fff", fontWeight: "700" },
});
