// import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
// import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useMemo } from "react";

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  // const { isAuthReady, isSignedIn } = useAuth();
  const tabLabels = useMemo(
    () => ({
      accounting: t("accounting"),
      statistics: t("statistics"),
      diagram: t("diagram"),
    }),
    [t],
  );

  // Testing: auth gate disabled — restore when re-enabling login
  // if (!isAuthReady) {
  //   return null;
  // }

  // if (isAuthReady && !isSignedIn) {
  //   return <Redirect href="/" />;
  // }

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      tintColor={theme.text}
      labelStyle={{ color: theme.textSecondary }}
    >
      <NativeTabs.Trigger name="index" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{tabLabels.accounting}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "dollarsign.circle", selected: "dollarsign.circle.fill" }}
          md="payments"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="statistics" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{tabLabels.statistics}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.bar", selected: "chart.bar.fill" }}
          md="bar_chart"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="diagram" disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Label>{tabLabels.diagram}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "chart.pie", selected: "chart.pie.fill" }}
          md="donut_large"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
