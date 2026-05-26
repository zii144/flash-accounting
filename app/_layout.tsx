import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CaptureAutomation } from "@/components/CaptureAutomation";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProProvider } from "@/contexts/ProContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ConsumptionStorageProvider } from "@/hooks/useConsumptionStorage";
import { initializeMonitoring } from "@/utils/monitoring";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

initializeMonitoring();

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <ProProvider>
                <ConsumptionStorageProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: "transparent" },
                    }}
                  >
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="settings" options={{ headerShown: false }} />
                    <Stack.Screen
                      name="select-language"
                      options={{
                        presentation: process.env.EXPO_OS === "ios" ? "formSheet" : "card",
                        contentStyle: { backgroundColor: "transparent" },
                        sheetGrabberVisible: process.env.EXPO_OS === "ios",
                        headerShown: false,
                      }}
                    />
                  </Stack>
                  <CaptureAutomation />
                </ConsumptionStorageProvider>
              </ProProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
