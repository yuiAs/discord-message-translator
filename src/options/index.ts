import { getSettings, updateSettings } from '@/lib/utils/settings';
import { createStorage } from '@/lib/cache/factory';
import './styles.css';

const translationProviderSelect = document.getElementById('translationProvider') as HTMLSelectElement;
const googleApiKeyInput = document.getElementById('googleApiKey') as HTMLInputElement;
const cacheTTLDaysInput = document.getElementById('cacheTTLDays') as HTMLInputElement;
const clearCacheButton = document.getElementById('clearCache') as HTMLButtonElement;
const saveSettingsButton = document.getElementById('saveSettings') as HTMLButtonElement;
const toast = document.getElementById('toast') as HTMLDivElement;
const toastAlert = document.getElementById('toastAlert') as HTMLDivElement;
const toastText = document.getElementById('toastText') as HTMLSpanElement;

// Show toast message
function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  toastAlert.className = `alert alert-${type}`;
  toastText.textContent = message;
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Load settings and reflect in UI
async function loadSettings() {
  const settings = await getSettings();

  translationProviderSelect.value = settings.translationProvider;
  googleApiKeyInput.value = settings.apiKeys.google || '';
  cacheTTLDaysInput.value = settings.cacheTTLDays.toString();
}

// Save settings
saveSettingsButton.addEventListener('click', async () => {
  try {
    const apiKeys = {
      google: googleApiKeyInput.value.trim() || undefined,
    };

    await updateSettings({
      translationProvider: translationProviderSelect.value as 'google' | 'deepl' | 'openai',
      apiKeys,
      cacheTTLDays: parseInt(cacheTTLDaysInput.value) || 7,
    });

    showToast('Settings saved successfully!');
  } catch (error) {
    console.error('Failed to save settings:', error);
    showToast('Failed to save settings', 'error');
  }
});

// Clear cache
clearCacheButton.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all cached translations?')) {
    return;
  }

  try {
    const storage = await createStorage();
    await storage.clear();
    showToast('Cache cleared successfully!');
  } catch (error) {
    console.error('Failed to clear cache:', error);
    showToast('Failed to clear cache', 'error');
  }
});

// Initialize
loadSettings();
