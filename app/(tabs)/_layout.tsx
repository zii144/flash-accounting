import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={theme.text}
      labelStyle={{ color: theme.textSecondary }}
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{t("accounting")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "dollarsign.circle", selected: "dollarsign.circle.fill" }}
          md="payments"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="statistics" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{t("statistics")}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md="bar_chart"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
