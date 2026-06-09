import { SymbolIcon } from "@/components/symbol-icon";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Tabs } from "expo-router";
import { useMemo } from "react";

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const tabLabels = useMemo(
    () => ({
      accounting: t("accounting"),
      statistics: t("statistics"),
      diagram: t("diagram"),
    }),
    [t],
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "transparent" },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: tabLabels.accounting,
          tabBarIcon: ({ color, size }) => (
            <SymbolIcon name="accounting" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: tabLabels.statistics,
          tabBarIcon: ({ color, size }) => (
            <SymbolIcon name="statistics" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="diagram"
        options={{
          title: tabLabels.diagram,
          tabBarIcon: ({ color, size }) => (
            <SymbolIcon name="chart" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
