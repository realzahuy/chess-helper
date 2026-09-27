// Local bootstrap: surface loader/WASM errors instead of a blank Worker error event.
// The Worker URL hash supplies the explicit WASM URL to the unmodified upstream loader.
let stage = 'nạp JavaScript';
let reported = false;
function report(error) {
  if (reported) return;
  reported = true;
  const detail = error?.message || String(error || 'Không có chi tiết từ trình duyệt');
  self.postMessage({ type: 'engine-error', stage, message: detail.slice(0, 1000) });
}
self.addEventListener('error', event => report(event.error || event.message));
self.addEventListener('unhandledrejection', event => { report(event.reason); event.preventDefault(); });
const originalFetch = self.fetch.bind(self);
self.fetch = async (...args) => {
  stage = 'tải WASM';
  const response = await originalFetch(...args);
  if (!response.ok) throw new Error(`Không tải được stockfish.wasm: HTTP ${response.status}`);
  stage = 'biên dịch WASM';
  return response;
};
try {
  self.postMessage({ type: 'engine-stage', stage });
  importScripts('./stockfish.js');
} catch (error) { report(error); }
