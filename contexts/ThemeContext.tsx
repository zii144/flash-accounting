import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

type ColorScheme = 'light' | 'dark';

interface Theme {
  background: string;
  foreground: string;
  border: string;
  inputBackground: string;
  text: string;
  textSecondary: string;
  isDark: boolean;
}

interface ThemeContextType {
  theme: Theme;
  colorScheme: ColorScheme;
}

const lightTheme: Theme = {
  background: '#FFFFFF',
  foreground: '#000000',
  border: '#E5E5E5',
  inputBackground: '#F5F5F5',
  text: '#000000',
  textSecondary: '#666666',
  isDark: false,
};

const darkTheme: Theme = {
  background: '#000000',
  foreground: '#FFFFFF',
  border: '#333333',
  inputBackground: '#1A1A1A',
  text: '#FFFFFF',
  textSecondary: '#999999',
  isDark: true,
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    systemColorScheme === 'dark' ? 'dark' : 'light'
  );

  useEffect(() => {
    setColorScheme(systemColorScheme === 'dark' ? 'dark' : 'light');
  }, [systemColorScheme]);

  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={{ theme, colorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
