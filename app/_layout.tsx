import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { DiagramAppearanceProvider } from "@/contexts/DiagramAppearanceContext";
import { GlossaryProvider } from "@/contexts/GlossaryContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProProvider } from "@/contexts/ProContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ConsumptionStorageProvider } from "@/hooks/useConsumptionStorage";
import { initializeMonitoring } from "@/utils/monitoring";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Capture mode (App Store preview recording): hide the dev LogBox overlay so it never
// appears in footage. Opt-in via `EXPO_PUBLIC_CAPTURE=1 npx expo start`. No effect on
// normal dev or release builds. See captures/preview-kit/README.md.
if (process.env.EXPO_PUBLIC_CAPTURE === "1") {
  LogBox.ignoreAllLogs(true);
}

initializeMonitoring();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <ThemeProvider>
            <LanguageProvider>
              <DiagramAppearanceProvider>
                <GlossaryProvider>
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
                        <Stack.Screen
                          name="glossary"
                          options={{
                            presentation: process.env.EXPO_OS === "ios" ? "formSheet" : "card",
                            contentStyle: { backgroundColor: "transparent" },
                            sheetGrabberVisible: process.env.EXPO_OS === "ios",
                            headerShown: false,
                          }}
                        />
                      </Stack>
                      </ConsumptionStorageProvider>
                    </ProProvider>
                  </AuthProvider>
                </GlossaryProvider>
              </DiagramAppearanceProvider>
            </LanguageProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
