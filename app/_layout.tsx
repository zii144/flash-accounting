import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}
