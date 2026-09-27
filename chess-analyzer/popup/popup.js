import { DEFAULT_SETTINGS, normalizeSettings } from '../utils.js';
import { t, localizeStatus } from '../i18n.js';
import { createDropdown } from './dropdown.js';

const toggle = document.querySelector('#enabled');
const modeDropdown = createDropdown(document.querySelector('[data-setting="analysisMode"]'), value => save({ analysisMode: value }));
const languageDropdown = createDropdown(document.querySelector('[data-setting="language"]'), value => save({ language: value }));
const stateLabel = document.querySelector('#state-label');
const status = document.querySelector('#status');
const details = document.querySelector('#connection-details');
let settings = { ...DEFAULT_SETTINGS };
let revision = 0;
let statusPort = null, connectionId = 0, activeTabId = null;
let latestState = null;

function showTabStatus() {
  if (!settings.enabled) { status.textContent = ''; details.textContent = ''; return; }
  if (!latestState) return;
  if (latestState.version !== chrome.runtime.getManifest().version) {
    status.textContent = t('oldTab', settings.language);
    details.textContent = '';
    return;
  }
  status.textContent = localizeStatus(latestState.status, settings.language) || t('waitingTab', settings.language);
  details.textContent = latestState.error || (latestState.boardFound && latestState.panelReady) ? '' :
    t('connectionDetails', settings.language, {
      board: t(latestState.boardFound ? 'found' : 'missing', settings.language),
      panel: t(latestState.panelReady ? 'connected' : 'disconnectedShort', settings.language),
    });
}

async function connectToActiveTab() {
  const id = ++connectionId;
  statusPort?.disconnect(); statusPort = null; latestState = null;
  details.textContent = '';
  status.textContent = settings.enabled ? t('checkingTab', settings.language) : '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (id !== connectionId) return;
    if (!tab?.id) throw new Error(t('noTab', settings.language));
    activeTabId = tab.id;
    const port = chrome.tabs.connect(tab.id, { name: 'CHESS_ANALYZER_STATUS', frameId: 0 });
    statusPort = port;
    port.onMessage.addListener(state => {
      if (statusPort !== port) return;
      latestState = state; showTabStatus();
    });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (statusPort !== port) return;
      statusPort = null; latestState = null; details.textContent = '';
      status.textContent = settings.enabled ? t('disconnected', settings.language) : '';
    });
  } catch (error) {
    if (id === connectionId && settings.enabled) status.textContent = t('connectError', settings.language, { detail: error.message });
  }
}

chrome.tabs.onActivated.addListener(() => void connectToActiveTab());
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (tabId === activeTabId && change.status === 'complete') void connectToActiveTab();
});

function render() {
  toggle.checked = settings.enabled;
  modeDropdown.setValue(settings.analysisMode);
  languageDropdown.setValue(settings.language);
  document.documentElement.lang = settings.language;
  document.querySelector('#enabled').setAttribute('aria-label', t('toggleLabel', settings.language));
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n, settings.language);
  }
  stateLabel.textContent = settings.enabled ? 'ON' : 'OFF';
  stateLabel.classList.toggle('on', settings.enabled);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || (!changes.enabled && !changes.analysisMode && !changes.language)) return;
  revision += 1;
  for (const key of ['enabled', 'analysisMode', 'language']) {
    if (changes[key]) settings[key] = changes[key].newValue;
  }
  settings = normalizeSettings(settings);
  render();
  showTabStatus();
});

async function save(patch) {
  try {
    await chrome.storage.local.set(patch);
    settings = normalizeSettings({ ...settings, ...patch });
    render();
    if (statusPort) { showTabStatus(); statusPort.postMessage({ type: 'GET_STATUS' }); }
    else await connectToActiveTab();
  } catch (error) {
    render();
    status.textContent = t('saveError', settings.language, { detail: error.message });
  }
}

toggle.addEventListener('change', () => save({ enabled: toggle.checked }));

try {
  const initialRevision = revision;
  const saved = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.remove('skillLevel'); // Remove the obsolete setting from older versions.
  if (revision === initialRevision) settings = normalizeSettings(saved);
  render();
  toggle.disabled = false;
  modeDropdown.setDisabled(false);
  languageDropdown.setDisabled(false);
  await connectToActiveTab();
} catch (error) { status.textContent = t('settingsError', settings.language, { detail: error.message }); }
