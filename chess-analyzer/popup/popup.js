import { DEFAULT_SETTINGS, normalizeSettings } from '../utils.js';

const toggle = document.querySelector('#enabled');
const mode = document.querySelector('#analysis-mode');
const stateLabel = document.querySelector('#state-label');
const status = document.querySelector('#status');
const details = document.querySelector('#connection-details');
let settings = { ...DEFAULT_SETTINGS };
let revision = 0;
let statusPort = null, connectionId = 0, activeTabId = null;
let latestState = null;

function showTabStatus() {
  if (!settings.enabled) { status.textContent = 'OFF · Đã dừng phân tích.'; details.textContent = ''; return; }
  if (!latestState) return;
  if (latestState.version !== chrome.runtime.getManifest().version) {
    status.textContent = 'Tab đang chạy code bản cũ. Reload tab Chess.com để nạp bản mới.';
    details.textContent = '';
    return;
  }
  status.textContent = latestState.status || 'Đang chờ trạng thái từ trang…';
  details.textContent = latestState.error ? '' :
    `Bàn cờ: ${latestState.boardFound ? 'đã tìm thấy' : 'chưa tìm thấy'} · Panel: ${latestState.panelReady ? 'đã kết nối' : 'chưa kết nối'}`;
}

async function connectToActiveTab() {
  const id = ++connectionId;
  statusPort?.disconnect(); statusPort = null; latestState = null;
  details.textContent = '';
  status.textContent = settings.enabled ? 'Đang kiểm tra kết nối với tab…' : 'OFF · Đã dừng phân tích.';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (id !== connectionId) return;
    if (!tab?.id) throw new Error('Không tìm thấy tab hiện tại.');
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
      status.textContent = settings.enabled
        ? 'Chưa kết nối được với tab. Mở Chess.com rồi reload tab sau khi cài/cập nhật extension. Kiểm tra Site access nếu vẫn lỗi.'
        : 'OFF · Đã dừng phân tích.';
    });
  } catch (error) {
    if (id === connectionId && settings.enabled) status.textContent = `Không kết nối được với tab: ${error.message}`;
  }
}

chrome.tabs.onActivated.addListener(() => void connectToActiveTab());
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (tabId === activeTabId && change.status === 'complete') void connectToActiveTab();
});

function render() {
  toggle.checked = settings.enabled;
  mode.value = settings.analysisMode;
  stateLabel.textContent = settings.enabled ? 'ON' : 'OFF';
  stateLabel.classList.toggle('on', settings.enabled);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  revision += 1;
  for (const key of ['enabled', 'analysisMode']) {
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
    status.textContent = `Không lưu được setting: ${error.message}`;
  }
}

toggle.addEventListener('change', () => save({ enabled: toggle.checked }));
mode.addEventListener('change', () => save({ analysisMode: mode.value }));

try {
  const initialRevision = revision;
  const saved = await chrome.storage.local.get(DEFAULT_SETTINGS);
  if (revision === initialRevision) settings = normalizeSettings(saved);
  render();
  toggle.disabled = mode.disabled = false;
  await connectToActiveTab();
} catch (error) { status.textContent = `Không đọc được settings: ${error.message}`; }
