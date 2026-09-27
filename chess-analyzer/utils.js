export const MODES = Object.freeze({ fast: 500, strong: 2000, deep: 5000 });
export const DEFAULT_SETTINGS = Object.freeze({ enabled: false, analysisMode: 'strong', language: 'vi' });

export function normalizeSettings(value = {}) {
  return {
    enabled: value.enabled === true,
    analysisMode: Object.hasOwn(MODES, value.analysisMode) ? value.analysisMode : 'strong',
    language: value.language === 'en' ? 'en' : 'vi',
  };
}

// Normalized viewport coordinates keep the panel visible across window sizes.
export function normalizePanelPosition(value) {
  if (!value || typeof value !== 'object' ||
      !Number.isFinite(value.x) || !Number.isFinite(value.y) ||
      value.x < 0 || value.x > 1 || value.y < 0 || value.y > 1) return null;
  return { x: value.x, y: value.y };
}

export function parseUciMove(move) {
  if (typeof move !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return null;
  const from = move.slice(0, 2);
  const to = move.slice(2, 4);
  if (from === to) return null;
  return { from, to, promotion: move[4] ?? null };
}

// Structural validation, not a proof that a position has a legal game history.
// All six metadata fields must be supplied; none are inferred from piece placement.
export function validateFen(input) {
  if (typeof input !== 'string') throw new Error('FEN phải là chuỗi.');
  const fields = input.trim().split(/\s+/);
  if (fields.length !== 6) throw new Error('FEN cần đủ 6 trường.');
  const [placement, turn, castling, ep, halfmove, fullmove] = fields;
  const ranks = placement.split('/');
  if (ranks.length !== 8) throw new Error('FEN cần 8 hàng.');
  const pieces = new Map();
  for (const [index, rank] of ranks.entries()) {
    let file = 0;
    if (/\d\d/.test(rank)) throw new Error('FEN có hai chữ số liền nhau.');
    for (const token of rank) {
      if (/^[1-8]$/.test(token)) file += Number(token);
      else if (/^[prnbqkPRNBQK]$/.test(token)) {
        const square = `${String.fromCharCode(97 + file)}${8 - index}`;
        pieces.set(square, token);
        file += 1;
        if ((index === 0 || index === 7) && /p/i.test(token)) throw new Error('Tốt ở hàng 1 hoặc 8.');
      } else throw new Error('FEN chứa ký tự quân không hợp lệ.');
    }
    if (file !== 8) throw new Error('Mỗi hàng FEN phải có đúng 8 ô.');
  }
  const values = [...pieces.values()];
  if (values.filter(p => p === 'K').length !== 1 || values.filter(p => p === 'k').length !== 1) {
    throw new Error('FEN phải có đúng một vua mỗi bên.');
  }
  for (const white of [true, false]) {
    const side = values.filter(p => (p === p.toUpperCase()) === white);
    if (side.length > 16 || side.filter(p => p.toLowerCase() === 'p').length > 8) {
      throw new Error('FEN có quá nhiều quân hoặc tốt.');
    }
  }
  const whiteKing = [...pieces].find(([, p]) => p === 'K')[0];
  const blackKing = [...pieces].find(([, p]) => p === 'k')[0];
  if (Math.abs(whiteKing.charCodeAt(0) - blackKing.charCodeAt(0)) <= 1 &&
      Math.abs(Number(whiteKing[1]) - Number(blackKing[1])) <= 1) {
    throw new Error('Hai vua không thể đứng sát nhau.');
  }
  if (!/^[wb]$/.test(turn)) throw new Error('Side to move phải là w hoặc b.');
  if (!/^(?:-|K?Q?k?q?)$/.test(castling)) throw new Error('Castling rights không hợp lệ.');
  const rights = { K: ['e1', 'K', 'h1', 'R'], Q: ['e1', 'K', 'a1', 'R'], k: ['e8', 'k', 'h8', 'r'], q: ['e8', 'k', 'a8', 'r'] };
  for (const right of castling === '-' ? [] : castling) {
    const [kingSquare, king, rookSquare, rook] = rights[right];
    if (pieces.get(kingSquare) !== king || pieces.get(rookSquare) !== rook) {
      throw new Error('Castling rights không khớp vị trí vua/xe.');
    }
  }
  if (ep !== '-') {
    if (!/^[a-h][36]$/.test(ep) || ep[1] !== (turn === 'w' ? '6' : '3')) {
      throw new Error('Ô en passant không hợp lệ với bên đến lượt.');
    }
    const pawnSquare = ep[0] + (turn === 'w' ? '5' : '4');
    const originSquare = ep[0] + (turn === 'w' ? '7' : '2');
    if (pieces.has(ep) || pieces.has(originSquare) || pieces.get(pawnSquare) !== (turn === 'w' ? 'p' : 'P')) {
      throw new Error('En passant không khớp vị trí tốt.');
    }
  }
  if (!/^\d+$/.test(halfmove) || !/^[1-9]\d*$/.test(fullmove) ||
      !Number.isSafeInteger(Number(halfmove)) || !Number.isSafeInteger(Number(fullmove))) {
    throw new Error('Halfmove/fullmove không hợp lệ.');
  }
  if (ep !== '-' && Number(halfmove) !== 0) throw new Error('En passant yêu cầu halfmove bằng 0.');
  return { fen: fields.join(' '), pieces, turn };
}

export function squareToCoordinates(square, rect, orientation = 'white') {
  if (!/^[a-h][1-8]$/.test(square)) throw new Error('Ô cờ không hợp lệ.');
  if (!['white', 'black'].includes(orientation)) throw new Error('Orientation không hợp lệ.');
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return {
    x: ((orientation === 'white' ? file : 7 - file) + 0.5) * rect.width / 8,
    y: ((orientation === 'white' ? 7 - rank : rank) + 0.5) * rect.height / 8,
  };
}

export function debounce(fn, delay = 200) {
  let timer;
  const wrapped = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; fn(...args); }, delay);
  };
  wrapped.cancel = () => { clearTimeout(timer); timer = undefined; };
  return wrapped;
}

export function formatEvaluation(score, turn) {
  if (!score) return '—';
  const value = score.value * (turn === 'b' ? -1 : 1);
  const bound = score.bound ? (score.bound === 'lowerbound' ? '≥ ' : '≤ ') : '';
  const whiteBound = turn === 'b' ? bound.replace('≥', 'TEMP').replace('≤', '≥').replace('TEMP', '≤') : bound;
  if (score.type === 'mate') return `${whiteBound}M${value < 0 ? '−' : '+'}${Math.abs(value)}`;
  return `${whiteBound}${value >= 0 ? '+' : ''}${(value / 100).toFixed(2)}`;
}
