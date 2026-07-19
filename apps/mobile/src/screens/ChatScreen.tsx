import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { conversations as convApi, type Message } from "@/api/client";
import { useAuth } from "@/auth/AuthContext";
import type { RootStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<RootStackParamList, "Chat">;

const POLL_MS = 8000;

/**
 * Track the on-screen keyboard height (0 when hidden). Deterministic across iOS and
 * Android edge-to-edge — where KeyboardAvoidingView's behavior/offset is unreliable —
 * so we can pad the composer up by exactly the keyboard height.
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}

/** A single conversation: history + a composer. Polls for new messages (v1). */
export function ChatScreen({ route, navigation }: Props) {
  const { conversationid } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
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

  // Keep the latest message visible when the keyboard opens.
  useEffect(() => {
    if (keyboardHeight > 0) listRef.current?.scrollToEnd({ animated: true });
  }, [keyboardHeight]);

  const clearConversation = useCallback(() => {
    Alert.alert("Clear conversation?", "This permanently removes all messages here. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await convApi.clear(conversationid);
            setMessages([]);
          } catch {
            setError("Couldn't clear the conversation.");
          }
        },
      },
    ]);
  }, [conversationid]);

  // "Clear" action in the header.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={clearConversation} hitSlop={8} style={{ paddingHorizontal: 4 }}>
          <Text style={{ color: "#4F46E5", fontWeight: "600", fontSize: 15 }}>Clear</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, clearConversation]);

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
    // Pad the bottom so the composer sits directly above the keyboard. On Android
    // edge-to-edge the keyboard height excludes the gesture/nav inset, so add it
    // back when the keyboard is open; when closed, just clear the safe-area inset.
    <View style={[styles.safe, { paddingBottom: keyboardHeight > 0 ? keyboardHeight + insets.bottom : insets.bottom }]}>
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
    </View>
  );
}

const SYSTEM_AUTHORS = ["yappchat-contact", "yappchat-project", "yappchat-system"];

/**
 * A message is from Claude/the agent when it carries the robot marker 🤖 AND the
 * word "claude" (e.g. "🤖 Claude on project wxKanban is connected"). In a project
 * room these are posted under the room owner's account but should read as INCOMING —
 * so we render them on the left with a "Claude" label. The text is kept as-is.
 */
function isClaudeMessage(content: string): boolean {
  return content.includes("🤖") && /claude/i.test(content);
}
// Strip the leading "🤖 Claude" marker for the body — it's shown as the name instead.
const CLAUDE_STRIP = /^\s*🤖\s*claude\b[\s:—-]*/i;

function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  const isSystem = SYSTEM_AUTHORS.includes(message.authorid);
  const raw = message.content ?? "";
  // Claude if authored by the agent (spec 091) OR carrying the legacy 🤖 marker.
  const isClaude = Boolean(message.isagent) || isClaudeMessage(raw);
  const onRight = mine && !isClaude; // your typed messages; Claude's go left
  const body = message.deletedat ? "This message was deleted" : isClaude ? raw.replace(CLAUDE_STRIP, "") : raw;

  if (isSystem) {
    return <Text style={styles.system}>{body}</Text>;
  }
  const authorLabel = isClaude ? "🤖 Claude" : message.authorname;
  return (
    <View style={[styles.bubble, onRight ? styles.bubbleMine : styles.bubbleTheirs]}>
      {!onRight && authorLabel ? <Text style={styles.author}>{authorLabel}</Text> : null}
      <Text style={[styles.bubbleText, onRight && styles.bubbleTextMine, message.deletedat ? styles.deleted : null]}>
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
  bubbleMine: { alignSelf: "flex-end", backgroundColor: "#4F46E5" },
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
  sendBtn: { backgroundColor: "#4F46E5", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.5 },
  sendText: { color: "#fff", fontWeight: "700" },
});
