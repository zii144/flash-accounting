import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { useConsumptionStorage } from "@/hooks/useConsumptionStorage";
import { createConsumptionRecord } from "@/utils/consumption-record";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { DeviceEventEmitter } from "react-native";

const CAPTURE_LANGUAGES: Language[] = ["en", "zh", "es", "fr", "de", "ja"];

const SCREENSHOT_PAGES = [
  { name: "accounting", path: "/" },
  { name: "statistics", path: "/statistics" },
  { name: "settings", path: "/settings" },
] as const;

const EXPENSE_DESCRIPTIONS: Record<Exclude<Language, "device">, string> = {
  en: "Coffee",
  zh: "咖啡",
  es: "Café",
  fr: "Café",
  de: "Kaffee",
  ja: "コーヒー",
};

const CAPTURE_GUARD_KEY = "__flashAccountingCaptureStarted";

const CAPTURE_SCREENSHOTS_ONLY =
  process.env.EXPO_PUBLIC_CAPTURE_SCREENSHOTS_ONLY !== "0";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function CaptureAutomation() {
  const { setLanguage } = useLanguage();
  const { clearAll, isLoading, saveConsumption } = useConsumptionStorage();
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (isLoading || hasRunRef.current) {
      return;
    }

    const globalScope = globalThis as typeof globalThis & {
      [CAPTURE_GUARD_KEY]?: boolean;
    };
    if (globalScope[CAPTURE_GUARD_KEY]) {
      return;
    }

    hasRunRef.current = true;
    globalScope[CAPTURE_GUARD_KEY] = true;

    const seedData = async (language: Language) => {
      await clearAll();
      const now = Date.now();
      const samples = [
        { amount: 18.75, description: EXPENSE_DESCRIPTIONS[language as Exclude<Language, "device">], type: "expense" as const },
        { amount: 3200, description: "Freelance", type: "income" as const },
        { amount: 42.5, description: "Lunch", type: "expense" as const },
      ];

      for (const [index, sample] of samples.entries()) {
        const date = new Date(now - index * 86_400_000).toISOString();
        await saveConsumption(
          createConsumptionRecord({
            id: `capture-${language}-${index}`,
            amount: sample.amount,
            description: sample.description,
            type: sample.type,
            date,
          })
        );
      }
    };

    const setForm = (amount: string, description: string) => {
      DeviceEventEmitter.emit("capture:setForm", { amount, description });
    };

    const run = async () => {
      await wait(8_000);

      for (const language of CAPTURE_LANGUAGES) {
        await setLanguage(language);
        await wait(1_000);
        await seedData(language);

        for (const page of SCREENSHOT_PAGES) {
          await setLanguage(language);
          await wait(500);
          if (page.name === "settings") {
            router.replace("/" as never);
            await wait(400);
          }
          router.replace(page.path as never);
          await wait(page.name === "accounting" ? 1_800 : 2_400);
          console.log(`[capture:screenshot] ${language} ${page.name}`);
          // Leave settings before the next language switch so delayed log delivery
          // does not capture the following locale on the settings screen.
          await wait(page.name === "settings" ? 1_500 : 600);
          if (page.name === "settings") {
            router.replace("/" as never);
            await wait(800);
          }
        }
      }

      if (!CAPTURE_SCREENSHOTS_ONLY) {
        console.log("[capture:video:start] expense-logging-all-languages");
        for (const language of CAPTURE_LANGUAGES) {
          await setLanguage(language);
          await clearAll();
          router.replace("/" as never);
          await wait(1_800);
          setForm("", "");

          const amount = "12.50";
          const description = EXPENSE_DESCRIPTIONS[language as Exclude<Language, "device">];

          console.log(`[capture:video:language] ${language}`);
          for (let index = 1; index <= amount.length; index += 1) {
            setForm(amount.slice(0, index), "");
            await wait(260);
          }

          await wait(350);

          for (let index = 1; index <= description.length; index += 1) {
            setForm(amount, description.slice(0, index));
            await wait(260);
          }

          await wait(500);
          DeviceEventEmitter.emit("capture:submitExpense");
          await wait(2_000);
        }
        console.log("[capture:video:end] expense-logging-all-languages");
      }

      await wait(1_000);
      console.log("[capture:done]");
    };

    void run();
  }, [clearAll, isLoading, saveConsumption, setLanguage]);

  return null;
}
