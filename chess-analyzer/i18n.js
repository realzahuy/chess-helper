export const LANGUAGES = Object.freeze(['vi', 'en']);

const messages = {
  vi: {
    status: 'Trạng thái', analysis: 'Phân tích', language: 'Ngôn ngữ',
    toggleLabel: 'Bật hoặc tắt Chess Analyzer',
    off: 'OFF · Đã dừng phân tích.',
    oldTab: 'Tab đang chạy code bản cũ. Reload tab Chess.com để nạp bản mới.',
    waitingTab: 'Đang chờ trạng thái từ trang…',
    checkingTab: 'Đang kiểm tra kết nối với tab…',
    noTab: 'Không tìm thấy tab hiện tại.',
    disconnected: 'Chưa kết nối được với tab. Mở Chess.com rồi reload tab sau khi cài/cập nhật extension. Kiểm tra Site access nếu vẫn lỗi.',
    connectError: 'Không kết nối được với tab: {detail}',
    saveError: 'Không lưu được cài đặt: {detail}',
    settingsError: 'Không đọc được cài đặt: {detail}',
    found: 'đã tìm thấy', missing: 'chưa tìm thấy', connected: 'đã kết nối', disconnectedShort: 'chưa kết nối',
    connectionDetails: 'Bàn cờ: {board} · Panel: {panel}',
    dragLabel: 'Di chuyển panel: kéo hoặc dùng phím mũi tên',
    dragTitle: 'Kéo để di chuyển · Phím mũi tên để dịch chuyển',
    resetTitle: 'Đưa panel về cạnh bàn cờ', resetPosition: 'Về cạnh bàn cờ',
    bestMove: 'Nước đi tốt nhất', evaluation: 'Đánh giá · Trắng', depth: 'Độ sâu',
    pv: 'Biến chính · UCI / nhập thành', rights: 'Quyền nhập thành từ FEN',
    panelConnecting: 'Đang kết nối…', panelWaiting: 'Đang chờ vị trí…', panelOff: 'OFF',
    castleBest: '{notation} · Nhập thành {side}',
    castleDetail: 'Vua {kingFrom} → {kingTo}; xe {rookFrom} → {rookTo}.',
    kingSide: 'cánh vua', queenSide: 'cánh hậu', white: 'Trắng', black: 'Đen',
    noRights: 'không còn quyền', rightsSummary: '{white}: {whiteRights} · {black}: {blackRights}',
  },
  en: {
    status: 'Status', analysis: 'Analysis', language: 'Language',
    toggleLabel: 'Turn Chess Analyzer on or off',
    off: 'OFF · Analysis stopped.',
    oldTab: 'This tab is running an older extension version. Reload the Chess.com tab.',
    waitingTab: 'Waiting for page status…',
    checkingTab: 'Checking the current tab…',
    noTab: 'No active tab found.',
    disconnected: 'Could not connect to this tab. Open Chess.com and reload the tab after installing or updating the extension. Check Site access if this continues.',
    connectError: 'Could not connect to the tab: {detail}',
    saveError: 'Could not save settings: {detail}',
    settingsError: 'Could not read settings: {detail}',
    found: 'found', missing: 'not found', connected: 'connected', disconnectedShort: 'not connected',
    connectionDetails: 'Board: {board} · Panel: {panel}',
    dragLabel: 'Move panel: drag or use arrow keys',
    dragTitle: 'Drag to move · Arrow keys to reposition',
    resetTitle: 'Move the panel back beside the board', resetPosition: 'Beside board',
    bestMove: 'Best move', evaluation: 'Evaluation · White', depth: 'Depth',
    pv: 'Best line · UCI / castling', rights: 'Castling rights from FEN',
    panelConnecting: 'Connecting…', panelWaiting: 'Waiting for a position…', panelOff: 'OFF',
    castleBest: '{notation} · {side} castling',
    castleDetail: 'King {kingFrom} → {kingTo}; rook {rookFrom} → {rookTo}.',
    kingSide: 'kingside', queenSide: 'queenside', white: 'White', black: 'Black',
    noRights: 'none', rightsSummary: '{white}: {whiteRights} · {black}: {blackRights}',
  },
};

export function t(key, language = 'vi', values = {}) {
  const template = (messages[language] || messages.vi)[key] || messages.vi[key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(values[name] ?? ''));
}

