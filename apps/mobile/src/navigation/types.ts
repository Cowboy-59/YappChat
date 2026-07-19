import type { NavigatorScreenParams } from "@react-navigation/native";

/** Bottom tabs shown after sign-in. */
export type TabsParamList = {
  Chats: undefined;
  Contacts: undefined;
};

/** Root stack: login (logged out), the tabs, and a pushed Chat screen. */
export type RootStackParamList = {
  Login: undefined;
  Tabs: NavigatorScreenParams<TabsParamList> | undefined;
  Chat: { conversationid: string; title: string };
};
