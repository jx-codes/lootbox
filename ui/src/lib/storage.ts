/**
 * Local Storage Utility
 * Type-safe localStorage wrapper for history and settings
 */

export interface ScriptExecution {
  id: string;
  script: string;
  timestamp: number;
  duration: number;
  success: boolean;
  result?: string;
  error?: string;
}

export interface UserSettings {
  theme: "light" | "dark";
  editor: {
    fontSize: number;
    theme: string;
    minimap: boolean;
  };
}

const HISTORY_KEY = "mcp-rpc-script-history";
const SETTINGS_KEY = "mcp-rpc-user-settings";
const MAX_HISTORY_ENTRIES = 100;

const DEFAULT_SETTINGS: UserSettings = {
  theme: "light",
  editor: {
    fontSize: 14,
    theme: "vs-dark",
    minimap: true,
  },
};

/**
 * Script History Management
 */
export const ScriptHistory = {
  /**
   * Add a script execution to history
   */
  add(execution: ScriptExecution): void {
    const history = this.getAll();
    history.unshift(execution); // Add to beginning

    // Keep only last 100 entries
    if (history.length > MAX_HISTORY_ENTRIES) {
      history.splice(MAX_HISTORY_ENTRIES);
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  },

  /**
   * Get all history entries
   */
  getAll(): ScriptExecution[] {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("[Storage] Failed to parse history:", error);
      return [];
    }
  },

  /**
   * Get a single history entry by ID
   */
  getById(id: string): ScriptExecution | undefined {
    const history = this.getAll();
    return history.find((entry) => entry.id === id);
  },

  /**
   * Clear all history
   */
  clear(): void {
    localStorage.removeItem(HISTORY_KEY);
  },

  /**
   * Export history as JSON
   */
  export(): string {
    return JSON.stringify(this.getAll(), null, 2);
  },
};

/**
 * User Settings Management
 */
export const Settings = {
  /**
   * Get all settings
   */
  get(): UserSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (error) {
      console.error("[Storage] Failed to parse settings:", error);
      return DEFAULT_SETTINGS;
    }
  },

  /**
   * Update settings (partial update)
   */
  set(settings: Partial<UserSettings>): void {
    const current = this.get();
    const updated = {
      ...current,
      ...settings,
      editor: {
        ...current.editor,
        ...(settings.editor || {}),
      },
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  },

  /**
   * Reset to defaults
   */
  reset(): void {
    localStorage.removeItem(SETTINGS_KEY);
  },
};
