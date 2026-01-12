import { GlassContainer } from "@/components/GlassContainer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Consumption } from "@/types/consumption";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
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

  // Play typing sound effect (WhatsApp-like using haptic feedback)
  const playTypingSound = () => {
    // Use haptic feedback for tactile typing feel (similar to WhatsApp)
    // This provides subtle vibration feedback that feels like typing sounds
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Debounced typing sound
  const handleTyping = (text: string, callback: (text: string) => void) => {
    callback(text);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Play sound after a short delay (debounced) - similar to WhatsApp
    typingTimeoutRef.current = setTimeout(() => {
      playTypingSound();
    }, 80);
  };

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
  const handleMicPress = async () => {
    if (isListening) {
      await stopListening();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      // Save current description as base before starting
      setBaseDescription(description);
      await startListening();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const handleSubmit = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    // Dismiss keyboard
    Keyboard.dismiss();

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Button press animation
    submitScale.value = withSpring(
      0.95,
      { damping: 10, stiffness: 300 },
      () => {
        submitScale.value = withSpring(1, { damping: 10, stiffness: 300 });
      }
    );

    // Stop listening if active
    if (isListening) {
      stopListening();
    }

    onSubmit({
      amount: amountNum,
      description: description.trim() || "",
    });

    setAmount("");
    setDescription("");
    setBaseDescription("");
  };

  const isSubmitDisabled = !amount || parseFloat(amount) <= 0;

  // Animation for listening state
  const listeningScale = useSharedValue(1);
  const listeningOpacity = useSharedValue(1);

  // Animation for submit button
  const submitScale = useSharedValue(1);
  const submitOpacity = useSharedValue(isSubmitDisabled ? 0.4 : 1);
  const submitPulse = useSharedValue(0);

  useEffect(() => {
    if (isListening) {
      listeningScale.value = withSpring(1.02, { damping: 10, stiffness: 200 });
      listeningOpacity.value = withTiming(0.9, { duration: 200 });
    } else {
      listeningScale.value = withSpring(1, { damping: 10, stiffness: 200 });
      listeningOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isListening, listeningScale, listeningOpacity]);

  // Update submit button animation when enabled/disabled
  useEffect(() => {
    if (isSubmitDisabled) {
      submitScale.value = withSpring(0.98, { damping: 15, stiffness: 200 });
      submitOpacity.value = withTiming(0.5, { duration: 200 });
      submitPulse.value = withTiming(0, { duration: 200 });
    } else {
      submitScale.value = withSpring(1, { damping: 15, stiffness: 200 });
      submitOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isSubmitDisabled, submitScale, submitOpacity]);

  // Subtle pulse animation when enabled
  useEffect(() => {
    if (isSubmitDisabled) {
      submitPulse.value = 0;
      return;
    }

    const interval = setInterval(() => {
      submitPulse.value = withTiming(1, { duration: 1500 }, () => {
        submitPulse.value = withTiming(0, { duration: 1500 });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isSubmitDisabled, submitPulse]);

  const listeningStyle = useAnimatedStyle(() => ({
    transform: [{ scale: listeningScale.value }],
    opacity: listeningOpacity.value,
  }));

  const submitButtonStyle = useAnimatedStyle(() => {
    const pulseScale = 1 + submitPulse.value * 0.02;
    return {
      transform: [{ scale: submitScale.value * pulseScale }],
      opacity: submitOpacity.value,
    };
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <Animated.View style={listeningStyle}>
        <GlassContainer intensity="medium" style={styles.form}>
          <GlassContainer intensity="light" style={styles.amountContainer}>
            <TextInput
              style={[styles.amountInput, { color: theme.text }]}
              placeholder={t("amount")}
              placeholderTextColor={theme.textSecondary}
              value={amount}
              onChangeText={(text) => handleTyping(text, setAmount)}
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
                onSubmitEditing={handleSubmit}
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
          <Animated.View style={submitButtonStyle}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                !isSubmitDisabled && styles.submitButtonActive,
                {
                  backgroundColor: isSubmitDisabled
                    ? "transparent"
                    : theme.isDark
                    ? "rgba(255, 255, 255, 0.25)"
                    : "rgba(255, 255, 255, 0.95)",
                  borderWidth: isSubmitDisabled ? 1 : 0,
                  borderColor: isSubmitDisabled ? theme.border : "transparent",
                },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitDisabled}
              activeOpacity={0.85}
            >
              {!isSubmitDisabled && (
                <Ionicons
                  name="add-circle"
                  size={20}
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
                    fontWeight: isSubmitDisabled ? "500" : "700",
                  },
                ]}
              >
                {t("add")}
              </Text>
            </TouchableOpacity>
          </Animated.View>
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
  form: {
    borderRadius: 16,
    padding: 16,
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
  submitButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    overflow: "hidden",
    minHeight: 52,
  },
  submitButtonActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitIcon: {
    marginRight: -4,
  },
  submitText: {
    fontSize: 17,
    letterSpacing: 0.3,
  },
});
