import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

type Language = "en" | "zh" | "es" | "fr" | "de" | "ja";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    statistics: "Statistics",
    total: "Total",
    count: "Count",
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
    settings: "Settings",
    exportCSV: "Export to CSV",
    selectLanguage: "Select Language",
    clearHistory: "Clear All History",
    clearHistoryConfirm: "Are you sure you want to clear all history?",
    cancel: "Cancel",
    confirm: "Confirm",
    english: "English",
    chinese: "Chinese",
    spanish: "Spanish",
    french: "French",
    german: "German",
    japanese: "Japanese",
    exportSuccess: "CSV exported successfully!",
    exportError: "Failed to export CSV",
    clearSuccess: "History cleared successfully",
  },
  zh: {
    statistics: "统计",
    total: "总计",
    count: "数量",
    byDay: "按日",
    byMonth: "按月",
    time: "时间",
    sort: "排序",
    all: "全部",
    today: "今天",
    week: "本周",
    month: "本月",
    year: "今年",
    newest: "最新",
    oldest: "最早",
    highest: "最高",
    lowest: "最低",
    today_label: "今天",
    yesterday: "昨天",
    items: "项",
    item: "项",
    noConsumptions: "未找到消费记录",
    settings: "设置",
    exportCSV: "导出为 CSV",
    selectLanguage: "选择语言",
    clearHistory: "清除所有历史",
    clearHistoryConfirm: "确定要清除所有历史吗？",
    cancel: "取消",
    confirm: "确认",
    english: "英语",
    chinese: "中文",
    spanish: "西班牙语",
    french: "法语",
    german: "德语",
    japanese: "日语",
    exportSuccess: "CSV 导出成功！",
    exportError: "导出 CSV 失败",
    clearSuccess: "历史记录已清除",
  },
  es: {
    statistics: "Estadísticas",
    total: "Total",
    count: "Cantidad",
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
    settings: "Configuración",
    exportCSV: "Exportar a CSV",
    selectLanguage: "Seleccionar idioma",
    clearHistory: "Borrar todo el historial",
    clearHistoryConfirm: "¿Estás seguro de que quieres borrar todo el historial?",
    cancel: "Cancelar",
    confirm: "Confirmar",
    english: "Inglés",
    chinese: "Chino",
    spanish: "Español",
    french: "Francés",
    german: "Alemán",
    japanese: "Japonés",
    exportSuccess: "¡CSV exportado con éxito!",
    exportError: "Error al exportar CSV",
    clearSuccess: "Historial borrado con éxito",
  },
  fr: {
    statistics: "Statistiques",
    total: "Total",
    count: "Nombre",
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
    settings: "Paramètres",
    exportCSV: "Exporter en CSV",
    selectLanguage: "Sélectionner la langue",
    clearHistory: "Effacer tout l'historique",
    clearHistoryConfirm: "Êtes-vous sûr de vouloir effacer tout l'historique?",
    cancel: "Annuler",
    confirm: "Confirmer",
    english: "Anglais",
    chinese: "Chinois",
    spanish: "Espagnol",
    french: "Français",
    german: "Allemand",
    japanese: "Japonais",
    exportSuccess: "CSV exporté avec succès!",
    exportError: "Échec de l'exportation CSV",
    clearSuccess: "Historique effacé avec succès",
  },
  de: {
    statistics: "Statistiken",
    total: "Gesamt",
    count: "Anzahl",
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
    settings: "Einstellungen",
    exportCSV: "Als CSV exportieren",
    selectLanguage: "Sprache auswählen",
    clearHistory: "Gesamten Verlauf löschen",
    clearHistoryConfirm: "Sind Sie sicher, dass Sie den gesamten Verlauf löschen möchten?",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    english: "Englisch",
    chinese: "Chinesisch",
    spanish: "Spanisch",
    french: "Französisch",
    german: "Deutsch",
    japanese: "Japanisch",
    exportSuccess: "CSV erfolgreich exportiert!",
    exportError: "CSV-Export fehlgeschlagen",
    clearSuccess: "Verlauf erfolgreich gelöscht",
  },
  ja: {
    statistics: "統計",
    total: "合計",
    count: "件数",
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
    settings: "設定",
    exportCSV: "CSVにエクスポート",
    selectLanguage: "言語を選択",
    clearHistory: "履歴をすべてクリア",
    clearHistoryConfirm: "すべての履歴をクリアしてもよろしいですか？",
    cancel: "キャンセル",
    confirm: "確認",
    english: "英語",
    chinese: "中国語",
    spanish: "スペイン語",
    french: "フランス語",
    german: "ドイツ語",
    japanese: "日本語",
    exportSuccess: "CSVのエクスポートに成功しました！",
    exportError: "CSVのエクスポートに失敗しました",
    clearSuccess: "履歴がクリアされました",
  },
};

const LANGUAGE_STORAGE_KEY = "@flash_accounting_language";

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved && (["en", "zh", "es", "fr", "de", "ja"] as Language[]).includes(saved as Language)) {
        setLanguageState(saved as Language);
      }
    } catch (error) {
      console.error("Failed to load language:", error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error("Failed to save language:", error);
    }
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
