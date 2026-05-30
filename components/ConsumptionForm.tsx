import { GlassContainer } from "@/components/GlassContainer";
import { GlassButton } from "@/components/glass-button";
import { GlassIconButton } from "@/components/glass-icon-button";
import { SymbolIcon } from "@/components/symbol-icon";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Consumption, ConsumptionDraft, ConsumptionType } from "@/types/consumption";
import { formatAmountInput, parseAmountInput } from "@/utils/formatting";
import { getConsumptionSuggestions } from "@/utils/smart-consumption";
import {
  sanitizeAmount,
  sanitizeDescription,
  sanitizeDescriptionLive,
  validateAmount,
  validateConsumption,
  validateDescription,
} from "@/utils/validation";
import { GlassContainer as GlassEffectGroup } from "expo-glass-effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

interface ConsumptionFormProps {
  onSubmit: (consumption: ConsumptionDraft) => void;
  history?: Consumption[];
}

export function ConsumptionForm({ onSubmit, history = [] }: ConsumptionFormProps) {
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
  const [amountError, setAmountError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);

  // Handle amount input change
  const handleAmountChange = (text: string) => {
    // Sanitize input
    const sanitized = sanitizeAmount(text);
    
    // Parse to get numeric value
    const numericValue = parseAmountInput(sanitized);

    // Format for display
    const formatted = formatAmountInput(numericValue);

    // Update state with formatted value for display
    setAmount(formatted);

    // Validate and show errors
    if (formatted) {
      const validation = validateAmount(formatted);
      if (!validation.isValid && validation.errors.length > 0) {
        // Only show error if user has entered something
        const firstError = validation.errors[0];
        // Map validation errors to user-friendly messages
        if (firstError.includes("greater than zero")) {
          setAmountError(t("errorInvalidAmount"));
        } else if (firstError.includes("cannot exceed")) {
          const maxMatch = firstError.match(/\d+/);
          const max = maxMatch ? maxMatch[0] : "999,999,999.99";
          setAmountError(t("errorAmountTooLarge").replace("{max}", max));
        } else {
          setAmountError(firstError);
        }
      } else {
        setAmountError(null);
      }
    } else {
      setAmountError(null);
    }
  };

  const handleTyping = useCallback(
    (text: string, callback: (text: string) => void) => {
      // Sanitize description (no trim during typing to allow spaces)
      const sanitized = sanitizeDescriptionLive(text);
      callback(sanitized);

      // Validate description
      const validation = validateDescription(sanitized);
      if (!validation.isValid && validation.errors.length > 0) {
        const firstError = validation.errors[0];
        if (firstError.includes("cannot exceed")) {
          const maxMatch = firstError.match(/\d+/);
          const max = maxMatch ? maxMatch[0] : "500";
          setDescriptionError(t("errorDescriptionTooLong").replace("{max}", max));
        } else {
          setDescriptionError(firstError);
        }
      } else {
        setDescriptionError(null);
      }
    },
    [t]
  );

  // Update description in real-time while listening
  useEffect(() => {
    let frame: number | null = null;

    if (isListening) {
      if (transcript) {
        // While listening, show base description + current transcript
        frame = requestAnimationFrame(() =>
          setDescription(
            baseDescription
              ? `${baseDescription} ${transcript}`.trim()
              : transcript
          )
        );
      } else {
        // When starting but no transcript yet, show base description
        frame = requestAnimationFrame(() => setDescription(baseDescription));
      }
    } else if (!isListening && transcript) {
      // When stopping, finalize with the last transcript
      frame = requestAnimationFrame(() =>
        setDescription(
          baseDescription ? `${baseDescription} ${transcript}`.trim() : transcript
        )
      );
    }

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [transcript, isListening, baseDescription]);

  // Save base description when starting to listen
  const handleMicPress = useCallback(async () => {
    if (isListening) {
      await stopListening();
    } else {
      // Save current description as base before starting
      setBaseDescription(description);
      await startListening();
    }
  }, [isListening, description, stopListening, startListening]);

  const isSubmitDisabled = !amount || parseFloat(parseAmountInput(amount)) <= 0;
  const suggestions = useMemo(
    () => getConsumptionSuggestions(description, history),
    [description, history],
  );

  // Animation for listening state — scale only; never opacity on glass parents
  const listeningScale = useSharedValue(1);

  const handleSubmit = useCallback((type: ConsumptionType, descriptionOverride?: string) => {
    // Parse the formatted amount (remove commas)
    const numericAmount = parseAmountInput(amount);
    const amountNum = parseFloat(numericAmount);
    const submittedDescription = sanitizeDescription(descriptionOverride ?? description);
    
    // Validate before submitting
    const validation = validateConsumption({
      amount: amountNum,
      description: submittedDescription,
      type,
    });

    if (!validation.isValid) {
      // Show first error to user
      const firstError = validation.errors[0];
      let errorMessage = firstError;
      
      // Map to user-friendly messages
      if (firstError.includes("greater than zero") || firstError.includes("valid number")) {
        errorMessage = t("errorInvalidAmount");
      } else if (firstError.includes("cannot exceed")) {
        if (firstError.includes("amount")) {
          const maxMatch = firstError.match(/\d+/);
          const max = maxMatch ? maxMatch[0] : "999,999,999.99";
          errorMessage = t("errorAmountTooLarge").replace("{max}", max);
        } else {
          const maxMatch = firstError.match(/\d+/);
          const max = maxMatch ? maxMatch[0] : "500";
          errorMessage = t("errorDescriptionTooLong").replace("{max}", max);
        }
      }

      Alert.alert(t("errorOccurred") || "Error", errorMessage);
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert(t("errorOccurred") || "Error", t("errorInvalidAmount"));
      return;
    }

    // Dismiss keyboard
    Keyboard.dismiss();

    // Stop listening if active
    if (isListening) {
      stopListening();
    }

    onSubmit({
      amount: amountNum,
      description: submittedDescription || "",
      type,
    });

    setAmount("");
    setDescription("");
    setBaseDescription("");
    setAmountError(null);
    setDescriptionError(null);
  }, [amount, description, isListening, onSubmit, stopListening, t]);

  useEffect(() => {
    if (isListening) {
      listeningScale.value = withSpring(1.01, { damping: 12, stiffness: 180 });
    } else {
      listeningScale.value = withSpring(1, { damping: 12, stiffness: 180 });
    }
  }, [isListening, listeningScale]);

  const listeningStyle = useAnimatedStyle(() => ({
    transform: [{ scale: listeningScale.value }],
  }));

  const handleButtonPress = useCallback(
    (type: ConsumptionType) => {
      handleSubmit(type);
    },
    [handleSubmit],
  );

  const handleSuggestionPress = useCallback((label: string) => {
    setDescription(label);
    setDescriptionError(null);
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Animated.View style={[listeningStyle, styles.animatedWrapper]}>
        <GlassEffectGroup spacing={10} style={styles.formGroup}>
          <GlassContainer intensity="heavy" style={styles.form}>
            <GlassContainer intensity="clear" style={styles.amountContainer}>
              <TextInput
                style={[
                  styles.amountInput,
                  { color: theme.text },
                  amountError && styles.inputError,
                ]}
                placeholder={t("amount")}
                placeholderTextColor={theme.textSecondary}
                value={amount}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                autoFocus
              />
              {amountError ? (
                <Text style={[styles.errorText, { color: theme.foreground }]}>
                  {amountError}
                </Text>
              ) : null}
            </GlassContainer>

            <GlassContainer intensity="clear" style={styles.descriptionContainer}>
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
                    const numericAmount = parseAmountInput(amount);
                    const amountNum = parseFloat(numericAmount);
                    if (!isNaN(amountNum) && amountNum > 0) {
                      handleSubmit("expense");
                    }
                  }}
                />
                {isAvailable ? (
                  <GlassIconButton
                    size={34}
                    onPress={handleMicPress}
                    accessibilityLabel={t("description")}
                    style={styles.micButton}
                  >
                    <SymbolIcon
                      name={isListening ? "mic" : "mic-outline"}
                      size={18}
                      color={isListening ? theme.background : theme.text}
                    />
                  </GlassIconButton>
                ) : null}
                {isListening ? (
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
                ) : null}
              </View>
              {descriptionError ? (
                <Text style={[styles.errorText, { color: theme.foreground }]}>
                  {descriptionError}
                </Text>
              ) : null}
            </GlassContainer>
          </GlassContainer>

          {suggestions.length > 0 ? (
            <View style={styles.suggestionArea}>
              <Text style={[styles.suggestionLabel, { color: theme.textSecondary }]}>
                {t("suggestedNames")}
              </Text>
              <View style={styles.suggestionChips}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={suggestion.label}
                    onPress={() => handleSuggestionPress(suggestion.label)}
                    style={({ pressed }) => [
                      styles.suggestionChip,
                      {
                        borderColor: theme.border,
                        backgroundColor:
                          description === suggestion.label
                            ? theme.foreground
                            : "transparent",
                        opacity: pressed ? 0.72 : 1,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.suggestionText,
                        {
                          color:
                            description === suggestion.label
                              ? theme.background
                              : theme.text,
                        },
                      ]}
                    >
                      {suggestion.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.buttonsContainer}>
            <GlassButton
              style={styles.buttonSlot}
              onPress={() => handleButtonPress("expense")}
              disabled={isSubmitDisabled}
              intensity={isSubmitDisabled ? "light" : "medium"}
              contentStyle={styles.submitButtonContent}
              accessibilityLabel={t("addExpense")}
            >
              {!isSubmitDisabled ? (
                <SymbolIcon name="remove-circle" size={18} color={theme.text} />
              ) : null}
              <Text
                selectable={false}
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
            </GlassButton>

            <GlassButton
              style={styles.buttonSlot}
              onPress={() => handleButtonPress("income")}
              disabled={isSubmitDisabled}
              intensity={isSubmitDisabled ? "light" : "medium"}
              contentStyle={styles.submitButtonContent}
              accessibilityLabel={t("addIncome")}
            >
              {!isSubmitDisabled ? (
                <SymbolIcon name="add-circle" size={18} color={theme.text} />
              ) : null}
              <Text
                selectable={false}
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
            </GlassButton>
          </View>
        </GlassEffectGroup>
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
    overflow: "visible",
    marginBottom: 5,
  },
  formGroup: {
    width: "100%",
  },
  form: {
    borderRadius: 24,
    borderCurve: "continuous",
    padding: 16,
    gap: 12,
  },
  amountContainer: {
    borderRadius: 18,
    borderCurve: "continuous",
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
    borderRadius: 18,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  descriptionContent: {
    position: "relative",
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
    transform: [{ translateY: -17 }],
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
    gap: 12,
    marginTop: 16,
  },
  buttonSlot: {
    flex: 1,
  },
  submitButtonContent: {
    width: "100%",
  },
  submitText: {
    fontSize: 15,
    letterSpacing: 0.2,
  },
  suggestionArea: {
    gap: 8,
  },
  suggestionLabel: {
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 2,
  },
  suggestionChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: "100%",
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputError: {
    borderWidth: 1,
    borderColor: "rgba(255, 59, 48, 0.5)",
  },
  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginHorizontal: 16,
    marginBottom: 4,
  },
});
