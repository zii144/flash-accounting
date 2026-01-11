import { GlassContainer } from "@/components/GlassContainer";
import { useTheme } from "@/contexts/ThemeContext";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { Consumption } from "@/types/consumption";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
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

    // Stop listening if active
    if (isListening) {
      stopListening();
    }

    onSubmit({
      amount: amountNum,
      description: description.trim() || "No description",
    });

    setAmount("");
    setDescription("");
    setBaseDescription("");
  };

  const isSubmitDisabled = !amount || parseFloat(amount) <= 0;

  // Animation for listening state
  const listeningScale = useSharedValue(1);
  const listeningOpacity = useSharedValue(1);

  useEffect(() => {
    if (isListening) {
      listeningScale.value = withSpring(1.02, { damping: 10, stiffness: 200 });
      listeningOpacity.value = withTiming(0.9, { duration: 200 });
    } else {
      listeningScale.value = withSpring(1, { damping: 10, stiffness: 200 });
      listeningOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isListening, listeningScale, listeningOpacity]);

  const listeningStyle = useAnimatedStyle(() => ({
    transform: [{ scale: listeningScale.value }],
    opacity: listeningOpacity.value,
  }));

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
              placeholder="Amount"
              placeholderTextColor={theme.textSecondary}
              value={amount}
              onChangeText={setAmount}
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
                placeholder="Description (optional)"
                placeholderTextColor={theme.textSecondary}
                value={description}
                onChangeText={setDescription}
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
          <TouchableOpacity
            style={[
              styles.submitButton,
              !isSubmitDisabled && styles.submitButtonActive,
              {
                backgroundColor: isSubmitDisabled
                  ? "transparent"
                  : theme.isDark
                  ? "rgba(255, 255, 255, 0.15)"
                  : "rgba(255, 255, 255, 0.9)",
              },
            ]}
            onPress={handleSubmit}
            disabled={isSubmitDisabled}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.submitText,
                {
                  color: isSubmitDisabled ? theme.textSecondary : theme.text,
                  fontWeight: isSubmitDisabled ? "500" : "700",
                },
              ]}
            >
              Add
            </Text>
          </TouchableOpacity>
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
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    overflow: "hidden",
  },
  submitButtonActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  submitText: {
    fontSize: 16,
  },
});
