import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type Preferences,
} from "./preferencesModel";

interface PreferencesState {
  preferences: Preferences;
  loaded: boolean;
  loadPreferences: () => Promise<Preferences>;
  savePreferences: (preferences: Preferences) => Promise<Preferences>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  preferences: DEFAULT_PREFERENCES,
  loaded: false,

  loadPreferences: async () => {
    const loaded = normalizePreferences(
      await invoke<unknown>("load_preferences_state")
    );
    set({ preferences: loaded, loaded: true });
    return loaded;
  },

  savePreferences: async (preferences) => {
    const next = normalizePreferences({
      ...preferences,
      savedAt: Date.now(),
    });
    await invoke("save_preferences_state", { preferences: next });
    set({ preferences: next, loaded: true });
    return next;
  },
}));
