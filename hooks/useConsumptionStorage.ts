import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Consumption } from '@/types/consumption';

const STORAGE_KEY = '@flash_accounting_consumptions';

export function useConsumptionStorage() {
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConsumptions();
  }, []);

  const loadConsumptions = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        setConsumptions(JSON.parse(data));
      }
    } catch (error) {
      console.error('Failed to load consumptions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveConsumption = useCallback(async (consumption: Consumption) => {
    try {
      const updated = [consumption, ...consumptions];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setConsumptions(updated);
    } catch (error) {
      console.error('Failed to save consumption:', error);
      throw error;
    }
  }, [consumptions]);

  const deleteConsumption = useCallback(async (id: string) => {
    try {
      const updated = consumptions.filter((c) => c.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setConsumptions(updated);
    } catch (error) {
      console.error('Failed to delete consumption:', error);
      throw error;
    }
  }, [consumptions]);

  const clearAll = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setConsumptions([]);
    } catch (error) {
      console.error('Failed to clear consumptions:', error);
      throw error;
    }
  }, []);

  return {
    consumptions,
    isLoading,
    saveConsumption,
    deleteConsumption,
    clearAll,
    refresh: loadConsumptions,
  };
}
