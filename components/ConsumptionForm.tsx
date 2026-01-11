import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Consumption } from '@/types/consumption';

interface ConsumptionFormProps {
  onSubmit: (consumption: Omit<Consumption, 'id' | 'date'>) => void;
}

export function ConsumptionForm({ onSubmit }: ConsumptionFormProps) {
  const { theme } = useTheme();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return;
    }

    onSubmit({
      amount: amountNum,
      description: description.trim() || 'No description',
    });

    setAmount('');
    setDescription('');
  };

  const isSubmitDisabled = !amount || parseFloat(amount) <= 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={[styles.form, { backgroundColor: theme.inputBackground }]}>
        <TextInput
          style={[styles.amountInput, { color: theme.text, borderColor: theme.border }]}
          placeholder="Amount"
          placeholderTextColor={theme.textSecondary}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          autoFocus
        />
        <TextInput
          style={[styles.descriptionInput, { color: theme.text, borderColor: theme.border }]}
          placeholder="Description (optional)"
          placeholderTextColor={theme.textSecondary}
          value={description}
          onChangeText={setDescription}
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: isSubmitDisabled ? theme.border : theme.foreground,
              opacity: isSubmitDisabled ? 0.5 : 1,
            },
          ]}
          onPress={handleSubmit}
          disabled={isSubmitDisabled}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.submitText,
              { color: isSubmitDisabled ? theme.textSecondary : theme.background },
            ]}
          >
            Add
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  form: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  amountInput: {
    fontSize: 24,
    fontWeight: '600',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
  },
  descriptionInput: {
    fontSize: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  submitButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
