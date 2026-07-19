import { Text, TouchableOpacity } from "react-native";
import { useAuth } from "@/auth/AuthContext";

/** Header action that signs the user out (returns the app to the Login screen). */
export function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <TouchableOpacity onPress={() => void signOut()} hitSlop={8} style={{ paddingHorizontal: 12 }}>
      <Text style={{ color: "#4F46E5", fontWeight: "600", fontSize: 15 }}>Sign out</Text>
    </TouchableOpacity>
  );
}
