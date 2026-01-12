/**
 * Settings Store
 *
 * User preferences including zoom level, auto-scroll, and other UI settings.
 * Settings are persisted to localStorage.
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

interface Settings {
  fontSize: number;        // Base font size in pixels (10-28)
  autoScroll: boolean;     // Auto-scroll to bottom during streaming
  showMinimap: boolean;    // Show canvas minimap
  collapseLong: boolean;   // Auto-collapse long content blocks
  collapseThreshold: number; // Characters before auto-collapse
  theme: 'light' | 'dark' | 'system';
}

const DEFAULT_SETTINGS: Settings = {
  fontSize: 14,
  autoScroll: true,
  showMinimap: true,
  collapseLong: true,
  collapseThreshold: 2000,
  theme: 'light',
};

const STORAGE_KEY = 'claude-context-viewer-settings';

/**
 * Load settings from localStorage
 */
function loadSettings(): Settings {
  if (!browser) return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: Settings): void {
  if (!browser) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

// Create the store with loaded settings
const createSettingsStore = () => {
  const { subscribe, set, update } = writable<Settings>(loadSettings());

  return {
    subscribe,
    set: (value: Settings) => {
      set(value);
      saveSettings(value);
    },
    update: (updater: (settings: Settings) => Settings) => {
      update((current) => {
        const updated = updater(current);
        saveSettings(updated);
        return updated;
      });
    },
    reset: () => {
      set(DEFAULT_SETTINGS);
      saveSettings(DEFAULT_SETTINGS);
    },
  };
};

export const settings = createSettingsStore();

// Convenience functions for common operations

/**
 * Zoom in (increase font size)
 */
export function zoomIn(): void {
  settings.update((s) => ({
    ...s,
    fontSize: Math.min(28, s.fontSize + 2),
  }));
}

/**
 * Zoom out (decrease font size)
 */
export function zoomOut(): void {
  settings.update((s) => ({
    ...s,
    fontSize: Math.max(10, s.fontSize - 2),
  }));
}

/**
 * Reset zoom to default
 */
export function resetZoom(): void {
  settings.update((s) => ({
    ...s,
    fontSize: DEFAULT_SETTINGS.fontSize,
  }));
}

/**
 * Set specific font size
 */
export function setFontSize(size: number): void {
  settings.update((s) => ({
    ...s,
    fontSize: Math.min(28, Math.max(10, size)),
  }));
}

/**
 * Toggle auto-scroll
 */
export function toggleAutoScroll(): void {
  settings.update((s) => ({
    ...s,
    autoScroll: !s.autoScroll,
  }));
}

/**
 * Toggle minimap visibility
 */
export function toggleMinimap(): void {
  settings.update((s) => ({
    ...s,
    showMinimap: !s.showMinimap,
  }));
}

/**
 * Get current settings snapshot
 */
export function getSettings(): Settings {
  return get(settings);
}
