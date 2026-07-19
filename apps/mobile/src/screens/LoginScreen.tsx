import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/auth/AuthContext";
import { ApiError } from "@/api/client";

/** Email + password sign-in. On success, AuthContext flips the app to the tabs. */
export function LoginScreen() {
  const { signIn, signInWithProvider } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Incorrect email or password."
          : "Couldn't sign in. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const sso = async (provider: "google" | "microsoft") => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      await signInWithProvider(provider);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      if (code === "cancelled" || code === "dismissed") {
        // user backed out — no error message
      } else if (code === "account_exists") {
        setError("An account already exists for that email. Sign in with your password, then link the provider.");
      } else {
        setError("Couldn't sign in with that provider. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <Text style={styles.title}>YappChat</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9aa0a6"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9aa0a6"
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          onSubmitEditing={submit}
          returnKeyType="go"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (busy || !email || !password) && styles.buttonDisabled]}
          onPress={submit}
          disabled={busy || !email || !password}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={[styles.ssoButton, busy && styles.buttonDisabled]} onPress={() => sso("google")} disabled={busy}>
          <Text style={styles.ssoText}>Continue with Google</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.ssoButton, busy && styles.buttonDisabled]} onPress={() => sso("microsoft")} disabled={busy}>
          <Text style={styles.ssoText}>Continue with Microsoft</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
        <Text style={styles.hint}>Use your YappChat account (the same one as the web app).</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  title: { fontSize: 34, fontWeight: "800", textAlign: "center", color: "#111" },
  subtitle: { fontSize: 15, color: "#666", textAlign: "center", marginTop: 6, marginBottom: 28 },
  input: {
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
    color: "#111",
  },
  error: { color: "#c5221f", marginBottom: 8, fontSize: 14 },
  button: {
    backgroundColor: "#1a73e8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 18, gap: 10 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#dadce0" },
  dividerText: { color: "#9aa0a6", fontSize: 13 },
  ssoButton: {
    borderWidth: 1,
    borderColor: "#dadce0",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginBottom: 10,
  },
  ssoText: { color: "#111", fontSize: 15, fontWeight: "600" },
  hint: { color: "#9aa0a6", fontSize: 12, textAlign: "center" },
});
