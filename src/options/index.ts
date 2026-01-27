import { getSettings, updateSettings } from '@/lib/utils/settings';
import { createStorage } from '@/lib/cache/factory';
import { ChromeBuiltinTranslator } from '@/lib/api/chrome-builtin';
import './styles.css';

// DOM elements
const tabs = document.querySelectorAll('[data-tab]');
const panels = document.querySelectorAll('[data-panel]');
const translationProviderSelect = document.getElementById('translationProvider') as HTMLSelectElement;
const translationModeSelect = document.getElementById('translationMode') as HTMLSelectElement;
const autoTranslateToggle = document.getElementById('autoTranslate') as HTMLInputElement;
const targetLanguageSelect = document.getElementById('targetLanguage') as HTMLSelectElement;
const googleApiKeyInput = document.getElementById('googleApiKey') as HTMLInputElement;
const toggleGoogleApiKeyVisibility = document.getElementById('toggleGoogleApiKeyVisibility') as HTMLButtonElement;
const deeplApiKeyInput = document.getElementById('deeplApiKey') as HTMLInputElement;
const toggleDeeplApiKeyVisibility = document.getElementById('toggleDeeplApiKeyVisibility') as HTMLButtonElement;
const openaiApiKeyInput = document.getElementById('openaiApiKey') as HTMLInputElement;
const toggleOpenaiApiKeyVisibility = document.getElementById('toggleOpenaiApiKeyVisibility') as HTMLButtonElement;
const openaiBaseUrlInput = document.getElementById('openaiBaseUrl') as HTMLInputElement;
const openaiModelInput = document.getElementById('openaiModel') as HTMLInputElement;
const cacheTTLDaysInput = document.getElementById('cacheTTLDays') as HTMLInputElement;
const cacheTTLValue = document.getElementById('cacheTTLValue') as HTMLSpanElement;
const clearCacheButton = document.getElementById('clearCache') as HTMLButtonElement;
const refreshCacheStatsButton = document.getElementById('refreshCacheStats') as HTMLButtonElement;
const cacheUsageProgress = document.getElementById('cacheUsageProgress') as HTMLProgressElement;
const cacheUsageText = document.getElementById('cacheUsageText') as HTMLSpanElement;
const cacheBytesUsed = document.getElementById('cacheBytesUsed') as HTMLSpanElement;
const cacheEntryCount = document.getElementById('cacheEntryCount') as HTMLSpanElement;
const cacheExpiredCount = document.getElementById('cacheExpiredCount') as HTMLSpanElement;
const toastAlert = document.getElementById('toastAlert') as HTMLDivElement;
const toastText = document.getElementById('toastText') as HTMLSpanElement;
const autoSaveStatus = document.getElementById('autoSaveStatus') as HTMLDivElement;
const savingSpinner = document.getElementById('savingSpinner') as HTMLSpanElement;
const saveStatusText = document.getElementById('saveStatusText') as HTMLSpanElement;
const chromeBuiltinHint = document.getElementById('chromeBuiltinHint') as HTMLLabelElement;

let autoSaveTimeout: number | null = null;
let chromeBuiltinAvailable = false;

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

// Check Chrome Built-in Translator API availability
async function checkChromeBuiltinAvailability(): Promise<void> {
  const chromeBuiltinOption = translationProviderSelect.querySelector(
    'option[value="chrome-builtin"]'
  ) as HTMLOptionElement;

  if (ChromeBuiltinTranslator.isAvailable()) {
    chromeBuiltinAvailable = true;
    chromeBuiltinOption.disabled = false;
    chromeBuiltinOption.textContent = 'Chrome Built-in (Free, No API Key)';
    chromeBuiltinHint.style.display = 'none';
  } else {
    chromeBuiltinAvailable = false;
    chromeBuiltinOption.disabled = true;
    chromeBuiltinOption.textContent = 'Chrome Built-in (Not Available)';
    chromeBuiltinHint.style.display = 'block';
  }
}

// Load settings and reflect in UI
async function loadSettings() {
  const settings = await getSettings();

  // Check Chrome Built-in availability first
  await checkChromeBuiltinAvailability();

  // If saved provider is chrome-builtin but it's not available, fall back to google
  if (settings.translationProvider === 'chrome-builtin' && !chromeBuiltinAvailable) {
    translationProviderSelect.value = 'google';
    autoSave({ translationProvider: 'google' });
  } else {
    translationProviderSelect.value = settings.translationProvider;
  }

  translationModeSelect.value = settings.translationMode;
  autoTranslateToggle.checked = settings.autoTranslate;
  targetLanguageSelect.value = settings.targetLanguage;
  googleApiKeyInput.value = settings.apiKeys.google || '';
  deeplApiKeyInput.value = settings.apiKeys.deepl || '';
  openaiApiKeyInput.value = settings.apiKeys.openai || '';
  openaiBaseUrlInput.value = settings.openaiConfig?.baseUrl || 'https://api.openai.com/v1';
  openaiModelInput.value = settings.openaiConfig?.model || 'gpt-4';
  cacheTTLDaysInput.value = settings.cacheTTLDays.toString();
  updateCacheTTLDisplay(settings.cacheTTLDays);
}

