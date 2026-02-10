import { getSettings, updateSettings } from '@/lib/utils/settings';
import { populateLanguageSelect } from '@/lib/utils/dom-helpers';
import { applyI18n, t } from '@/lib/utils/i18n';
import './styles.css';

const autoTranslateToggle = document.getElementById('autoTranslate') as HTMLInputElement;
const targetLanguageSelect = document.getElementById('targetLanguage') as HTMLSelectElement;
const translationModeSelect = document.getElementById('translationMode') as HTMLSelectElement;
const openSettingsButton = document.getElementById('openSettings') as HTMLButtonElement;
const statusDiv = document.getElementById('status') as HTMLDivElement;
const statusText = document.getElementById('statusText') as HTMLSpanElement;

// Apply i18n to static elements
applyI18n();

// Load settings and reflect in UI
async function loadSettings() {
  populateLanguageSelect(targetLanguageSelect);
  const settings = await getSettings();

  autoTranslateToggle.checked = settings.autoTranslate;
  targetLanguageSelect.value = settings.targetLanguage;
  translationModeSelect.value = settings.translationMode;
}

// Show status message
function showStatus(message: string, type: 'info' | 'success' | 'error' = 'success') {
  statusDiv.className = `alert alert-${type}`;
  statusText.textContent = message;
  statusDiv.classList.remove('hidden');

  setTimeout(() => {
    statusDiv.classList.add('hidden');
  }, 2000);
}

// Auto Translate toggle
autoTranslateToggle.addEventListener('change', async () => {
  await updateSettings({ autoTranslate: autoTranslateToggle.checked });
  showStatus(
    autoTranslateToggle.checked
      ? t('status_autoTranslateEnabled')
      : t('status_autoTranslateDisabled')
  );
});

// Target Language change
targetLanguageSelect.addEventListener('change', async () => {
  await updateSettings({ targetLanguage: targetLanguageSelect.value });
  showStatus(t('status_targetLanguageUpdated'));
});

// Translation Mode change
translationModeSelect.addEventListener('change', async () => {
  await updateSettings({
    translationMode: translationModeSelect.value as 'replace' | 'append',
  });
  showStatus(t('status_translationModeUpdated'));
});

// Settings button
openSettingsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Initialize
loadSettings();
