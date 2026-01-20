import { STORAGE_KEYS, SUPPORTED_LANGUAGES } from "@/utils/constants";
import type { ResolvedLanguage } from "@/utils/formatting";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Localization from "expo-localization";
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Language = "en" | "zh" | "es" | "fr" | "de" | "ja" | "device";

export interface LanguageContextType {
  language: Language;
  resolvedLanguage: ResolvedLanguage;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

// Detect device locale and map to supported languages
const getDeviceLanguage = (): ResolvedLanguage => {
  try {
    // Get the device locales from expo-localization
    const locales = Localization.getLocales();

    // Ensure locales is an array and has at least one element
    if (!Array.isArray(locales) || locales.length === 0) {
      console.warn("No device locales found, falling back to English");
      return "en";
    }

    // Use the first locale (primary device language)
    const primaryLocale = locales[0];
    if (!primaryLocale) {
      console.warn("Primary locale is undefined, falling back to English");
      return "en";
    }

    // Extract language code (e.g., "en" from "en-US")
    let langCode: string | null = null;

    // Try languageCode first (most reliable)
    if (primaryLocale.languageCode) {
      langCode = primaryLocale.languageCode.toLowerCase();
    }
    // Fallback to extracting from languageTag (e.g., "en-US" -> "en")
    else if (primaryLocale.languageTag) {
      const parts = primaryLocale.languageTag.split("-");
      if (parts.length > 0) {
        langCode = parts[0].toLowerCase();
      }
    }

    // If we still don't have a language code, fall back to English
    if (!langCode) {
      console.warn(
        `Could not extract language code from locale: ${JSON.stringify(primaryLocale)}, falling back to English`
      );
      return "en";
    }

    // Map device language codes to our supported languages
    // Fallback to "en" if the device language is not supported
    const languageMap: Record<string, ResolvedLanguage> = {
      en: "en",
      zh: "zh", // Supports both zh-Hans and zh-Hant
      es: "es",
      fr: "fr",
      de: "de",
      ja: "ja",
    };

    const resolvedLang = languageMap[langCode];
    if (!resolvedLang) {
      console.log(
        `Device language "${langCode}" is not supported, falling back to English`
      );
      return "en";
    }

    return resolvedLang;
  } catch (error) {
    console.error("Failed to detect device language:", error);
    // Always fall back to English on any error
    return "en";
  }
};

const translations: Record<ResolvedLanguage, Record<string, string>> = {
  en: {
    accounting: "Accounting",
    statistics: "Statistics",
    total: "Total",
    count: "Count",
    flashAccounting: "Black White Accounting",
    noConsumptionsYet: "No consumptions yet",
    addFirstExpense: "Add your first expense above",
    amount: "Amount",
    description: "Description (optional)",
    noDescription: "No description",
    add: "Add",
    byDay: "By Day",
    byMonth: "By Month",
    time: "Time",
    sort: "Sort",
    all: "All",
    today: "Today",
    week: "Week",
    month: "Month",
    year: "Year",
    newest: "Newest",
    oldest: "Oldest",
    highest: "Highest",
    lowest: "Lowest",
    today_label: "Today",
    yesterday: "Yesterday",
    items: "items",
    item: "item",
    noConsumptions: "No consumptions found",
    logDay: "Log Day",
    rateThisApp: "Rate This App",
    settings: "Settings",
    exportCSV: "Export to CSV",
    selectLanguage: "Select Language",
    clearHistory: "Clear All History",
    clearHistoryConfirm: "Are you sure you want to clear all history?",
    cancel: "Cancel",
    confirm: "Confirm",
    english: "English",
    chinese: "Traditional Chinese",
    spanish: "Spanish",
    french: "French",
    german: "German",
    japanese: "Japanese",
    device: "Device Language",
    exportSuccess: "CSV exported successfully!",
    exportError: "Failed to export CSV",
    clearSuccess: "History cleared successfully",
  },
  zh: {
    accounting: "記帳",
    statistics: "統計",
    total: "總計",
    count: "數量",
    flashAccounting: "黑白記帳",
    noConsumptionsYet: "尚無消費記錄",
    addFirstExpense: "請在上方新增您的第一筆支出",
    amount: "金額",
    description: "描述（選填）",
    noDescription: "無描述",
    add: "新增",
    byDay: "按日",
    byMonth: "按月",
    time: "時間",
    sort: "排序",
    all: "全部",
    today: "今天",
    week: "本週",
    month: "本月",
    year: "今年",
    newest: "最新",
    oldest: "最早",
    highest: "最高",
    lowest: "最低",
    today_label: "今天",
    yesterday: "昨天",
    items: "項",
    item: "項",
    noConsumptions: "未找到消費記錄",
    logDay: "記錄天數",
    rateThisApp: "評分應用",
    settings: "設定",
    exportCSV: "匯出為 CSV",
    selectLanguage: "選擇語言",
    clearHistory: "清除所有歷史",
    clearHistoryConfirm: "確定要清除所有歷史嗎？",
    cancel: "取消",
    confirm: "確認",
    english: "英語",
    chinese: "繁體中文",
    spanish: "西班牙語",
    french: "法語",
    german: "德語",
    japanese: "日語",
    device: "裝置語言",
    exportSuccess: "CSV 匯出成功！",
    exportError: "匯出 CSV 失敗",
    clearSuccess: "歷史記錄已清除",
  },
  es: {
    accounting: "Contabilidad",
    statistics: "Estadísticas",
    total: "Total",
    count: "Cantidad",
    flashAccounting: "Contabilidad Blanco Negro",
    noConsumptionsYet: "Aún no hay consumos",
    addFirstExpense: "Agrega tu primer gasto arriba",
    amount: "Cantidad",
    description: "Descripción (opcional)",
    noDescription: "Sin descripción",
    add: "Agregar",
    byDay: "Por Día",
    byMonth: "Por Mes",
    time: "Tiempo",
    sort: "Ordenar",
    all: "Todo",
    today: "Hoy",
    week: "Semana",
    month: "Mes",
    year: "Año",
    newest: "Más reciente",
    oldest: "Más antiguo",
    highest: "Mayor",
    lowest: "Menor",
    today_label: "Hoy",
    yesterday: "Ayer",
    items: "elementos",
    item: "elemento",
    noConsumptions: "No se encontraron consumos",
    logDay: "Días Registrados",
    rateThisApp: "Calificar App",
    settings: "Configuración",
    exportCSV: "Exportar a CSV",
    selectLanguage: "Seleccionar idioma",
    clearHistory: "Borrar todo el historial",
    clearHistoryConfirm:
      "¿Estás seguro de que quieres borrar todo el historial?",
    cancel: "Cancelar",
    confirm: "Confirmar",
    english: "Inglés",
    chinese: "Chino Tradicional",
    spanish: "Español",
    french: "Francés",
    german: "Alemán",
    japanese: "Japonés",
    device: "Idioma del Dispositivo",
    exportSuccess: "¡CSV exportado con éxito!",
    exportError: "Error al exportar CSV",
    clearSuccess: "Historial borrado con éxito",
  },
  fr: {
    accounting: "Comptabilité",
    statistics: "Statistiques",
    total: "Total",
    count: "Nombre",
    flashAccounting: "Comptabilité Blanc Noir",
    noConsumptionsYet: "Aucune consommation pour le moment",
    addFirstExpense: "Ajoutez votre première dépense ci-dessus",
    amount: "Montant",
    description: "Description (optionnel)",
    noDescription: "Aucune description",
    add: "Ajouter",
    byDay: "Par Jour",
    byMonth: "Par Mois",
    time: "Temps",
    sort: "Trier",
    all: "Tout",
    today: "Aujourd'hui",
    week: "Semaine",
    month: "Mois",
    year: "Année",
    newest: "Plus récent",
    oldest: "Plus ancien",
    highest: "Le plus élevé",
    lowest: "Le plus bas",
    today_label: "Aujourd'hui",
    yesterday: "Hier",
    items: "éléments",
    item: "élément",
    noConsumptions: "Aucune consommation trouvée",
    logDay: "Jours d'Enregistrement",
    rateThisApp: "Noter l'App",
    settings: "Paramètres",
    exportCSV: "Exporter en CSV",
    selectLanguage: "Sélectionner la langue",
    clearHistory: "Effacer tout l'historique",
    clearHistoryConfirm: "Êtes-vous sûr de vouloir effacer tout l'historique?",
    cancel: "Annuler",
    confirm: "Confirmer",
    english: "Anglais",
    chinese: "Chinois Traditionnel",
    spanish: "Espagnol",
    french: "Français",
    german: "Allemand",
    japanese: "Japonais",
    device: "Langue de l'Appareil",
    exportSuccess: "CSV exporté avec succès!",
    exportError: "Échec de l'exportation CSV",
    clearSuccess: "Historique effacé avec succès",
  },
  de: {
    accounting: "Buchhaltung",
    statistics: "Statistiken",
    total: "Gesamt",
    count: "Anzahl",
    flashAccounting: "Schwarz Weiß Buchhaltung",
    noConsumptionsYet: "Noch keine Verbräuche",
    addFirstExpense: "Fügen Sie oben Ihre erste Ausgabe hinzu",
    amount: "Betrag",
    description: "Beschreibung (optional)",
    noDescription: "Keine Beschreibung",
    add: "Hinzufügen",
    byDay: "Nach Tag",
    byMonth: "Nach Monat",
    time: "Zeit",
    sort: "Sortieren",
    all: "Alle",
    today: "Heute",
    week: "Woche",
    month: "Monat",
    year: "Jahr",
    newest: "Neueste",
    oldest: "Älteste",
    highest: "Höchste",
    lowest: "Niedrigste",
    today_label: "Heute",
    yesterday: "Gestern",
    items: "Elemente",
    item: "Element",
    noConsumptions: "Keine Verbräuche gefunden",
    logDay: "Registriertage",
    rateThisApp: "App Bewerten",
    settings: "Einstellungen",
    exportCSV: "Als CSV exportieren",
    selectLanguage: "Sprache auswählen",
    clearHistory: "Gesamten Verlauf löschen",
    clearHistoryConfirm:
      "Sind Sie sicher, dass Sie den gesamten Verlauf löschen möchten?",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    english: "Englisch",
    chinese: "Traditionelles Chinesisch",
    spanish: "Spanisch",
    french: "Französisch",
    german: "Deutsch",
    japanese: "Japanisch",
    device: "Gerätesprache",
    exportSuccess: "CSV erfolgreich exportiert!",
    exportError: "CSV-Export fehlgeschlagen",
    clearSuccess: "Verlauf erfolgreich gelöscht",
  },
  ja: {
    accounting: "会計",
    statistics: "統計",
    total: "合計",
    count: "件数",
    flashAccounting: "白黒会計",
    noConsumptionsYet: "消費がまだありません",
    addFirstExpense: "上記に最初の支出を追加してください",
    amount: "金額",
    description: "説明（任意）",
    noDescription: "説明なし",
    add: "追加",
    byDay: "日別",
    byMonth: "月別",
    time: "時間",
    sort: "並び替え",
    all: "全て",
    today: "今日",
    week: "今週",
    month: "今月",
    year: "今年",
    newest: "最新",
    oldest: "最古",
    highest: "最高",
    lowest: "最低",
    today_label: "今日",
    yesterday: "昨日",
    items: "件",
    item: "件",
    noConsumptions: "消費が見つかりません",
    logDay: "記録日数",
    rateThisApp: "アプリを評価",
    settings: "設定",
    exportCSV: "CSVにエクスポート",
    selectLanguage: "言語を選択",
    clearHistory: "履歴をすべてクリア",
    clearHistoryConfirm: "すべての履歴をクリアしてもよろしいですか？",
    cancel: "キャンセル",
    confirm: "確認",
    english: "英語",
    chinese: "繁体中国語",
    spanish: "スペイン語",
    french: "フランス語",
    german: "ドイツ語",
    japanese: "日本語",
    device: "デバイス言語",
    exportSuccess: "CSVのエクスポートに成功しました！",
    exportError: "CSVのエクスポートに失敗しました",
    clearSuccess: "履歴がクリアされました",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("device");

  // Get the resolved language (actual language code used for translations)
  // Memoize to avoid recalculating device language on every render
  const resolvedLanguage: ResolvedLanguage = useMemo(() => {
    return language === "device" ? getDeviceLanguage() : language;
  }, [language]);

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
      if (saved && SUPPORTED_LANGUAGES.includes(saved as Language)) {
        setLanguageState(saved as Language);
      } else {
        setLanguageState("device");
      }
    } catch (error) {
      console.error("Failed to load language:", error);
      setLanguageState("device");
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error("Failed to save language:", error);
    }
  };

  const t = useMemo(
    () =>
      (key: string): string => {
        return translations[resolvedLanguage]?.[key] || key;
      },
    [resolvedLanguage]
  );

  return (
    <LanguageContext.Provider
      value={{ language, resolvedLanguage, setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
