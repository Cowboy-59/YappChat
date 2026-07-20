import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { useNewMessageNotifier } from "@/notifications";
import { LoginScreen } from "@/screens/LoginScreen";
import { ChatsScreen } from "@/screens/ChatsScreen";
import { ContactsScreen } from "@/screens/ContactsScreen";
import { CommunitiesScreen } from "@/screens/CommunitiesScreen";
import { ChatScreen } from "@/screens/ChatScreen";
import { SignOutButton } from "@/components/SignOutButton";
import type { RootStackParamList, TabsParamList } from "@/navigation/types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabsParamList>();

function HomeTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: true, headerRight: () => <SignOutButton /> }}>
      <Tabs.Screen name="Chats" component={ChatsScreen} />
      <Tabs.Screen name="Contacts" component={ContactsScreen} />
      <Tabs.Screen name="Communities" component={CommunitiesScreen} />
    </Tabs.Navigator>
  );
}

// Keep the native splash up until we've resolved the session (no white flash).
void SplashScreen.preventAutoHideAsync();

function Root() {
  const { user, loading } = useAuth();
  // Poll for new messages and fire local notifications while signed in.
  useNewMessageNotifier(Boolean(user));

  useEffect(() => {
    if (!loading) void SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  // While resolving the session, keep the splash visible (render nothing).
  if (loading) return null;

  return (
    <Stack.Navigator>
      {user ? (
        <>
          <Stack.Screen name="Tabs" component={HomeTabs} options={{ headerShown: false }} />
          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={({ route }) => ({ title: route.params.title })}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Root />
        </NavigationContainer>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
