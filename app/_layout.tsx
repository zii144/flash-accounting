import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProProvider } from "@/contexts/ProContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <ProProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "transparent" },
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="select-language"
                    options={{
                      presentation: Platform.OS === "ios" ? "formSheet" : "card",
                      contentStyle: { backgroundColor: "transparent" },
                      sheetGrabberVisible: Platform.OS === "ios",
                      headerShown: false,
                    }}
                  />
                </Stack>
              </ProProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
