// Loaded in both MAIN and ISOLATED worlds. All Chess.com selectors/state adapters live here.
// MAIN can read board.game; ISOLATED only uses DOM helpers. No engine or settings in MAIN.
(() => {
  if (globalThis.ChessAnalyzerBoardReader) return;
  const BOARD_SELECTOR = 'wc-chess-board, chess-board, [data-chessboard], .chessboard';
  const PIECE_SELECTOR = '.piece, [data-piece][data-square]';
  const call = (object, method) => {
    try { return typeof object?.[method] === 'function' ? object[method]() : undefined; }
    catch { return undefined; }
  };
  const rootOf = board => board.shadowRoot || board;

  function getPageScope(href = location.href) {
    const url = new URL(href);
    if (url.origin !== 'https://www.chess.com') return { kind: 'blocked', candidate: false };
    const path = url.pathname.replace(/\/$/, '');
    if (path === '/analysis') return { kind: 'analysis', candidate: true };
    if (/^\/play\/(computer|bots)(\/|$)/.test(path)) return { kind: 'computer', candidate: true };
    if (/^\/(play\/online|live)(\/|$)/.test(path)) return { kind: 'online', candidate: true };
    if (/^\/game\/\d+(\/|$)/.test(path)) return { kind: 'game', candidate: true };
    if (/^\/(analysis\/game|game)\/(live|daily)\/\d+(\/|$)/.test(path)) {
      return { kind: 'game', candidate: true };
    }
    // Watch, puzzles, variants and unknown routes are not supported by this adapter.
    return { kind: 'blocked', candidate: false };
  }

  function isVisibleBoard(board) {
    if (!board?.isConnected) return false;
    const rect = board.getBoundingClientRect();
    const style = getComputedStyle(board);
    return rect.width > 80 && rect.height > 80 && style.display !== 'none' && style.visibility !== 'hidden';
  }
  function findBoard() {
    const candidates = [...document.querySelectorAll(BOARD_SELECTOR)].filter(isVisibleBoard);
    candidates.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    return candidates[0] || null;
  }

  function readPieces(board = findBoard()) {
    if (!board?.isConnected) return { ok: false, reason: 'Chưa tìm thấy bàn cờ.' };
    const pieces = new Map();
    for (const element of rootOf(board).querySelectorAll(PIECE_SELECTOR)) {
      if (getComputedStyle(element).display === 'none' || element.classList.contains('ghost')) continue;
      const tokens = [...element.classList];
      const code = tokens.find(token => /^[wb][prnbqk]$/.test(token)) || element.getAttribute('data-piece');
      const token = tokens.find(token => /^square-[1-8][1-8]$/.test(token));
      let square = element.getAttribute('data-square');
      if (token) square = String.fromCharCode(96 + Number(token[7])) + token[8];
      if (!/^[wb][prnbqk]$/.test(code || '') || !/^[a-h][1-8]$/.test(square || '')) {
        return { ok: false, reason: 'Không đọc được mã quân hoặc ô cờ; cần cập nhật board-reader.js.' };
      }
      if (element.classList.contains('dragging') || pieces.has(square)) {
        return { ok: false, reason: 'Bàn cờ đang kéo quân/chuyển động; chờ vị trí ổn định.' };
      }
      pieces.set(square, code[0] === 'w' ? code[1].toUpperCase() : code[1]);
    }
    if (!pieces.size) return { ok: false, reason: 'Quân cờ chưa tải xong.' };
    return { ok: true, pieces };
  }

  function placementFromPieces(pieces) {
    const rows = [];
    for (let rank = 8; rank >= 1; rank--) {
      let row = '', empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = pieces.get(String.fromCharCode(97 + file) + rank);
        if (!piece) { empty++; continue; }
        if (empty) { row += empty; empty = 0; }
        row += piece;
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join('/');
  }

  function getOrientation(board = findBoard()) {
    if (!board) return null;
    for (const value of [board.getAttribute('orientation'), board.getAttribute('data-orientation'),
      call(board, 'getOrientation')]) {
      if (['white', 'w'].includes(value)) return 'white';
      if (['black', 'b'].includes(value)) return 'black';
    }
    if (board.classList.contains('flipped') || board.getAttribute('flipped') === 'true') return 'black';
    // Cross-check actual piece geometry. This also supports CSS-based orientation changes.
    const rect = board.getBoundingClientRect();
    let white = 0, black = 0;
    for (const piece of rootOf(board).querySelectorAll(PIECE_SELECTOR)) {
      const token = [...piece.classList].find(value => /^square-[1-8][1-8]$/.test(value));
      const square = token ? String.fromCharCode(96 + Number(token[7])) + token[8] : piece.getAttribute('data-square');
      if (!/^[a-h][1-8]$/.test(square || '')) continue;
      const p = piece.getBoundingClientRect();
      if (!p.width || !p.height) continue;
      const x = (p.left + p.width / 2 - rect.left) / rect.width * 8;
      const y = (p.top + p.height / 2 - rect.top) / rect.height * 8;
      const file = square.charCodeAt(0) - 97, rank = Number(square[1]) - 1;
      if (Math.abs(x - file - 0.5) < 0.3 && Math.abs(y - (7 - rank) - 0.5) < 0.3) white++;
      if (Math.abs(x - (7 - file) - 0.5) < 0.3 && Math.abs(y - rank - 0.5) < 0.3) black++;
    }
    if (white > black && white >= 2) return 'white';
    if (black > white && black >= 2) return 'black';
    // Known Chess.com custom elements default to white without .flipped.
    if (board.matches('wc-chess-board, chess-board')) return 'white';
    return null;
  }

  function isAnalysisAllowed(_board = null, href = location.href) {
    const scope = getPageScope(href);
    if (!scope.candidate) return { allowed: false, reason: 'Trang này chưa được hỗ trợ phân tích.' };
    // Page support is independent of opponent or game lifecycle. FEN validity and
    // consistency with visible pieces are checked separately before any search.
    const labels = { analysis: 'Analysis Board', computer: 'Computer / bot', online: 'Ván online', game: 'Ván cờ' };
    return { allowed: true, reason: labels[scope.kind], scope: scope.kind };
  }

  function getFen(board = findBoard()) {
    if (!board) return { fen: null, reason: 'Chưa tìm thấy bàn cờ.' };
    const candidates = [
      ['board.game.getFEN()', call(board.game, 'getFEN')],
      ['board.game.getFen()', call(board.game, 'getFen')],
      ['board.getFEN()', call(board, 'getFEN')],
      ['board[data-fen]', board.getAttribute('data-fen')],
      ['board[fen]', board.getAttribute('fen')],
    ];
    const pieces = readPieces(board);
    if (!pieces.ok) return { fen: null, reason: pieces.reason };
    const placement = placementFromPieces(pieces.pieces);
    let mismatch = false;
    for (const [source, raw] of candidates) {
      if (typeof raw !== 'string') continue;
      const fields = raw.trim().split(/\s+/);
      if (fields.length !== 6) continue;
      if (fields[0] !== placement) { mismatch = true; continue; }
      // The isolated controller validates all six fields again before sending to engine.
      return { fen: fields.join(' '), source, reason: null };
    }
    return { fen: null, reason: mismatch
      ? 'FEN trong state chưa khớp các quân đang hiển thị; đang chờ board ổn định.'
      : 'Không có FEN đầy đủ từ state/thuộc tính board. Không suy đoán lượt, nhập thành hoặc en passant.' };
  }

  function getBoardState(board = findBoard()) {
    const permission = isAnalysisAllowed(board);
    if (!permission.allowed) return { ...permission, fen: null };
    if (!isVisibleBoard(board)) return { ...permission, fen: null, reason: 'Đang chờ bàn cờ tải…' };
    const orientation = getOrientation(board);
    if (!orientation) return { ...permission, fen: null, reason: 'Chưa xác định được hướng bàn cờ.' };
    return { ...permission, ...getFen(board), orientation };
  }

  function classifyMutation(record, board) {
    const target = record.target;
    if (!(target instanceof Element)) return 'none';
    if (target.closest('[data-chess-analyzer-owned]')) return 'none';
    if (record.type === 'childList') {
      const changed = [...record.addedNodes, ...record.removedNodes].filter(node => node instanceof Element &&
        !node.hasAttribute('data-chess-analyzer-owned'));
      if (!changed.length) return 'none';
      if (board && (target === board || board.contains(target) || board.shadowRoot?.contains(target))) return 'position';
      if (changed.some(node => node === board || (board && node.contains(board)) ||
          node.matches(BOARD_SELECTOR) || node.querySelector(BOARD_SELECTOR))) return 'board';
      return 'none';
    }
    if (!board) return target.matches(BOARD_SELECTOR) ? 'board' : 'none';
    if (record.oldValue === target.getAttribute(record.attributeName)) return 'none';
    if (target === board) {
      return ['class', 'style', 'orientation', 'data-orientation', 'flipped'].includes(record.attributeName) ? 'layout' : 'position';
    }
    if (board.contains(target) || board.shadowRoot?.contains(target)) {
      if (!target.matches(PIECE_SELECTOR)) return 'state';
      if (record.attributeName === 'style') return 'layout';
      if (record.attributeName === 'class') {
        const signature = value => (value || '').split(/\s+/).filter(token =>
          /^(?:[wb][prnbqk]|square-[1-8][1-8]|dragging|ghost)$/.test(token)).sort().join(' ');
        if (signature(record.oldValue) === signature(target.className)) return 'layout';
      }
      return 'position';
    }
    if (target.contains(board)) return 'layout';
    return 'none';
  }

  globalThis.ChessAnalyzerBoardReader = Object.freeze({
    findBoard, isVisibleBoard, getOrientation, readPieces, placementFromPieces, getFen, getBoardState,
    isAnalysisAllowed, getPageScope, classifyMutation, rootOf,
    isBoard: element => element instanceof Element && element.matches(BOARD_SELECTOR),
  });
})();
