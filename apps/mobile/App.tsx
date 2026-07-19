import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { LoginScreen } from "@/screens/LoginScreen";
import { ChatsScreen } from "@/screens/ChatsScreen";
import { ContactsScreen } from "@/screens/ContactsScreen";
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
    </Tabs.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

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
