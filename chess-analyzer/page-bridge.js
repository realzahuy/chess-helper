// MAIN-world read-only bridge. No chrome APIs, settings, network or engine commands.
(() => {
  if (globalThis.__chessAnalyzerBridge) return;
  globalThis.__chessAnalyzerBridge = true;
  document.addEventListener('chess-analyzer:read', event => {
    const id = event.detail?.id;
    const board = event.target;
    const reader = globalThis.ChessAnalyzerBoardReader;
    if (typeof id !== 'string' || id.length > 100 || !reader.isBoard(board)) return;
    let state;
    try { state = reader.getBoardState(board); }
    catch { state = { allowed: false, fen: null, reason: 'Không đọc được state của Chess.com.' }; }
    window.postMessage({ channel: 'chess-analyzer:state', id, state }, location.origin);
  });
})();
