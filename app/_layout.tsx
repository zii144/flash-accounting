import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Stack } from "expo-router";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
            }}
          />
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
