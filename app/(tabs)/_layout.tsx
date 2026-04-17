import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { PlatformColor } from "react-native";

function iosColor(name: string, fallback: string) {
  if (process.env.EXPO_OS === "ios") {
    return PlatformColor(name);
  }
  return fallback;
}

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useLanguage();

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      blurEffect={process.env.EXPO_OS === "ios" ? "systemChromeMaterial" : undefined}
      iconColor={{
        default: iosColor("secondaryLabel", theme.textSecondary),
        selected: iosColor("label", theme.text),
      }}
      labelStyle={{
        default: {
          fontSize: 11,
          fontWeight: "500",
          color: iosColor("secondaryLabel", theme.textSecondary),
        },
        selected: {
          fontSize: 11,
          fontWeight: "600",
          color: iosColor("label", theme.text),
        },
      }}
      tintColor={iosColor("systemBlueColor", theme.text)}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon
          sf={{ default: "dollarsign.circle", selected: "dollarsign.circle.fill" }}
          md="calculate"
        />
        <NativeTabs.Trigger.Label hidden>{t("accounting")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="statistics">
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md="bar_chart"
        />
        <NativeTabs.Trigger.Label hidden>{t("statistics")}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
