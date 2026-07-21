import { destructiveHue, neutral } from "@/theme/tokens";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

type ColorScheme = "light" | "dark";

/**
 * The SEMANTIC token layer — the adaptive contract every component consumes via
 * `useTheme()`. Each role maps to a primitive token (see @/theme/tokens) resolved for
 * the active color scheme. Add a role here (never a raw hex in a component) whenever a
 * new meaning needs its own light/dark pair.
 *
 * Identity note: this is a monochrome-first system. `destructive` is the only hue in the
 * chrome; income/expense are not roles here — they live only in the chart palettes.
 */
export interface Theme {
  background: string; // App / screen background
  surface: string; // Cards, sheets, elevated containers
  foreground: string; // High-emphasis fills; inverse of background (active/selected)
  border: string; // Dividers, hairline control borders
  inputBackground: string; // Text fields and inputs
  text: string; // Primary text
  textSecondary: string; // Secondary / caption text
  destructive: string; // Delete / destructive actions — the one reserved hue
  isDark: boolean;
  fadeGradient: readonly [string, string, string, string];
}

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
}

const lightTheme: Theme = {
  // iOS grouped background — gives glass cards room to read as elevated layers
  background: neutral.gray50,
  surface: neutral.white,
  foreground: neutral.black,
  border: neutral.gray200,
  inputBackground: neutral.white,
  text: neutral.black,
  textSecondary: neutral.gray500,
  destructive: destructiveHue.light,
  isDark: false,
  fadeGradient: [
    "rgba(242, 242, 247, 0)",
    "rgba(242, 242, 247, 0.35)",
    "rgba(242, 242, 247, 0.75)",
    neutral.gray50,
  ],
};

const darkTheme: Theme = {
  background: neutral.black,
  surface: neutral.gray900,
  foreground: neutral.white,
  border: neutral.gray750,
  inputBackground: neutral.gray950,
  text: neutral.white,
  textSecondary: neutral.gray350,
  destructive: destructiveHue.dark,
  isDark: true,
  fadeGradient: [
    "rgba(0, 0, 0, 0)",
    "rgba(0, 0, 0, 0.3)",
    "rgba(0, 0, 0, 0.7)",
    neutral.black,
  ],
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    systemColorScheme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    setColorScheme(systemColorScheme === "dark" ? "dark" : "light");
  }, [systemColorScheme]);

  const theme = colorScheme === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
