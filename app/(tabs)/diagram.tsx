import { DiagramScreen } from "@/components/DiagramScreen";
import { useLanguage } from "@/contexts/LanguageContext";
import { Stack } from "expo-router";

export default function DiagramRoute() {
  const { t } = useLanguage();

  return (
    <>
      <Stack.Screen options={{ title: t("diagram") }} />
      <DiagramScreen />
    </>
  );
}
