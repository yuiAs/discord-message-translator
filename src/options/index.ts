import { getSettings, updateSettings } from '@/lib/utils/settings';
import { createStorage } from '@/lib/cache/factory';
import './styles.css';

// DOM elements
const tabs = document.querySelectorAll('[data-tab]');
const panels = document.querySelectorAll('[data-panel]');
const translationProviderSelect = document.getElementById('translationProvider') as HTMLSelectElement;
const translationModeSelect = document.getElementById('translationMode') as HTMLSelectElement;
const autoTranslateToggle = document.getElementById('autoTranslate') as HTMLInputElement;
const targetLanguageSelect = document.getElementById('targetLanguage') as HTMLSelectElement;
const googleApiKeyInput = document.getElementById('googleApiKey') as HTMLInputElement;
const toggleApiKeyVisibility = document.getElementById('toggleApiKeyVisibility') as HTMLButtonElement;
const cacheTTLDaysInput = document.getElementById('cacheTTLDays') as HTMLInputElement;
const cacheTTLValue = document.getElementById('cacheTTLValue') as HTMLSpanElement;
const clearCacheButton = document.getElementById('clearCache') as HTMLButtonElement;
const toastAlert = document.getElementById('toastAlert') as HTMLDivElement;
const toastText = document.getElementById('toastText') as HTMLSpanElement;
const autoSaveStatus = document.getElementById('autoSaveStatus') as HTMLDivElement;
const savingSpinner = document.getElementById('savingSpinner') as HTMLSpanElement;
const saveStatusText = document.getElementById('saveStatusText') as HTMLSpanElement;

let autoSaveTimeout: number | null = null;

// Tab switching
tabs.forEach((tab) => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();
    const targetTab = (tab as HTMLElement).dataset.tab;

    // Update active tab
    tabs.forEach((t) => t.classList.remove('tab-active'));
    tab.classList.add('tab-active');

    // Show corresponding panel
    panels.forEach((panel) => {
      const panelElement = panel as HTMLElement;
      if (panelElement.dataset.panel === targetTab) {
        panelElement.classList.remove('hidden');
        panelElement.classList.add('active');
      } else {
        panelElement.classList.add('hidden');
        panelElement.classList.remove('active');
      }
    });
  });
});

// Show toast message
function showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
  toastAlert.className = `alert alert-${type} shadow-lg`;
  toastText.textContent = message;
  toastAlert.classList.remove('hidden');

  setTimeout(() => {
    toastAlert.classList.add('hidden');
  }, 3000);
}

// Show auto-save status
function showAutoSaveStatus(status: 'saving' | 'saved' | 'error') {
  autoSaveStatus.style.opacity = '1';

  if (status === 'saving') {
    savingSpinner.classList.remove('hidden');
    saveStatusText.textContent = 'Saving...';
    saveStatusText.className = 'text-sm text-base-content/70 font-medium';
  } else if (status === 'saved') {
    savingSpinner.classList.add('hidden');
    saveStatusText.textContent = 'Saved';
    saveStatusText.className = 'text-sm text-success font-medium';

    // Hide after 2 seconds
    setTimeout(() => {
      autoSaveStatus.style.opacity = '0';
    }, 2000);
  } else {
    savingSpinner.classList.add('hidden');
    saveStatusText.textContent = 'Save failed';
    saveStatusText.className = 'text-sm text-error font-medium';

    setTimeout(() => {
      autoSaveStatus.style.opacity = '0';
    }, 3000);
  }
}

// Auto-save function
async function autoSave(updates: any) {
  // Clear existing timeout
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  // Set new timeout for debounced save
  autoSaveTimeout = window.setTimeout(async () => {
    try {
      showAutoSaveStatus('saving');
      await updateSettings(updates);
      showAutoSaveStatus('saved');
    } catch (error) {
      console.error('Failed to save settings:', error);
      showAutoSaveStatus('error');
    }
  }, 500); // 500ms debounce
}

// Load settings and reflect in UI
async function loadSettings() {
  const settings = await getSettings();

  translationProviderSelect.value = settings.translationProvider;
  translationModeSelect.value = settings.translationMode;
  autoTranslateToggle.checked = settings.autoTranslate;
  targetLanguageSelect.value = settings.targetLanguage;
  googleApiKeyInput.value = settings.apiKeys.google || '';
  cacheTTLDaysInput.value = settings.cacheTTLDays.toString();
  updateCacheTTLDisplay(settings.cacheTTLDays);
}

// Update cache TTL display
function updateCacheTTLDisplay(days: number) {
  cacheTTLValue.textContent = `${days} day${days > 1 ? 's' : ''}`;
}

// Translation Provider change
translationProviderSelect.addEventListener('change', () => {
  autoSave({
    translationProvider: translationProviderSelect.value as 'google' | 'deepl' | 'openai',
  });
});

// Translation Mode change
translationModeSelect.addEventListener('change', () => {
  autoSave({
    translationMode: translationModeSelect.value as 'replace' | 'append',
  });
});

// Auto Translate toggle
autoTranslateToggle.addEventListener('change', () => {
  autoSave({ autoTranslate: autoTranslateToggle.checked });
});

// Target Language change
targetLanguageSelect.addEventListener('change', () => {
  autoSave({ targetLanguage: targetLanguageSelect.value });
});

// Google API Key input
googleApiKeyInput.addEventListener('input', () => {
  const apiKey = googleApiKeyInput.value.trim();
  autoSave({
    apiKeys: {
      google: apiKey || undefined,
    },
  });
});

// Toggle API Key visibility
toggleApiKeyVisibility.addEventListener('click', () => {
  if (googleApiKeyInput.type === 'password') {
    googleApiKeyInput.type = 'text';
  } else {
    googleApiKeyInput.type = 'password';
  }
});

// Cache TTL input
cacheTTLDaysInput.addEventListener('input', () => {
  const days = parseInt(cacheTTLDaysInput.value) || 7;
  updateCacheTTLDisplay(days);
  autoSave({ cacheTTLDays: days });
});

// Clear cache
clearCacheButton.addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all cached translations?')) {
    return;
  }

  try {
    clearCacheButton.disabled = true;
    clearCacheButton.classList.add('loading');

    const storage = await createStorage();
    await storage.clear();

    showToast('Cache cleared successfully!', 'success');
  } catch (error) {
    console.error('Failed to clear cache:', error);
    showToast('Failed to clear cache', 'error');
  } finally {
    clearCacheButton.disabled = false;
    clearCacheButton.classList.remove('loading');
  }
});

// Initialize
loadSettings();
