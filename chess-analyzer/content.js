// ISOLATED-world controller. Chess.com-specific selectors/state live in board-reader.js.
(() => {
  if (globalThis.__chessAnalyzerContent) return;
  globalThis.__chessAnalyzerContent = true;
  const statusPorts = new Set();
  let getDiagnostics = () => ({ status: 'Đang khởi tạo extension…', enabled: null });
  const snapshot = () => ({ injected: true, version: chrome.runtime.getManifest().version, ...getDiagnostics() });
  function publishDiagnostics() {
    for (const port of statusPorts) {
      try { port.postMessage(snapshot()); } catch { statusPorts.delete(port); }
    }
  }
  // Register before loading modules so startup failures are visible in the popup too.
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type === 'ANALYZER_PING') respond(snapshot());
  });
  chrome.runtime.onConnect.addListener(port => {
    if (port.name !== 'CHESS_ANALYZER_STATUS') return;
    statusPorts.add(port);
    port.onDisconnect.addListener(() => { void chrome.runtime.lastError; statusPorts.delete(port); });
    port.onMessage.addListener(() => { try { port.postMessage(snapshot()); } catch { statusPorts.delete(port); } });
    port.postMessage(snapshot());
  });
  void start().catch(error => {
    getDiagnostics = () => ({ status: `Không khởi tạo được extension: ${error.message}. Hãy reload extension và tab.`, error: true });
    publishDiagnostics();
    console.error('[Chess Analyzer] Khởi tạo thất bại:', error);
  });
  async function start() {
    const [{ BoardOverlay }, { DEFAULT_SETTINGS, MODES, normalizeSettings, normalizePanelPosition, validateFen, debounce }] = await Promise.all([
      import(chrome.runtime.getURL('overlay.js')), import(chrome.runtime.getURL('utils.js')),
      import(chrome.runtime.getURL('board-reader.js')),
    ]);
    const reader = globalThis.ChessAnalyzerBoardReader;
    let settings = { ...DEFAULT_SETTINGS }, revision = 0;
    let board = null, overlay = null, frame = null, port = null, ready = false;
    let observer = null, analysisId = 0, pendingRead = null;
    let lastKey = null, lastResult = null, running = false, fault = false;
    let retryTimer, panelTimer, retryIndex = 0, currentUrl = location.href;
    let status = 'Đang chờ bàn cờ…';
    let panelPosition = null, dragStart = null, positionWrite = Promise.resolve();
    getDiagnostics = () => ({ enabled: settings.enabled, observing: Boolean(observer),
      boardFound: reader.isVisibleBoard(board), searching: running, panelReady: ready, status,
      pageSupported: reader.getPageScope().candidate });
    const retryDelays = [250, 750, 1500, 3000, 5000];
    const scheduleRead = debounce(() => void readCurrent(), 200);
    const send = message => { if (ready) port?.postMessage(message); };
    const setStatus = text => { status = text; send({ type: 'status', status }); publishDiagnostics(); };
    function persistPanelPosition() {
      const position = panelPosition ? { ...panelPosition } : null;
      positionWrite = positionWrite.catch(() => {}).then(() => position
        ? chrome.storage.local.set({ panelPosition: position })
        : chrome.storage.local.remove('panelPosition'))
        .catch(error => { console.error('[Chess Analyzer] Could not save panel position:', error);
          setStatus('Không lưu được vị trí panel.'); });
    }

    function positionPanel(rect) {
      if (!frame) return;
      const width = Math.max(1, Math.min(300, innerWidth - 24));
      frame.style.width = `${width}px`;
      const height = frame.getBoundingClientRect().height;
      const beside = rect && rect.right + width + 24 <= innerWidth;
      const availableX = Math.max(0, innerWidth - width - 24);
      const availableY = Math.max(0, innerHeight - height - 24);
      const desired = panelPosition
        ? { x: 12 + panelPosition.x * availableX, y: 12 + panelPosition.y * availableY }
        : (rect
        ? { x: beside ? rect.right + 12 : rect.left, y: beside ? rect.top : rect.bottom + 12 }
        : { x: innerWidth - width - 16, y: 16 });
      const x = Math.max(12, Math.min(desired.x, 12 + availableX));
      const y = Math.max(12, Math.min(desired.y, 12 + availableY));
      frame.style.left = `${x}px`;
      frame.style.top = `${y}px`;
      frame.style.right = 'auto';
    }
    function movePanel(message) {
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      if (message.type === 'panel-reset') { panelPosition = null; dragStart = null; persistPanelPosition(); }
      else if (message.type === 'panel-drag-start') dragStart = { x: rect.left, y: rect.top };
      else if (message.type === 'panel-drag-end') { dragStart = null; if (panelPosition) persistPanelPosition(); }
      else if (Number.isFinite(message.dx) && Number.isFinite(message.dy)) {
        const start = message.type === 'panel-nudge' ? { x: rect.left, y: rect.top } : dragStart;
        if (start) {
          const width = Math.max(1, Math.min(300, innerWidth - 24));
          const availableX = Math.max(0, innerWidth - width - 24);
          const availableY = Math.max(0, innerHeight - rect.height - 24);
          panelPosition = {
            x: availableX ? Math.max(0, Math.min((start.x + message.dx - 12) / availableX, 1)) : 0,
            y: availableY ? Math.max(0, Math.min((start.y + message.dy - 12) / availableY, 1)) : 0,
          };
          if (message.type === 'panel-nudge') persistPanelPosition();
        }
      }
      positionPanel(board?.getBoundingClientRect());
    }
    const resizePanel = () => positionPanel(board?.getBoundingClientRect());
    function mountPanel() {
      if (frame?.isConnected) return;
      frame = document.createElement('iframe');
      frame.id = 'local-chess-analyzer-panel';
      frame.dataset.chessAnalyzerOwned = 'panel';
      frame.title = 'Chess Analyzer — phân tích local';
      frame.src = chrome.runtime.getURL('panel.html');
      setStatus('Đang kết nối panel Stockfish…');
      const instance = frame;
      panelTimer = setTimeout(() => {
        if (frame === instance && !ready) setStatus('Panel Stockfish không phản hồi. Kiểm tra lỗi extension rồi reload tab.');
      }, 8000);
      frame.addEventListener('load', () => {
        if (frame !== instance || !settings.enabled) return;
        port?.close();
        const channel = new MessageChannel();
        port = channel.port1;
        port.onmessage = ({ data }) => handleEngineMessage(data);
        instance.contentWindow.postMessage({ type: 'CHESS_ANALYZER_CONNECT' }, new URL(instance.src).origin, [channel.port2]);
      });
      document.body.append(frame);
      positionPanel(board?.getBoundingClientRect());
      window.addEventListener('resize', resizePanel, { passive: true });
    }
    function handleEngineMessage(message) {
      if (!settings.enabled) return;
      if (['panel-drag-start', 'panel-drag', 'panel-drag-end', 'panel-nudge', 'panel-reset'].includes(message?.type)) {
        movePanel(message); return;
      }
      if (message?.type === 'ready') {
        clearTimeout(panelTimer); ready = true; setStatus('Đang tìm bàn cờ…'); scheduleRead(); return;
      }
      if (!reader.isVisibleBoard(board) || currentUrl !== location.href || !reader.getPageScope().candidate ||
          message?.id !== analysisId) return;
      if (message.type === 'error') {
        fault = true; invalidate(true);
        setStatus(`Lỗi engine: ${String(message.message || 'Unknown error').replace(/\.+$/, '')}. Hãy tắt rồi bật lại.`);
      } else if (message.type === 'status') setStatus(message.status);
      else if (['info', 'bestmove'].includes(message.type)) {
        const result = message.result;
        if (!result || `${result.fen}|${settings.analysisMode}` !== lastKey) return;
        send({ type: 'render', id: analysisId, result });
        if (message.type === 'bestmove') {
          running = false; lastResult = result;
          if (result.bestMove) overlay?.drawBestMoveArrow(result.bestMove);
          else overlay?.clearArrow();
          setStatus(result.bestMove ? 'Hoàn tất' : 'Không có nước đi hợp lệ');
        }
      }
    }
    function invalidate(destroy = false) {
      analysisId++; running = false;
      overlay?.clearArrow();
      send({ type: 'stop', destroy });
      if (pendingRead) { clearTimeout(pendingRead.timer); pendingRead.resolve(null); pendingRead = null; }
    }
    function disconnectBoard() {
      observer?.disconnect(); observer = null;
      overlay?.destroy(); overlay = null; board = null;
      clearTimeout(retryTimer); scheduleRead.cancel();
    }
    function cleanup() {
      window.removeEventListener('resize', resizePanel);
      dragStart = null;
      clearTimeout(panelTimer);
      invalidate(true); disconnectBoard();
      port?.close(); port = null; ready = false;
      frame?.remove(); frame = null;
      lastKey = null; lastResult = null; fault = false; retryIndex = 0;
      status = 'Đang chờ bàn cờ…';
    }
    function observe() {
      if (observer || !settings.enabled) return;
      observer = new MutationObserver(records => {
        let changed = false, positionChanged = false;
        for (const record of records) {
          const kind = reader.classifyMutation(record, board);
          if (kind === 'none') continue;
          changed = true;
          if (kind === 'position' || kind === 'board') positionChanged = true;
        }
        if (!changed) return;
        if (positionChanged) { invalidate(); retryIndex = 0; }
        overlay?.redraw(); scheduleRead();
      });
      observer.observe(document.documentElement, {
        subtree: true, childList: true, attributes: true, attributeOldValue: true,
        attributeFilter: ['class', 'style', 'data-square', 'data-piece', 'data-fen', 'fen',
          'orientation', 'data-orientation', 'flipped', 'hidden'],
      });
      if (board?.shadowRoot) observer.observe(board.shadowRoot, {
        subtree: true, childList: true, attributes: true, attributeOldValue: true,
        attributeFilter: ['class', 'style', 'data-square', 'data-piece'],
      });
    }
    function requestState(target) {
      if (pendingRead) { clearTimeout(pendingRead.timer); pendingRead.resolve(null); }
      return new Promise(resolve => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => {
          if (pendingRead?.id !== id) return;
          pendingRead = null;
          resolve({ allowed: true, fen: null, reason: 'Không nhận được state của trang. Reload tab nếu vừa cập nhật extension.' });
        }, 1500);
        pendingRead = { id, timer, resolve };
        target.dispatchEvent(new CustomEvent('chess-analyzer:read', { bubbles: true, composed: true, detail: { id } }));
      });
    }
    window.addEventListener('message', event => {
      if (event.source !== window || event.origin !== location.origin ||
          event.data?.channel !== 'chess-analyzer:state' || event.data.id !== pendingRead?.id) return;
      const request = pendingRead; pendingRead = null;
      clearTimeout(request.timer); request.resolve(event.data.state);
    });
    function retryLoading() {
      clearTimeout(retryTimer);
      if (retryIndex < retryDelays.length) retryTimer = setTimeout(() => {
        if (settings.enabled) void readCurrent();
      }, retryDelays[retryIndex++]);
    }
    async function readCurrent() {
      if (!settings.enabled || !reader.getPageScope().candidate || fault || !ready) return;
      if (!reader.isVisibleBoard(board)) {
        invalidate(); overlay?.destroy(); overlay = null;
        board = reader.findBoard();
        if (!board) { setStatus('Đang chờ bàn cờ tải…'); observe(); retryLoading(); return; }
        observer?.disconnect(); observer = null; observe();
      }
      const target = board, id = analysisId, url = location.href;
      const state = await requestState(target);
      if (!state || !settings.enabled || id !== analysisId || target !== board || !board.isConnected || url !== location.href) return;
      if (state.allowed !== true) {
        invalidate(true); disconnectBoard();
        lastKey = null; lastResult = null;
        setStatus(state.reason || 'Trang này chưa được hỗ trợ phân tích.'); return;
      }
      if (!state.fen || !['white', 'black'].includes(state.orientation)) {
        invalidate(); setStatus(state.reason || 'Thiếu FEN hoặc orientation đáng tin cậy.');
        retryLoading(); return;
      }
      let fen;
      try { fen = validateFen(state.fen).fen; }
      catch (error) { invalidate(); setStatus(`FEN không hợp lệ: ${error.message}`); return; }
      const pieces = reader.readPieces(board);
      if (!pieces.ok || reader.placementFromPieces(pieces.pieces) !== fen.split(' ')[0]) {
        invalidate(); setStatus('Board vừa đổi; chờ vị trí ổn định.'); retryLoading(); return;
      }
      clearTimeout(retryTimer);
      overlay ??= new BoardOverlay(board, state.orientation, { onLayout: positionPanel });
      overlay.setOrientation(state.orientation);
      const key = `${fen}|${settings.analysisMode}`;
      send({ type: 'details', mode: settings.analysisMode, ms: MODES[settings.analysisMode] });
      if (key === lastKey) {
        if (running) return;
        if (lastResult) {
          send({ type: 'restore', id: analysisId, result: lastResult });
          if (lastResult.bestMove) overlay.drawBestMoveArrow(lastResult.bestMove);
          setStatus(lastResult.bestMove ? 'Hoàn tất' : 'Không có nước đi hợp lệ'); return;
        }
      }
      invalidate(); lastKey = key; lastResult = null; running = true;
      setStatus('Đang phân tích…');
      send({ type: 'analyze', id: analysisId, fen, mode: settings.analysisMode });
    }
    function applySettings() {
      if (!settings.enabled || !reader.getPageScope().candidate) {
        cleanup(); setStatus(settings.enabled ? 'Đường dẫn trang này chưa được hỗ trợ phân tích.' : 'OFF'); return;
      }
      fault = false; mountPanel(); observe(); scheduleRead();
    }
    function navigate() {
      if (location.href === currentUrl) return;
      currentUrl = location.href; cleanup(); applySettings();
    }
    globalThis.navigation?.addEventListener('navigate', event => {
      if (settings.enabled && event.destination.url !== location.href) cleanup();
    });
    globalThis.navigation?.addEventListener('currententrychange', navigate);
    window.addEventListener('popstate', navigate);
    window.addEventListener('pagehide', cleanup);
    window.addEventListener('pageshow', event => { if (event.persisted) void loadSettings(); });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || (!changes.enabled && !changes.analysisMode && !changes.language && !changes.panelPosition)) return;
      revision++;
      if (changes.panelPosition) {
        panelPosition = normalizePanelPosition(changes.panelPosition.newValue);
        positionPanel(board?.getBoundingClientRect());
        if (!changes.enabled && !changes.analysisMode && !changes.language) return;
      }
      if (changes.analysisMode) { invalidate(); lastKey = null; lastResult = null; }
      for (const key of ['enabled', 'analysisMode', 'language']) if (changes[key]) settings[key] = changes[key].newValue;
      settings = normalizeSettings(settings); applySettings();
    });
    async function loadSettings() {
      const initialRevision = revision;
      const saved = await chrome.storage.local.get({ ...DEFAULT_SETTINGS, panelPosition: null });
      if (revision !== initialRevision) return;
      panelPosition = normalizePanelPosition(saved.panelPosition);
      settings = normalizeSettings(saved); applySettings();
    }
    await loadSettings();
    console.info('[Chess Analyzer] content.js injected — local board analysis.');
  }
})();
