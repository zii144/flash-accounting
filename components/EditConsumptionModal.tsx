import { GlassContainer } from "@/components/GlassContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Consumption, ConsumptionType } from "@/types/consumption";
import { formatAmountInput, LOCALE_MAP, parseAmountInput } from "@/utils/formatting";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

interface EditConsumptionModalProps {
  visible: boolean;
  consumption: Consumption | null;
  onClose: () => void;
  onSave: (consumption: Consumption) => Promise<void>;
  onDelete: (id: string) => void;
}

export function EditConsumptionModal({
  visible,
  consumption,
  onClose,
  onSave,
  onDelete,
}: EditConsumptionModalProps) {
  const { theme } = useTheme();
  const { t, resolvedLanguage } = useLanguage();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ConsumptionType>("expense");
  const [logDate, setLogDate] = useState<Date>(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGlassAvailable, setIsGlassAvailable] = useState(false);

  // Check if glass effect is available
  useEffect(() => {
    if (Platform.OS === "ios") {
      try {
        setIsGlassAvailable(isLiquidGlassAvailable());
      } catch {
        setIsGlassAvailable(false);
      }
    }
  }, []);

  // Initialize form when consumption changes
  useEffect(() => {
    if (consumption) {
      setAmount(formatAmountInput(consumption.amount.toString()));
      setDescription(consumption.description || "");
      setType(consumption.type);
      setLogDate(new Date(consumption.date));
    }
  }, [consumption]);

  const handleAmountChange = useCallback((text: string) => {
    const formatted = formatAmountInput(text);
    setAmount(formatted);
  }, []);

  const handleDateChange = useCallback(
    (event: { type: string }, selectedDate?: Date) => {
      if (Platform.OS === "android") {
        setShowDatePicker(false);
      }
      if (event.type === "set" && selectedDate) {
        // Preserve original time when changing date
        setLogDate((prev) => {
          const merged = new Date(selectedDate);
          merged.setHours(prev.getHours(), prev.getMinutes(), prev.getSeconds(), prev.getMilliseconds());
          return merged;
        });
      }
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!consumption) return;

    const numericAmount = parseAmountInput(amount);
    const amountNum = parseFloat(numericAmount);

    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert(t("errorOccurred") || "Error", t("errorInvalidAmount"));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        ...consumption,
        amount: amountNum,
        description: description.trim(),
        type,
        date: logDate.toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : t("errorSaveFailed");
      Alert.alert(t("errorOccurred") || "Error", errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  }, [consumption, amount, description, type, logDate, onSave, onClose, t]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    if (!consumption) return;

    Alert.alert(
      t("deleteEntry") || "Delete Entry",
      t("deleteConfirmation") || "Are you sure you want to delete this entry?",
      [
        {
          text: t("cancel") || "Cancel",
          style: "cancel",
        },
        {
          text: t("delete") || "Delete",
          style: "destructive",
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDelete(consumption.id);
            onClose();
          },
        },
      ]
    );
  }, [consumption, onDelete, onClose, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        {isGlassAvailable ? (
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleClose}
          >
            <GlassView
              glassEffectStyle="regular"
              style={styles.blurBackdrop}
              isInteractive={false}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={handleClose}
          />
        )}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[
            styles.modalContent,
            {
              backgroundColor: theme.isDark
                ? "rgba(28, 28, 30, 0.95)"
                : "rgba(255, 255, 255, 0.98)",
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>
              {t("editEntry") || "Edit Entry"}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t("amount")}
              </Text>
              <GlassContainer intensity="light" style={styles.inputContainer}>
                <Text style={[styles.currencySymbol, { color: theme.text }]}>
                  $
                </Text>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={amount}
                  onChangeText={handleAmountChange}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.textSecondary}
                />
              </GlassContainer>
            </View>

            {/* Description Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t("description")}
              </Text>
              <GlassContainer intensity="light" style={styles.inputContainer}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t("description")}
                  placeholderTextColor={theme.textSecondary}
                  maxLength={500}
                />
              </GlassContainer>
            </View>

            {/* Log Date */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t("logDate")}
              </Text>
              {Platform.OS !== "web" ? (
                <>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                  >
                    <GlassContainer intensity="light" style={styles.dateContainer}>
                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={theme.textSecondary}
                        style={styles.dateIcon}
                      />
                      <Text style={[styles.dateText, { color: theme.text }]}>
                        {logDate.toLocaleDateString(LOCALE_MAP[resolvedLanguage] || "en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={theme.textSecondary}
                      />
                    </GlassContainer>
                  </TouchableOpacity>
                  {showDatePicker ? (
                    <View style={styles.datePickerWrapper}>
                      <DateTimePicker
                        value={logDate}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        onChange={handleDateChange}
                        maximumDate={new Date()}
                      />
                      {Platform.OS === "ios" && (
                        <TouchableOpacity
                          style={[styles.datePickerDone, { backgroundColor: theme.foreground }]}
                          onPress={() => setShowDatePicker(false)}
                        >
                          <Text style={[styles.datePickerDoneText, { color: theme.background }]}>
                            {t("confirm") || "Done"}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : null}
                </>
              ) : (
                <GlassContainer intensity="light" style={styles.dateContainer}>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={theme.textSecondary}
                    style={styles.dateIcon}
                  />
                  <Text style={[styles.dateText, { color: theme.text }]}>
                    {logDate.toLocaleDateString(LOCALE_MAP[resolvedLanguage] || "en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </GlassContainer>
              )}
            </View>

            {/* Type Toggle */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t("type") || "Type"}
              </Text>
              <View style={styles.typeToggle}>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    {
                      borderColor: theme.border,
                    },
                    type === "expense" && {
                      backgroundColor: theme.foreground,
                      borderColor: theme.foreground,
                    },
                  ]}
                  onPress={() => setType("expense")}
                >
                  <Ionicons
                    name="arrow-down-outline"
                    size={16}
                    color={type === "expense" ? theme.background : theme.text}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      {
                        color:
                          type === "expense" ? theme.background : theme.text,
                      },
                    ]}
                  >
                    {t("expense")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.typeButton,
                    {
                      borderColor: theme.border,
                    },
                    type === "income" && {
                      backgroundColor: theme.foreground,
                      borderColor: theme.foreground,
                    },
                  ]}
                  onPress={() => setType("income")}
                >
                  <Ionicons
                    name="arrow-up-outline"
                    size={16}
                    color={type === "income" ? theme.background : theme.text}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      {
                        color:
                          type === "income" ? theme.background : theme.text,
                      },
                    ]}
                  >
                    {t("income")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  {
                    borderColor: theme.isDark
                      ? "rgba(255, 59, 48, 0.5)"
                      : "rgba(255, 59, 48, 0.3)",
                  },
                ]}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                <Text style={styles.deleteButtonText}>
                  {t("delete")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  { backgroundColor: theme.foreground },
                  isSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text
                  style={[styles.saveButtonText, { color: theme.background }]}
                >
                  {isSaving ? t("saving") || "Saving..." : t("save") || "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  blurBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateIcon: {
    marginRight: 12,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  datePickerWrapper: {
    marginTop: 12,
  },
  datePickerDone: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  datePickerDoneText: {
    fontSize: 16,
    fontWeight: "600",
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "600",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
  },
  typeToggle: {
    flexDirection: "row",
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  deleteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF3B30",
  },
  saveButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