// Update cache TTL display
function updateCacheTTLDisplay(days: number) {
  cacheTTLValue.textContent = `${days} day${days > 1 ? 's' : ''}`;
}

// Format bytes to human-readable format
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Load and display cache statistics
async function loadCacheStats() {
  try {
    const storage = await createStorage();
    const stats = await storage.getStats();

    // Update progress bar
    cacheUsageProgress.value = stats.usagePercent;
    cacheUsageText.textContent = `${stats.usagePercent}%`;

    // Update bytes used
    cacheBytesUsed.textContent = formatBytes(stats.bytesInUse);

    // Update entry count
    cacheEntryCount.textContent = stats.entryCount.toString();

    // Update expired count
    cacheExpiredCount.textContent = stats.expiredCount.toString();

    // Change progress bar color based on usage
    if (stats.usagePercent >= 80) {
      cacheUsageProgress.className = 'progress progress-error w-full h-4';
    } else if (stats.usagePercent >= 60) {
      cacheUsageProgress.className = 'progress progress-warning w-full h-4';
    } else {
      cacheUsageProgress.className = 'progress progress-primary w-full h-4';
    }
  } catch (error) {
    console.error('Failed to load cache stats:', error);
    cacheUsageText.textContent = 'Error';
  }
}

// Translation Provider change
translationProviderSelect.addEventListener('change', () => {
  autoSave({
    translationProvider: translationProviderSelect.value as 'google' | 'deepl' | 'openai' | 'chrome-builtin',
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

// DeepL API Key input
deeplApiKeyInput.addEventListener('input', () => {
  const apiKey = deeplApiKeyInput.value.trim();
  autoSave({
    apiKeys: {
      deepl: apiKey || undefined,
    },
  });
});

// OpenAI API Key input
openaiApiKeyInput.addEventListener('input', () => {
  const apiKey = openaiApiKeyInput.value.trim();
  const baseUrl = openaiBaseUrlInput.value.trim() || 'https://api.openai.com/v1';
  const model = openaiModelInput.value.trim() || 'gpt-4';

  autoSave({
    apiKeys: {
      openai: apiKey || undefined,
    },
    openaiConfig: apiKey ? { baseUrl, model } : undefined,
  });
});

// OpenAI Base URL input
openaiBaseUrlInput.addEventListener('input', () => {
  const baseUrl = openaiBaseUrlInput.value.trim() || 'https://api.openai.com/v1';
  const model = openaiModelInput.value.trim() || 'gpt-4';

  autoSave({
    openaiConfig: { baseUrl, model },
  });
});

// OpenAI Model input
openaiModelInput.addEventListener('input', () => {
  const baseUrl = openaiBaseUrlInput.value.trim() || 'https://api.openai.com/v1';
  const model = openaiModelInput.value.trim() || 'gpt-4';

  autoSave({
    openaiConfig: { baseUrl, model },
  });
});

// Toggle Google API Key visibility
toggleGoogleApiKeyVisibility.addEventListener('click', () => {
  if (googleApiKeyInput.type === 'password') {
    googleApiKeyInput.type = 'text';
  } else {
    googleApiKeyInput.type = 'password';
  }
});

// Toggle DeepL API Key visibility
toggleDeeplApiKeyVisibility.addEventListener('click', () => {
  if (deeplApiKeyInput.type === 'password') {
    deeplApiKeyInput.type = 'text';
  } else {
    deeplApiKeyInput.type = 'password';
  }
});

// Toggle OpenAI API Key visibility
toggleOpenaiApiKeyVisibility.addEventListener('click', () => {
  if (openaiApiKeyInput.type === 'password') {
    openaiApiKeyInput.type = 'text';
  } else {
    openaiApiKeyInput.type = 'password';
  }
});

// Cache TTL input
cacheTTLDaysInput.addEventListener('input', () => {
  const days = parseInt(cacheTTLDaysInput.value) || 7;
  updateCacheTTLDisplay(days);
  autoSave({ cacheTTLDays: days });
});

// Refresh cache stats
refreshCacheStatsButton.addEventListener('click', async () => {
  try {
    refreshCacheStatsButton.disabled = true;
    refreshCacheStatsButton.classList.add('loading');

    await loadCacheStats();
    showToast('Cache statistics refreshed', 'success');
  } catch (error) {
    console.error('Failed to refresh cache stats:', error);
    showToast('Failed to refresh cache statistics', 'error');
  } finally {
    refreshCacheStatsButton.disabled = false;
    refreshCacheStatsButton.classList.remove('loading');
  }
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

    // Refresh stats after clearing
    await loadCacheStats();

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
loadCacheStats();
