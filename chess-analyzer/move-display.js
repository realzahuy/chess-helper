import { parseUciMove, validateFen } from './utils.js';
import { t } from './i18n.js';

const CASTLES = {
  e1g1: { king: 'K', right: 'K', rook: 'R', rookFrom: 'h1', rookTo: 'f1', notation: 'O-O', side: 'cánh vua' },
  e1c1: { king: 'K', right: 'Q', rook: 'R', rookFrom: 'a1', rookTo: 'd1', notation: 'O-O-O', side: 'cánh hậu' },
  e8g8: { king: 'k', right: 'k', rook: 'r', rookFrom: 'h8', rookTo: 'f8', notation: 'O-O', side: 'cánh vua' },
  e8c8: { king: 'k', right: 'q', rook: 'r', rookFrom: 'a8', rookTo: 'd8', notation: 'O-O-O', side: 'cánh hậu' },
};
const rookRights = { a1: 'Q', h1: 'K', a8: 'q', h8: 'k' };

function castleFor(move, pieces, rights) {
  const castle = CASTLES[move.from + move.to];
  return castle && !move.promotion && pieces.get(move.from) === castle.king &&
    pieces.get(castle.rookFrom) === castle.rook && rights.includes(castle.right) ? castle : null;
}

export function describeMove(fen, uci, language = 'vi') {
  const move = parseUciMove(uci);
  if (!move) return { label: '—', detail: '' };
  const { pieces } = validateFen(fen);
  const castle = castleFor(move, pieces, fen.split(/\s+/)[2]);
  if (castle) return {
    label: t('castleBest', language, { notation: castle.notation,
      side: t(castle.side === 'cánh vua' ? 'kingSide' : 'queenSide', language) }),
    detail: t('castleDetail', language, { kingFrom: move.from, kingTo: move.to,
      rookFrom: castle.rookFrom, rookTo: castle.rookTo }),
  };
  return { label: `${move.from} → ${move.to}${move.promotion ? ` = ${move.promotion.toUpperCase()}` : ''}`, detail: '' };
}

export function describeCastlingRights(fen, language = 'vi') {
  validateFen(fen);
  const rights = fen.trim().split(/\s+/)[2];
  const side = (king, queen) => [rights.includes(king) && 'O-O', rights.includes(queen) && 'O-O-O'].filter(Boolean).join(', ') || t('noRights', language);
  return t('rightsSummary', language, { white: t('white', language), whiteRights: side('K', 'Q'),
    black: t('black', language), blackRights: side('k', 'q') });
}

// Replay engine-supplied UCI only for display. This is not a legal-move validator.
// Track actual pieces so a rook's e1g1 later in the PV is never labeled castling.
export function formatPrincipalVariation(fen, pv) {
  const { pieces } = validateFen(fen);
  let rights = fen.trim().split(/\s+/)[2];
  const labels = [];
  for (const uci of pv) {
    const move = parseUciMove(uci);
    if (!move) break;
    const piece = pieces.get(move.from);
    if (!piece) break;
    const castle = castleFor(move, pieces, rights);
    labels.push(castle ? `${castle.notation} (${uci})` : uci);
    if (piece.toLowerCase() === 'p' && move.from[0] !== move.to[0] && !pieces.has(move.to)) {
      pieces.delete(move.to[0] + move.from[1]); // en passant in a legal engine PV
    }
    pieces.delete(move.from);
    pieces.set(move.to, move.promotion ? (piece === piece.toUpperCase() ? move.promotion.toUpperCase() : move.promotion) : piece);
    if (castle) { pieces.delete(castle.rookFrom); pieces.set(castle.rookTo, castle.rook); }
    if (piece === 'K') rights = rights.replace(/[KQ]/g, '');
    if (piece === 'k') rights = rights.replace(/[kq]/g, '');
    for (const square of [move.from, move.to]) if (rookRights[square]) rights = rights.replace(rookRights[square], '');
  }
  return labels.join(' ') || '—';
}
