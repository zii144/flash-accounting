import { GlassContainer } from "@/components/GlassContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Consumption, ConsumptionType } from "@/types/consumption";
import { TYPING_FEEDBACK_DELAY } from "@/utils/constants";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface ConsumptionFormProps {
  onSubmit: (consumption: Omit<Consumption, "id" | "date">) => void;
}

export function ConsumptionForm({ onSubmit }: ConsumptionFormProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const {
    isListening,
    transcript,
    isAvailable,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  const [baseDescription, setBaseDescription] = useState("");
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Format number with thousand separators
  const formatAmountInput = (value: string): string => {
    // Remove all non-digit characters except decimal point
    const cleaned = value.replace(/[^\d.]/g, "");

    // Handle multiple decimal points - keep only the first one
    const parts = cleaned.split(".");
    if (parts.length > 2) {
      const integerPart = parts[0];
      const decimalPart = parts.slice(1).join("");
      return `${integerPart}.${decimalPart}`;
    }

    const integerPart = parts[0];
    const decimalPart = parts[1] || "";

    // Add thousand separators to integer part
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    // Limit decimal places to 2
    const limitedDecimal = decimalPart.slice(0, 2);

    if (limitedDecimal) {
      return `${formattedInteger}.${limitedDecimal}`;
    }

    return formattedInteger;
  };

  // Parse formatted amount back to number string
  const parseAmountInput = (value: string): string => {
    return value.replace(/,/g, "");
  };

  // Handle amount input change
  const handleAmountChange = (text: string) => {
    // Parse to get numeric value
    const numericValue = parseAmountInput(text);

    // Format for display
    const formatted = formatAmountInput(numericValue);

    // Update state with formatted value for display
    setAmount(formatted);

    // Play typing sound
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, TYPING_FEEDBACK_DELAY);
  };

  // Debounced typing sound
  const handleTyping = useCallback(
    (text: string, callback: (text: string) => void) => {
      callback(text);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Play haptic feedback after a short delay (debounced)
      typingTimeoutRef.current = setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, TYPING_FEEDBACK_DELAY);
    },
    []
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Update description in real-time while listening
  useEffect(() => {
    if (isListening) {
      if (transcript) {
        // While listening, show base description + current transcript
        setDescription(
          baseDescription
            ? `${baseDescription} ${transcript}`.trim()
            : transcript
        );
      } else {
        // When starting but no transcript yet, show base description
        setDescription(baseDescription);
      }
    } else if (!isListening && transcript) {
      // When stopping, finalize with the last transcript
      setDescription(
        baseDescription ? `${baseDescription} ${transcript}`.trim() : transcript
      );
    }
  }, [transcript, isListening, baseDescription]);

  // Save base description when starting to listen
  const handleMicPress = useCallback(async () => {
    if (isListening) {
      await stopListening();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Save current description as base before starting
      setBaseDescription(description);
      await startListening();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [isListening, description, stopListening, startListening]);

  const isSubmitDisabled = !amount || parseFloat(parseAmountInput(amount)) <= 0;

  // Animation for listening state
  const listeningScale = useSharedValue(1);
  const listeningOpacity = useSharedValue(1);

  // Animation for submit buttons
  const expenseButtonScale = useSharedValue(1);
  const incomeButtonScale = useSharedValue(1);
  const expenseButtonOpacity = useSharedValue(isSubmitDisabled ? 0.4 : 1);
  const incomeButtonOpacity = useSharedValue(isSubmitDisabled ? 0.4 : 1);

  const handleSubmit = useCallback((type: ConsumptionType) => {
    // Parse the formatted amount (remove commas)
    const numericAmount = parseAmountInput(amount);
    const amountNum = parseFloat(numericAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    // Dismiss keyboard
    Keyboard.dismiss();

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Stop listening if active
    if (isListening) {
      stopListening();
    }

    onSubmit({
      amount: amountNum,
      description: description.trim() || "",
      type,
    });

    setAmount("");
    setDescription("");
    setBaseDescription("");
  }, [amount, description, isListening, onSubmit, stopListening]);

  useEffect(() => {
    if (isListening) {
      listeningScale.value = withSpring(1.02, { damping: 10, stiffness: 200 });
      listeningOpacity.value = withTiming(0.9, { duration: 200 });
    } else {
      listeningScale.value = withSpring(1, { damping: 10, stiffness: 200 });
      listeningOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isListening, listeningScale, listeningOpacity]);

  // Update submit button animations when enabled/disabled
  useEffect(() => {
    if (isSubmitDisabled) {
      expenseButtonScale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
      incomeButtonScale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
      expenseButtonOpacity.value = withTiming(0.5, { duration: 200 });
      incomeButtonOpacity.value = withTiming(0.5, { duration: 200 });
    } else {
      expenseButtonScale.value = withSpring(1, { damping: 15, stiffness: 200 });
      incomeButtonScale.value = withSpring(1, { damping: 15, stiffness: 200 });
      expenseButtonOpacity.value = withTiming(1, { duration: 200 });
      incomeButtonOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isSubmitDisabled, expenseButtonScale, incomeButtonScale, expenseButtonOpacity, incomeButtonOpacity]);

  const listeningStyle = useAnimatedStyle(() => ({
    transform: [{ scale: listeningScale.value }],
    opacity: listeningOpacity.value,
  }));

  const expenseButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: expenseButtonScale.value }],
    opacity: expenseButtonOpacity.value,
  }));

  const incomeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: incomeButtonScale.value }],
    opacity: incomeButtonOpacity.value,
  }));

  const handleButtonPress = useCallback((type: ConsumptionType) => {
    // Trigger button press animation
    if (type === "expense") {
      expenseButtonScale.value = withSpring(
        0.95,
        { damping: 10, stiffness: 300 },
        () => {
          expenseButtonScale.value = withSpring(1, { damping: 10, stiffness: 300 });
        }
      );
    } else {
      incomeButtonScale.value = withSpring(
        0.95,
        { damping: 10, stiffness: 300 },
        () => {
          incomeButtonScale.value = withSpring(1, { damping: 10, stiffness: 300 });
        }
      );
    }
    handleSubmit(type);
  }, [handleSubmit, expenseButtonScale, incomeButtonScale]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Animated.View style={[listeningStyle, styles.animatedWrapper]}>
        <GlassContainer intensity="medium" style={styles.form}>
          <GlassContainer intensity="light" style={styles.amountContainer}>
            <TextInput
              style={[styles.amountInput, { color: theme.text }]}
              placeholder={t("amount")}
              placeholderTextColor={theme.textSecondary}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              autoFocus
            />
          </GlassContainer>
          <GlassContainer intensity="light" style={styles.descriptionContainer}>
            <View style={styles.descriptionContent}>
              <TextInput
                style={[
                  styles.descriptionInput,
                  { color: theme.text },
                  isListening && styles.descriptionInputListening,
                ]}
                placeholder={t("description")}
                placeholderTextColor={theme.textSecondary}
                value={description}
                onChangeText={(text) => handleTyping(text, setDescription)}
                returnKeyType="done"
                onSubmitEditing={() => {
                  // On submit, default to expense if amount is valid
                  const numericAmount = parseAmountInput(amount);
                  const amountNum = parseFloat(numericAmount);
                  if (!isNaN(amountNum) && amountNum > 0) {
                    handleSubmit("expense");
                  }
                }}
              />
              {isAvailable && (
                <TouchableOpacity
                  style={[
                    styles.micButton,
                    {
                      backgroundColor: isListening
                        ? theme.foreground
                        : theme.border,
                    },
                  ]}
                  onPress={handleMicPress}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isListening ? "mic" : "mic-outline"}
                    size={20}
                    color={isListening ? theme.background : theme.text}
                  />
                </TouchableOpacity>
              )}
              {isListening && (
                <View style={styles.listeningIndicator}>
                  <View
                    style={[
                      styles.listeningDot,
                      { backgroundColor: theme.foreground },
                      styles.listeningDot1,
                    ]}
                  />
                  <View
                    style={[
                      styles.listeningDot,
                      { backgroundColor: theme.foreground },
                      styles.listeningDot2,
                    ]}
                  />
                  <View
                    style={[
                      styles.listeningDot,
                      { backgroundColor: theme.foreground },
                      styles.listeningDot3,
                    ]}
                  />
                </View>
              )}
            </View>
          </GlassContainer>
          <View style={styles.buttonsContainer}>
            <Animated.View style={[expenseButtonStyle, { flex: 1 }]}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  styles.expenseButton,
                  !isSubmitDisabled && styles.submitButtonActive,
                  {
                    backgroundColor: isSubmitDisabled
                      ? "transparent"
                      : theme.isDark
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(0, 0, 0, 0.05)",
                    borderWidth: isSubmitDisabled ? 1 : 0,
                    borderColor: isSubmitDisabled ? theme.border : "transparent",
                  },
                ]}
                onPress={() => handleButtonPress("expense")}
                disabled={isSubmitDisabled}
                activeOpacity={0.85}
              >
                {!isSubmitDisabled && (
                  <Ionicons
                    name="remove-circle-outline"
                    size={18}
                    color={theme.text}
                    style={styles.submitIcon}
                  />
                )}
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.submitText,
                    {
                      color: isSubmitDisabled ? theme.textSecondary : theme.text,
                      fontWeight: isSubmitDisabled ? "500" : "600",
                    },
                  ]}
                >
                  {t("addExpense")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[incomeButtonStyle, { flex: 1 }]}>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  styles.incomeButton,
                  !isSubmitDisabled && styles.submitButtonActive,
                  {
                    backgroundColor: isSubmitDisabled
                      ? "transparent"
                      : theme.isDark
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(0, 0, 0, 0.05)",
                    borderWidth: isSubmitDisabled ? 1 : 0,
                    borderColor: isSubmitDisabled ? theme.border : "transparent",
                  },
                ]}
                onPress={() => handleButtonPress("income")}
                disabled={isSubmitDisabled}
                activeOpacity={0.85}
              >
                {!isSubmitDisabled && (
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={theme.text}
                    style={styles.submitIcon}
                  />
                )}
                <Text
                  allowFontScaling={false}
                  style={[
                    styles.submitText,
                    {
                      color: isSubmitDisabled ? theme.textSecondary : theme.text,
                      fontWeight: isSubmitDisabled ? "500" : "600",
                    },
                  ]}
                >
                  {t("addIncome")}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </GlassContainer>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  animatedWrapper: {
    // Ensure content is not clipped and has proper spacing
    overflow: "visible",
    marginBottom: 5, // Extra space to prevent clipping
  },
  form: {
    borderRadius: 16,
    padding: 16,
    paddingBottom: 36, // Extra bottom padding: 16px base + 6px for shadow (shadowOffset 1 + shadowRadius 3)
    gap: 12,
  },
  amountContainer: {
    borderRadius: 12,
    overflow: "hidden",
  },
  amountInput: {
    fontSize: 24,
    fontWeight: "600",
    padding: 16,
    borderRadius: 12,
    borderWidth: 0,
    textAlign: "center",
    backgroundColor: "transparent",
    minHeight: 56,
  },
  descriptionContainer: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
  },
  descriptionContent: {
    position: "relative",
    borderRadius: 16,
    overflow: "hidden",
  },
  descriptionInput: {
    fontSize: 16,
    padding: 16,
    paddingRight: 50,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  descriptionInputListening: {
    borderWidth: 2,
  },
  micButton: {
    position: "absolute",
    right: 8,
    top: "50%",
    transform: [{ translateY: -16 }],
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  listeningIndicator: {
    position: "absolute",
    right: 48,
    top: "50%",
    transform: [{ translateY: -4 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  listeningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listeningDot1: {
    opacity: 0.4,
  },
  listeningDot2: {
    opacity: 0.7,
  },
  listeningDot3: {
    opacity: 1,
  },
  buttonsContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4, // Small top margin for better spacing
    // Ensure buttons container has proper spacing
    paddingBottom: 0, // No extra padding needed, handled by form paddingBottom
  },
  submitButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    overflow: "visible", // Allow shadows to be visible
    minHeight: 52,
  },
  expenseButton: {
    // Additional styles if needed
  },
  incomeButton: {
    // Additional styles if needed
  },
  submitButtonActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 }, // Reduced shadow offset to minimize clipping
    shadowOpacity: 0.08, // Slightly reduced opacity for subtlety
    shadowRadius: 3, // Reduced radius to fit better within container
    elevation: 2,
  },
  submitIcon: {
    marginRight: -2,
  },
  submitText: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
});
