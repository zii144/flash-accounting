import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "transparent" },
              }}
            />
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
