import { Preferences } from '@capacitor/preferences';

/**
 * A Supabase-compatible storage adapter that uses Capacitor Preferences.
 * This ensures session persistence even when localStorage is cleared or unreliable on native.
 */
export const capacitorStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const { value } = await Preferences.get({ key });
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await Preferences.set({ key, value });
  },
  removeItem: async (key: string): Promise<void> => {
    await Preferences.remove({ key });
  },
};
