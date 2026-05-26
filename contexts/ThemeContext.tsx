import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

type ColorScheme = "light" | "dark";

export interface Theme {
  background: string;
  surface: string;
  foreground: string;
  border: string;
  inputBackground: string;
  text: string;
  textSecondary: string;
  isDark: boolean;
  fadeGradient: readonly [string, string, string, string];
}

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
}

const lightTheme: Theme = {
  // iOS grouped background — gives glass cards room to read as elevated layers
  background: "#F2F2F7",
  surface: "#FFFFFF",
  foreground: "#000000",
  border: "#D1D1D6",
  inputBackground: "#FFFFFF",
  text: "#000000",
  textSecondary: "#636366",
  isDark: false,
  fadeGradient: [
    "rgba(242, 242, 247, 0)",
    "rgba(242, 242, 247, 0.35)",
    "rgba(242, 242, 247, 0.75)",
    "#F2F2F7",
  ],
};

const darkTheme: Theme = {
  background: "#000000",
  surface: "#1C1C1E",
  foreground: "#FFFFFF",
  border: "#333333",
  inputBackground: "#1A1A1A",
  text: "#FFFFFF",
  textSecondary: "#98989D",
  isDark: true,
  fadeGradient: [
    "rgba(0, 0, 0, 0)",
    "rgba(0, 0, 0, 0.3)",
    "rgba(0, 0, 0, 0.7)",
    "#000000",
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
