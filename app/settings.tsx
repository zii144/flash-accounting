import { SettingsScreen } from "@/components/SettingsScreen";
import { useLanguage } from "@/contexts/LanguageContext";
import { Stack } from "expo-router";

export default function SettingsRoute() {
  const { t } = useLanguage();

  return (
    <>
      <Stack.Screen options={{ title: t("settings") }} />
      <SettingsScreen />
    </>
  );
}
