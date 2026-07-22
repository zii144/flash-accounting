import { GlassContainer } from "@/components/GlassContainer";
import { SymbolIcon } from "@/components/symbol-icon";
import { createCustomEntryId, useGlossary } from "@/contexts/GlossaryContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { GlossaryEntryView } from "@/types/glossary";
import type { ConsumptionType } from "@/types/consumption";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type EditorState = {
  entry: GlossaryEntryView;
  isNew: boolean;
  label: string;
  termsText: string;
  type: ConsumptionType;
  disabled: boolean;
};

function parseTermsInput(value: string) {
  return value
    .split(/[,，、;；\n]/)
    .map((term) => term.trim())
    .filter(Boolean);
}

export function GlossarySheet() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const {
    activeEntryCount,
    builtinEntries,
    customEntries,
    deleteCustomEntry,
    resetAllPreferences,
    resetBuiltinOverride,
    updateBuiltinOverride,
    upsertCustomEntry,
  } = useGlossary();

  const [editor, setEditor] = useState<EditorState | null>(null);

  const entrySummary = useMemo(
    () => t("smartGlossaryEntrySummary").replace("{count}", String(activeEntryCount)),
    [activeEntryCount, t],
  );

  const openEditor = useCallback((entry: GlossaryEntryView) => {
    const extraTerms =
      entry.source === "builtin" ? (entry.extraTerms ?? []) : entry.terms.filter((term) => term !== entry.label);

    setEditor({
      entry,
      isNew: false,
      label: entry.label,
      termsText: extraTerms.join(", "),
      type: entry.type,
      disabled: entry.disabled,
    });
  }, []);

  const openNewCustomEditor = useCallback(() => {
    const entry: GlossaryEntryView = {
      id: createCustomEntryId(),
      source: "custom",
      label: "",
      type: "expense",
      terms: [],
      disabled: false,
      hasCustomization: true,
    };
    setEditor({
      entry,
      isNew: true,
      label: "",
      termsText: "",
      type: "expense",
      disabled: false,
    });
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleSaveEditor = useCallback(async () => {
    if (!editor) {
      return;
    }

    const label = editor.label.trim();
    const extraTerms = parseTermsInput(editor.termsText);

    if (!label) {
      Alert.alert(t("errorOccurred"), t("smartGlossaryLabelRequired"));
      return;
    }

    if (editor.entry.source === "builtin" && editor.entry.builtinKey) {
      await updateBuiltinOverride(editor.entry.builtinKey, {
        label: label === editor.entry.defaultLabel ? undefined : label,
        extraTerms,
        disabled: editor.disabled,
        type: editor.type,
      });
      setEditor(null);
      return;
    }

    const terms = Array.from(new Set([...extraTerms, label]));
    if (terms.length === 0) {
      Alert.alert(t("errorOccurred"), t("smartGlossaryTermsRequired"));
      return;
    }

    await upsertCustomEntry({
      id: editor.entry.id,
      label,
      type: editor.type,
      terms,
      activeHours: editor.entry.activeHours,
    });
    setEditor(null);
  }, [editor, t, updateBuiltinOverride, upsertCustomEntry]);

  const handleResetEditor = useCallback(async () => {
    if (!editor) {
      return;
    }

    if (editor.entry.source === "builtin" && editor.entry.builtinKey) {
      await resetBuiltinOverride(editor.entry.builtinKey);
      setEditor(null);
      return;
    }

    await deleteCustomEntry(editor.entry.id);
    setEditor(null);
  }, [deleteCustomEntry, editor, resetBuiltinOverride]);

  const handleResetAll = useCallback(() => {
    Alert.alert(t("smartGlossaryResetAllTitle"), t("smartGlossaryResetAllMessage"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("smartGlossaryResetAllConfirm"),
        style: "destructive",
        onPress: async () => {
          await resetAllPreferences();
        },
      },
    ]);
  }, [resetAllPreferences, t]);

  const renderEntryRow = (entry: GlossaryEntryView, isLast: boolean) => {
    const typeLabel =
      entry.type === "income" ? t("smartGlossaryTypeIncome") : t("smartGlossaryTypeExpense");
    const meta = entry.disabled
      ? t("smartGlossaryDisabled")
      : entry.hasCustomization
        ? t("smartGlossaryCustomized")
        : typeLabel;

    return (
      <TouchableOpacity
        key={entry.id}
        style={[
          styles.optionRow,
          !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
        ]}
        onPress={() => openEditor(entry)}
        activeOpacity={0.75}
      >
        <View style={styles.optionTextBlock}>
          <Text style={[styles.optionTitle, { color: theme.text }]}>{entry.label}</Text>
          <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <SymbolIcon name="chevron-forward" size={18} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>{t("smartGlossaryTitle")}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{entrySummary}</Text>
        <Text style={[styles.intro, { color: theme.textSecondary }]}>{t("smartGlossaryIntro")}</Text>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          {t("smartGlossaryBuiltinSection")}
        </Text>
        <GlassContainer intensity="medium" style={styles.listCard}>
          {builtinEntries.map((entry, index) =>
            renderEntryRow(entry, index === builtinEntries.length - 1),
          )}
        </GlassContainer>

        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            {t("smartGlossaryCustomSection")}
          </Text>
          <TouchableOpacity onPress={openNewCustomEditor} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.sectionAction, { color: theme.text }]}>{t("smartGlossaryAddCustom")}</Text>
          </TouchableOpacity>
        </View>

        {customEntries.length === 0 ? (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {t("smartGlossaryEmptyCustom")}
          </Text>
        ) : (
          <GlassContainer intensity="medium" style={styles.listCard}>
            {customEntries.map((entry, index) =>
              renderEntryRow(entry, index === customEntries.length - 1),
            )}
          </GlassContainer>
        )}

        <TouchableOpacity style={styles.resetAllButton} onPress={handleResetAll}>
          <Text style={[styles.resetAllText, { color: theme.textSecondary }]}>
            {t("smartGlossaryResetAllTitle")}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomBar}>
        <GlassContainer intensity="heavy" style={styles.filterBar}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={[styles.closeButtonText, { color: theme.text }]}>{t("confirm")}</Text>
          </TouchableOpacity>
        </GlassContainer>
      </View>

      <Modal
        visible={Boolean(editor)}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setEditor(null)}
      >
        {editor ? (
          <SafeAreaView style={[styles.editorSheet, { backgroundColor: theme.background }]}>
            <View style={styles.editorHeader}>
              <Text style={[styles.editorTitle, { color: theme.text }]}>
                {editor.entry.source === "builtin"
                  ? t("smartGlossaryEditBuiltin")
                  : editor.isNew
                    ? t("smartGlossaryNewCustom")
                    : t("smartGlossaryEditCustom")}
              </Text>
              <TouchableOpacity onPress={() => setEditor(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <SymbolIcon name="close" size={18} color={theme.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.editorContent}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {t("smartGlossaryCanonicalLabel")}
              </Text>
              <GlassContainer intensity="clear" style={styles.fieldCard}>
                <TextInput
                  style={[styles.fieldInput, { color: theme.text }]}
                  value={editor.label}
                  onChangeText={(label) => setEditor((current) => (current ? { ...current, label } : current))}
                  placeholder={
                    editor.entry.defaultLabel ?? t("smartGlossaryCanonicalLabel")
                  }
                  placeholderTextColor={theme.textSecondary}
                />
              </GlassContainer>

              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {t("smartGlossaryTermsLabel")}
              </Text>
              <Text style={[styles.fieldHint, { color: theme.textSecondary }]}>
                {t("smartGlossaryTermsHint")}
              </Text>
              <GlassContainer intensity="clear" style={styles.fieldCard}>
                <TextInput
                  style={[styles.fieldInput, styles.termsInput, { color: theme.text }]}
                  value={editor.termsText}
                  onChangeText={(termsText) =>
                    setEditor((current) => (current ? { ...current, termsText } : current))
                  }
                  placeholder={t("smartGlossaryTermsPlaceholder")}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                />
              </GlassContainer>

              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[
                    styles.typeChip,
                    {
                      borderColor: theme.border,
                      backgroundColor: editor.type === "expense" ? theme.foreground : "transparent",
                    },
                  ]}
                  onPress={() => setEditor((current) => (current ? { ...current, type: "expense" } : current))}
                >
                  <Text
                    style={{
                      color: editor.type === "expense" ? theme.background : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    {t("smartGlossaryTypeExpense")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeChip,
                    {
                      borderColor: theme.border,
                      backgroundColor: editor.type === "income" ? theme.foreground : "transparent",
                    },
                  ]}
                  onPress={() => setEditor((current) => (current ? { ...current, type: "income" } : current))}
                >
                  <Text
                    style={{
                      color: editor.type === "income" ? theme.background : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    {t("smartGlossaryTypeIncome")}
                  </Text>
                </TouchableOpacity>
              </View>

              {editor.entry.source === "builtin" ? (
                <View style={styles.switchRow}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>
                    {t("smartGlossaryDisableEntry")}
                  </Text>
                  <Switch
                    value={editor.disabled}
                    onValueChange={(disabled) =>
                      setEditor((current) => (current ? { ...current, disabled } : current))
                    }
                  />
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.editorActions}>
              <TouchableOpacity
                style={[styles.editorButton, { borderColor: theme.border }]}
                onPress={handleResetEditor}
              >
                <Text style={[styles.editorButtonText, { color: theme.textSecondary }]}>
                  {editor.entry.source === "builtin"
                    ? t("smartGlossaryResetEntry")
                    : t("smartGlossaryDeleteEntry")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editorButton, styles.editorButtonPrimary, { backgroundColor: theme.foreground }]}
                onPress={handleSaveEditor}
              >
                <Text style={[styles.editorButtonText, { color: theme.background }]}>
                  {t("smartGlossarySave")}
                </Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        ) : null}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "600",
  },
  listCard: {
    borderRadius: 24,
    overflow: "hidden",
  },
  optionRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  optionTextBlock: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: "500",
  },
  optionSubtitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  resetAllButton: {
    alignSelf: "center",
    marginTop: 12,
    paddingVertical: 8,
  },
  resetAllText: {
    fontSize: 14,
    fontWeight: "600",
  },
  bottomBar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 16,
  },
  filterBar: {
    borderRadius: 26,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  closeButton: {
    minHeight: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  editorSheet: {
    flex: 1,
  },
  editorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  editorTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  editorContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 8,
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  fieldInput: {
    fontSize: 16,
    minHeight: 44,
    fontWeight: "500",
  },
  termsInput: {
    minHeight: 88,
    textAlignVertical: "top",
    paddingVertical: 10,
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  typeChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: "500",
    flex: 1,
    paddingRight: 12,
  },
  editorActions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  editorButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editorButtonPrimary: {
    borderWidth: 0,
  },
  editorButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
