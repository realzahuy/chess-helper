import { StockfishEngine } from './engine.js';
import { DEFAULT_SETTINGS, MODES, normalizeSettings, formatEvaluation } from './utils.js';
import { describeMove, describeCastlingRights, formatPrincipalVariation } from './move-display.js';
import { t, localizeStatus } from './i18n.js';

let port = null, engine = null, currentId = null;
let settings = { ...DEFAULT_SETTINGS };
let revision = 0;
let currentStatus = 'Đang kết nối…', currentResult = null, currentFen = null, currentDetails = null;
const $ = id => document.getElementById(id);
function renderLanguage() {
  document.documentElement.lang = settings.language;
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n, settings.language);
  }
  $('drag-handle').setAttribute('aria-label', t('dragLabel', settings.language));
  $('drag-handle').title = t('dragTitle', settings.language);
  $('reset-position').title = t('resetTitle', settings.language);
  $('status').textContent = localizeStatus(currentStatus, settings.language);
  if (currentDetails) $('details').textContent = t('engineDetails', settings.language, currentDetails);
  if (currentResult) render(currentResult);
  else if (currentFen) $('castling-rights').textContent = describeCastlingRights(currentFen, settings.language);
}
function setStatus(value) {
  currentStatus = value;
  $('status').textContent = localizeStatus(value, settings.language);
}
function clear() {
  for (const id of ['best-move', 'evaluation', 'depth', 'pv', 'castling-rights']) $(id).textContent = '—';
  $('move-detail').textContent = '';
  currentResult = null;
  currentFen = null;
}
function stop(destroy = false) {
  currentId = null;
  if (destroy) { engine?.destroy(); engine = null; }
  else void engine?.stop();
  clear();
}
function send(message) { port?.postMessage(message); }
function render(result) {
  currentResult = result;
  currentFen = result.fen;
  const move = describeMove(result.fen, result.bestMove, settings.language);
  $('best-move').textContent = move.label;
  $('move-detail').textContent = move.detail;
  $('castling-rights').textContent = describeCastlingRights(result.fen, settings.language);
  $('depth').textContent = result.depth ?? '—';
  $('evaluation').textContent = formatEvaluation(result.score, result.fen.split(' ')[1]);
  $('pv').textContent = formatPrincipalVariation(result.fen, result.pv);
}
async function analyze(message) {
  if (!settings.enabled || !Number.isSafeInteger(message.id) || !Object.hasOwn(MODES, message.mode)) return;
  currentId = message.id;
  clear();
  currentFen = message.fen;
  $('castling-rights').textContent = describeCastlingRights(message.fen, settings.language);
  if (!engine) {
    const instance = new StockfishEngine({
      onInfo: result => { if (engine === instance) send({ type: 'info', id: currentId, result }); },
      onState: status => { if (engine === instance) send({ type: 'status', id: currentId, status }); },
      onError: error => {
        if (engine !== instance) return;
        const id = currentId;
        stop(true);
        send({ type: 'error', id, message: error.message });
      },
    });
    engine = instance;
  }
  try {
    const result = await engine.analyze(message.fen, message.mode);
    if (settings.enabled && currentId === message.id) send({ type: 'bestmove', id: message.id, result });
  } catch (error) {
    if (error.name !== 'AbortError' && currentId === message.id) {
      stop(true);
      send({ type: 'error', id: message.id, message: error.message });
    }
  }
}
window.addEventListener('message', event => {
  if (port || event.source !== parent || event.origin !== 'https://www.chess.com' ||
      event.data?.type !== 'CHESS_ANALYZER_CONNECT' || event.ports.length !== 1) return;
  port = event.ports[0];
  port.onmessage = ({ data }) => {
    if (data?.type === 'analyze') void analyze(data);
    if (data?.type === 'stop') { stop(data.destroy === true); setStatus(data.status || 'Đang chờ vị trí…'); }
    if (data?.type === 'status') setStatus(data.status);
    // Only the isolated controller decides which results are still current.
    if (data?.type === 'render' && data.id === currentId && settings.enabled) render(data.result);
    if (data?.type === 'restore' && settings.enabled && Number.isSafeInteger(data.id)) {
      currentId = data.id;
      render(data.result);
    }
    if (data?.type === 'details') {
      currentDetails = data;
      $('details').textContent = t('engineDetails', settings.language, data);
    }
  };
  send({ type: 'ready' });
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || (!changes.enabled && !changes.analysisMode && !changes.language)) return;
  revision++;
  for (const key of ['enabled', 'analysisMode', 'language']) if (changes[key]) settings[key] = changes[key].newValue;
  settings = normalizeSettings(settings);
  if (!settings.enabled) { stop(true); setStatus('OFF'); }
  renderLanguage();
});
const initialRevision = revision;
try {
  const saved = await chrome.storage.local.get(DEFAULT_SETTINGS);
  if (revision === initialRevision) settings = normalizeSettings(saved);
  renderLanguage();
} catch { setStatus('Không đọc được settings.'); }
window.addEventListener('pagehide', () => { stop(true); port?.close(); port = null; });

const handle = $('drag-handle');
let drag = null;
handle.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !port) return;
  event.preventDefault();
  drag = { id: event.pointerId, x: event.screenX, y: event.screenY };
  handle.setPointerCapture(event.pointerId);
  handle.classList.add('dragging');
  send({ type: 'panel-drag-start' });
});
handle.addEventListener('pointermove', event => {
  if (drag?.id !== event.pointerId) return;
  send({ type: 'panel-drag', dx: event.screenX - drag.x, dy: event.screenY - drag.y });
});
function endDrag(event) {
  if (drag?.id !== event.pointerId) return;
  drag = null;
  handle.classList.remove('dragging');
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  send({ type: 'panel-drag-end' });
}
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(type, endDrag);
handle.addEventListener('keydown', event => {
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!delta) return;
  event.preventDefault();
  const step = event.shiftKey ? 40 : 10;
  send({ type: 'panel-nudge', dx: delta[0] * step, dy: delta[1] * step });
});
$('reset-position').addEventListener('click', () => send({ type: 'panel-reset' }));