const englishStatuses = new Map([
  ['Đang khởi tạo extension…', 'Starting the extension…'],
  ['Đang chờ bàn cờ…', 'Waiting for the board…'],
  ['Đang kết nối panel Stockfish…', 'Connecting the Stockfish panel…'],
  ['Đang tìm bàn cờ…', 'Looking for the board…'],
  ['Đang kết nối…', 'Connecting…'],
  ['Đang chờ vị trí…', 'Waiting for a position…'],
  ['Đang chờ bàn cờ tải…', 'Waiting for the board to load…'],
  ['Đang phân tích…', 'Analyzing…'],
  ['Đang nạp Stockfish…', 'Loading Stockfish…'],
  ['Stockfish sẵn sàng', 'Stockfish ready'],
  ['Hoàn tất', 'Complete'],
  ['Không có nước đi hợp lệ', 'No legal moves'],
  ['Panel Stockfish không phản hồi. Kiểm tra lỗi extension rồi reload tab.', 'The Stockfish panel did not respond. Check extension errors and reload the tab.'],
  ['Board vừa đổi; chờ vị trí ổn định.', 'The board changed; waiting for a stable position.'],
  ['Trang này chưa được hỗ trợ phân tích.', 'This page is not supported.'],
  ['Đường dẫn trang này chưa được hỗ trợ phân tích.', 'This page URL is not supported.'],
  ['Không nhận được state của trang. Reload tab nếu vừa cập nhật extension.', 'Could not read the page state. Reload the tab if the extension was just updated.'],
  ['Chưa tìm thấy bàn cờ.', 'Board not found.'],
  ['Đang chờ bàn cờ tải…', 'Waiting for the board to load…'],
  ['Quân cờ chưa tải xong.', 'Pieces have not loaded yet.'],
  ['Không đọc được mã quân hoặc ô cờ; cần cập nhật board-reader.js.', 'Could not read a piece or square; board-reader.js may need an update.'],
  ['Bàn cờ đang kéo quân/chuyển động; chờ vị trí ổn định.', 'A piece is being dragged or animated; waiting for a stable board.'],
  ['Chưa xác định được hướng bàn cờ.', 'Board orientation is not available yet.'],
  ['FEN trong state chưa khớp các quân đang hiển thị; đang chờ board ổn định.', 'The page FEN does not match the visible pieces; waiting for the board to settle.'],
  ['Không có FEN đầy đủ từ state/thuộc tính board. Không suy đoán lượt, nhập thành hoặc en passant.', 'The board does not provide a complete FEN. Turn, castling rights, and en passant will not be guessed.'],
  ['Không đọc được state của Chess.com.', 'Could not read the Chess.com board state.'],
  ['Không đọc được settings.', 'Could not read settings.'],
  ['Không lưu được vị trí panel.', 'Could not save the panel position.'],
]);

export function localizeStatus(value, language = 'vi') {
  if (language !== 'en' || !value) return value;
  if (englishStatuses.has(value)) return englishStatuses.get(value);
  const translated = value.replace(/^FEN không hợp lệ: /, 'Invalid FEN: ')
    .replace(/^Lỗi engine: /, 'Engine error: ')
    .replace(/^Không khởi tạo được extension: /, 'Could not start the extension: ')
    .replace(/\. Hãy tắt rồi bật lại\.$/, '. Turn the extension off and on again.')
    .replace(/\. Hãy reload extension và tab\.$/, '. Reload the extension and tab.');
  const errors = [
    ['Stockfish Worker gặp lỗi.', 'Stockfish Worker failed.'],
    ['Stockfish search hết thời gian chờ.', 'Stockfish search timed out.'],
    ['Stockfish không xác nhận stop.', 'Stockfish did not confirm stop.'],
    ['Stockfish Worker chưa sẵn sàng.', 'Stockfish Worker is not ready.'],
    ['Không đọc được thông điệp Stockfish.', 'Could not read a Stockfish message.'],
    ['Stockfish trả bestmove không hợp lệ.', 'Stockfish returned an invalid bestmove.'],
    ['Engine đã đóng. Hãy tạo instance mới.', 'The engine was closed. Create a new instance.'],
    ['Engine đã đóng.', 'The engine was closed.'],
    ['Build/môi trường hiện tại không hỗ trợ số Threads đã chọn.', 'The current build or environment does not support the selected thread count.'],
    ['Analysis mode không hợp lệ.', 'Invalid analysis mode.'],
    ['FEN phải là chuỗi.', 'FEN must be a string.'],
    ['FEN cần đủ 6 trường.', 'FEN requires all six fields.'],
    ['FEN cần 8 hàng.', 'FEN requires eight ranks.'],
    ['FEN có hai chữ số liền nhau.', 'FEN has consecutive digits in one rank.'],
    ['Tốt ở hàng 1 hoặc 8.', 'A pawn is on rank 1 or 8.'],
    ['FEN chứa ký tự quân không hợp lệ.', 'FEN contains an invalid piece symbol.'],
    ['Mỗi hàng FEN phải có đúng 8 ô.', 'Every FEN rank must contain eight squares.'],
    ['FEN phải có đúng một vua mỗi bên.', 'FEN must contain exactly one king per side.'],
    ['FEN có quá nhiều quân hoặc tốt.', 'FEN has too many pieces or pawns.'],
    ['Hai vua không thể đứng sát nhau.', 'The two kings cannot be adjacent.'],
    ['Side to move phải là w hoặc b.', 'Side to move must be w or b.'],
    ['Castling rights không hợp lệ.', 'Invalid castling rights.'],
    ['Castling rights không khớp vị trí vua/xe.', 'Castling rights do not match the king and rook positions.'],
    ['Ô en passant không hợp lệ với bên đến lượt.', 'The en passant square does not match the side to move.'],
    ['En passant không khớp vị trí tốt.', 'En passant does not match the pawn position.'],
    ['Halfmove/fullmove không hợp lệ.', 'Invalid halfmove or fullmove counter.'],
    ['En passant yêu cầu halfmove bằng 0.', 'En passant requires a halfmove clock of zero.'],
  ];
  let result = translated;
  for (const [source, target] of errors) result = result.replace(source, target);
  return result;
}
