import { Settings, DEFAULT_SETTINGS } from '@/types/settings';

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(null);
  return {
    ...DEFAULT_SETTINGS,
    ...result,
  } as Settings;
}

export async function updateSettings(updates: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(updates);
}
