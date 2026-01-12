import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Consumption } from '@/types/consumption';
import { STORAGE_KEYS } from '@/utils/constants';

export function useConsumptionStorage() {
  const [consumptions, setConsumptions] = useState<Consumption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isInitializedRef = useRef(false);

  const loadConsumptions = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CONSUMPTIONS);
      if (data) {
        const parsed = JSON.parse(data);
        setConsumptions(Array.isArray(parsed) ? parsed : []);
      } else {
        setConsumptions([]);
      }
    } catch (error) {
      console.error('Failed to load consumptions:', error);
      setConsumptions([]);
    } finally {
      setIsLoading(false);
      isInitializedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) {
      loadConsumptions();
    }
  }, [loadConsumptions]);

  const saveConsumption = useCallback(async (consumption: Consumption) => {
    try {
      setConsumptions((prev) => {
        const updated = [consumption, ...prev];
        // Update storage asynchronously without blocking UI
        AsyncStorage.setItem(STORAGE_KEYS.CONSUMPTIONS, JSON.stringify(updated)).catch(
          (error) => {
            console.error('Failed to save consumption:', error);
          }
        );
        return updated;
      });
    } catch (error) {
      console.error('Failed to save consumption:', error);
      throw error;
    }
  }, []);

  const deleteConsumption = useCallback(async (id: string) => {
    try {
      setConsumptions((prev) => {
        const updated = prev.filter((c) => c.id !== id);
        // Update storage asynchronously without blocking UI
        AsyncStorage.setItem(STORAGE_KEYS.CONSUMPTIONS, JSON.stringify(updated)).catch(
          (error) => {
            console.error('Failed to delete consumption:', error);
          }
        );
        return updated;
      });
    } catch (error) {
      console.error('Failed to delete consumption:', error);
      throw error;
    }
  }, []);

  const clearAll = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CONSUMPTIONS);
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
