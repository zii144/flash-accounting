import { STORAGE_KEYS } from "@/utils/constants";
import { logger } from "@/utils/logger";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type DiagramPalette = "mono" | "accent";

type DiagramAppearanceContextType = {
  diagramPalette: DiagramPalette;
  isAccentPaletteEnabled: boolean;
  setAccentPaletteEnabled: (enabled: boolean) => Promise<void>;
};

const DiagramAppearanceContext = createContext<DiagramAppearanceContextType | undefined>(
  undefined,
);

export function DiagramAppearanceProvider({ children }: { children: React.ReactNode }) {
  const [diagramPalette, setDiagramPalette] = useState<DiagramPalette>("mono");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const savedPalette = await AsyncStorage.getItem(STORAGE_KEYS.DIAGRAM_PALETTE);
        if (cancelled || (savedPalette !== "mono" && savedPalette !== "accent")) {
          return;
        }
        setDiagramPalette(savedPalette);
      } catch (error) {
        logger.error("Failed to load diagram palette preference", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const setAccentPaletteEnabled = useCallback(async (enabled: boolean) => {
    const nextPalette: DiagramPalette = enabled ? "accent" : "mono";
    setDiagramPalette(nextPalette);
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.DIAGRAM_PALETTE, nextPalette);
    } catch (error) {
      logger.error("Failed to save diagram palette preference", error);
    }
  }, []);

  const value = useMemo(
    () => ({
      diagramPalette,
      isAccentPaletteEnabled: diagramPalette === "accent",
      setAccentPaletteEnabled,
    }),
    [diagramPalette, setAccentPaletteEnabled],
  );

  return (
    <DiagramAppearanceContext.Provider value={value}>
      {children}
    </DiagramAppearanceContext.Provider>
  );
}

export function useDiagramAppearance() {
  const context = useContext(DiagramAppearanceContext);
  if (!context) {
    throw new Error("useDiagramAppearance must be used within DiagramAppearanceProvider");
  }
  return context;
}
