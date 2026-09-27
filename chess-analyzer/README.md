# Chess Analyzer — Bước 1–10

Một ON/OFF điều khiển phân tích realtime bằng Stockfish WASM local, gồm cả ván với người thật đang diễn ra. ON tự đọc vị trí trên board được hỗ trợ; OFF dừng search, terminate worker, ngắt observer, xóa overlay và panel. Không có nút Analyze hoặc Auto Analyze riêng.

## Cập nhật / cài extension

1. Mở `chrome://extensions`, bật **Developer mode**.
2. Nếu đã cài bản cũ, nhấn **Reload** trên thẻ Chess Analyzer. Nếu chưa cài, chọn **Load unpacked** rồi chọn thư mục `chess-analyzer` trong repository vừa tải về.
3. Reload tab Chess.com **một lần** để Chrome inject code mới. Đây chỉ là bước khi cài/cập nhật extension.
4. Mở Analysis, Computer hoặc ván online trên Chess.com.
5. Mở popup → bật **ON**, chọn Fast/Strong/Deep và **Ngôn ngữ / Language** là Tiếng Việt hoặc English. Các lựa chọn có hiệu lực ngay, không reload trang.

Khi đọc được FEN đầy đủ và khớp board, panel hiển thị depth/eval/PV trong lúc engine nghĩ, sau đó vẽ mũi tên trực tiếp trên bàn cờ của trang. Khi không đọc được state, panel nêu lý do và không gửi vị trí phỏng đoán cho Stockfish.

Không cần npm, server hoặc tải thêm engine để sử dụng bản đã đóng gói. Popup chỉ điều khiển ON/OFF, mức phân tích và hiển thị trạng thái kết nối với tab.

## Các trang được hỗ trợ

Quy tắc tập trung trong `board-reader.js` → `getPageScope()` và `isAnalysisAllowed()`:

| Trang | Điều kiện |
| --- | --- |
| `/analysis` | Phân tích khi có board và FEN đầy đủ |
| `/play/computer`, `/play/bots` | Phân tích computer/bot |
| `/play/online`, `/live` | Phân tích cả trong ván với người thật đang diễn ra |
| `/game/<id>` | Hỗ trợ URL game trực tiếp, ví dụ `/game/184441026460` |
| `/game/live/<id>`, `/game/daily/<id>`, `/analysis/game/live/<id>`, `/analysis/game/daily/<id>` | Phân tích vị trí đang hiển thị, bất kể ván đang chơi hay đã kết thúc |
| Home, watch, puzzles, variants, route khác | Chưa hỗ trợ |

Từ bản 0.3.0, không yêu cầu `isGameOver()`, kết quả ván hoặc trạng thái kết thúc; không chặn theo `isOnlineGame()`. Việc chọn route độc lập với kiểm tra dữ liệu: chỉ gửi Stockfish khi FEN đủ 6 trường, hợp lệ theo validator và khớp quân trên DOM.

Trên các trang chưa hỗ trợ, board observer và engine được ngắt. Khi chuyển SPA sang một trang được hỗ trợ và setting vẫn ON, extension tự tìm board và bắt đầu phân tích.

## Runtime và dữ liệu

```text
Chess.com board/state (MAIN world, chỉ đọc)
  → snapshot FEN trong RAM
  → content.js (ISOLATED world): kiểm tra scope, FEN, DOM và generation
  → MessagePort → panel.html (extension origin)
  → engine.js → một Stockfish Worker + WASM local
  → info/bestmove qua MessagePort
  → content.js loại kết quả cũ → panel + SVG trên board thật
```

Content script không thể đọc trực tiếp biến JS của trang từ isolated world. Vì vậy `page-bridge.js` chạy trong MAIN world, chỉ trả dữ liệu state. Bridge không có engine, quyền extension, network, thao tác click hoặc di chuyển quân. Các file chạy đều nằm trong extension package.

Worker chạy trong `panel.html` thuộc origin `chrome-extension://…`, tránh lỗi cross-origin khi tạo Worker từ origin Chess.com. Content script kết nối bằng MessageChannel, kiểm tra request/generation và FEN trước khi render.

`chrome.storage.local` chỉ ghi `enabled`, `analysisMode`, `language` (`vi` hoặc `en`) và `panelPosition` nếu panel đã được kéo. Popup xóa setting `skillLevel` cũ khi mở sau khi nâng cấp. `panelPosition` là hai tỷ lệ x/y nhỏ (0–1) để giữ vị trí sau khi tải lại trang và tự điều chỉnh khi cửa sổ đổi kích thước; nút **Về cạnh bàn cờ** xóa setting này. Chọn ngôn ngữ trong popup sẽ đổi ngay các nhãn và kết quả đang hiển thị ở panel, không chạy lại Stockfish. FEN, eval, PV và kết quả đang hiển thị chỉ tồn tại trong RAM; không có file trung gian, database, REST API hoặc lịch sử. Giữ tối đa kết quả vị trí hiện tại để không chạy lại chỉ vì board được dựng lại hoặc lật. OFF xóa dữ liệu phân tích.

## Các bước và file

Mã nguồn thực tế nằm trong các file của thư mục extension này.

| Bước | File | Trách nhiệm |
| --- | --- | --- |
| 1 | `manifest.json`, `popup/*`, `content.js` | MV3, một ON/OFF, settings và inject |
| 2 | `engine.js`, `engine/stockfish.js`, `engine/stockfish.wasm` | Worker local, handshake UCI, 3 mức search, Hash 64 MB |
| 3 | `engine.js`, `utils.js` | Parse depth, cp/mate, bounds, PV, bestmove/promotion |
| 4 | `overlay.js` | SVG mũi tên theo nước đi và góc nhìn của board |
| 5 | `board-reader.js` | Tìm board, đọc quân/ô/màu, orientation, kích thước |
| 6 | `board-reader.js`, `page-bridge.js`, `utils.js` | Lấy FEN đủ 6 trường, kiểm tra metadata và đối chiếu DOM |
| 7 | `content.js`, `board-reader.js` | Một MutationObserver, debounce 200 ms, khử trùng vị trí |
| 8 | `overlay.js`, `content.css` | Một ResizeObserver, vị trí overlay theo board, flip/resize/scroll không search lại |
| 9 | `panel.html`, `panel.css`, `panel.js`, `move-display.js` | Panel kéo thả, giải thích nhập thành, quyền nhập thành và PV |
| 10 | `content.js`, `engine.js` | SPA, cleanup, chặn kết quả stale, timeout, lỗi engine, board tải muộn/thay thế |

`content.js` dùng các helper của board reader; selector/state phụ thuộc Chess.com không nằm trong engine hoặc overlay.

### Bước 5 — đọc board

Board reader ưu tiên `wc-chess-board`, `chess-board`, có fallback `[data-chessboard]`, `.chessboard`. Khi phải tìm board, chọn candidate hiển thị lớn nhất. Sau khi tìm được, giữ tham chiếu; không query toàn bộ DOM liên tục.

Các hàm có sẵn trong `globalThis.ChessAnalyzerBoardReader`:

```js
findBoard();
getOrientation(board);
readPieces(board);        // { ok, pieces: Map<square, FEN-piece> } hoặc lý do lỗi
getFen(board);            // { fen, source, reason }
getBoardState(board);     // scope + orientation + FEN
isAnalysisAllowed(board);
```

Adapter đọc `.piece.wp.square-52` hoặc `[data-piece="wp"][data-square="e2"]`. `square-52` luôn là e2, không đảo square theo góc nhìn. Orientation lấy từ thuộc tính, class `.flipped`, hoặc đối chiếu tọa độ các quân. Hỗ trợ nội dung trong open shadow root của board; closed shadow DOM/canvas không có state tương ứng sẽ không được suy đoán.

### Bước 6 — FEN đầy đủ

Ưu tiên nguồn:

1. `board.game.getFEN()`;
2. `board.game.getFen()`;
3. `board.getFEN()`;
4. thuộc tính `data-fen` hoặc `fen` trên **board đang đọc**.

Phải có đủ placement, side-to-move, castling rights, en passant, halfmove và fullmove. Placement từ FEN phải trùng các quân đang hiển thị; content script kiểm tra lại sau khi nhận reply. Không lấy FEN từ một input bất kỳ có thể thuộc vị trí khác. Không đoán metadata từ vị trí vua/xe/tốt.

`validateFen()` kiểm tra cấu trúc, số ô/quân/vua, một số trạng thái không hợp lệ, tính nhất quán cơ bản của castling và en passant. Nó không chứng minh toàn bộ lịch sử ván cờ là hợp lệ. Nguồn FEN của board là điều kiện bắt buộc trước khi phân tích.

Board chuyển động, các quân trùng square, FEN và DOM chưa đồng bộ hoặc thiếu metadata → xóa arrow/dừng search, hiển thị lý do. Có tối đa 5 lần đọc lại với thời gian chờ tăng dần khi khởi tạo chưa sẵn sàng; sau đó chờ mutation/navigation/setting. Không dùng `setInterval()`.

### Bước 7–8 — theo dõi và overlay

Một MutationObserver theo dõi các thay đổi liên quan board và node chứa board. Bỏ qua mutation do panel/overlay của extension. Thay đổi quân/FEN vô hiệu hóa kết quả ngay, gửi stop và chờ debounce 200 ms trước khi đọc state ổn định. Thay đổi giao diện, resize hoặc flip không đổi FEN thì không khởi động search mới.

Overlay nằm trong host `position: absolute` gắn vào body, trùng rect của board. Không thay đổi các node con do Chess.com quản lý. SVG có `pointer-events: none`, opacity 0.76. Mũi tên là một hình tô kín, đầu tam giác nhọn kết thúc tại tâm ô đích; không có nét tròn nhô qua đầu mũi tên. Một ResizeObserver theo dõi board; scroll/resize cập nhật tọa độ bằng requestAnimationFrame chỉ khi có sự kiện.

API:

```js
const overlay = new BoardOverlay(boardElement, 'white');
overlay.drawBestMoveArrow('e2e4');
overlay.drawArrow('e2', 'e4');
overlay.setOrientation('black');
overlay.clearArrow();
overlay.destroy();
```

### Bước 9–10 — panel và lifecycle

- Best move dùng from → to; promotion thêm quân phong cấp. Nhập thành hiển thị `O-O · Nhập thành cánh vua` hoặc `O-O-O · Nhập thành cánh hậu`, kèm đường đi của cả vua và xe. Arrow trên board chỉ nước đi của vua.
- Evaluation quy về phía Trắng. Dấu dương nghĩa là Trắng tốt hơn; mate hiển thị `M+N` hoặc `M−N`.
- PV dùng UCI; nước nhập thành được ghi như `O-O (e1g1)` / `O-O-O (e8c8)`. Module hiển thị theo dõi quân qua từng nước của PV để không nhầm một nước xe e1g1 với nhập thành. Không chuyển toàn bộ PV sang SAN và không thay đổi dữ liệu gửi cho Stockfish.
- Generation của controller và engine bảo vệ cả panel lẫn arrow; `info`/`bestmove` cũ bị bỏ qua.
- Search mới chờ `bestmove` kết thúc search cũ và `readyok` trước `position` tiếp theo.
- Worker dùng lại giữa các vị trí. OFF hoặc chuyển sang trang chưa hỗ trợ sẽ terminate.
- Navigation API xử lý `pushState`/`replaceState`; `popstate`, `pagehide` và khôi phục từ back/forward cache cũng được xử lý.
- Engine lỗi/timeout sẽ được giải phóng; panel hướng dẫn tắt rồi bật lại, không tạo vòng lặp worker lỗi.

### Kéo panel và đọc thông tin nhập thành (0.4.0)

- Giữ chuột ở tiêu đề **Chess Analyzer / KÉO ĐỂ DI CHUYỂN** rồi kéo panel đến vị trí mong muốn. Hỗ trợ pointer capture để kéo vượt khỏi vùng iframe.
- Khi tiêu đề được focus bằng Tab, dùng phím mũi tên để dịch 10 px; Shift + mũi tên dịch 40 px.
- Nút **Về cạnh bàn cờ** khôi phục vị trí tự động. Panel được giới hạn trong cửa sổ, tiêu đề luôn ở ngoài vùng cuộn nội dung để dễ kéo.
- Vị trí kéo được lưu vào `chrome.storage.local` sau khi thả chuột hoặc dùng phím mũi tên; tải lại tab, bật/tắt extension hoặc khởi động lại Chrome vẫn giữ vị trí. Vị trí tính theo tỷ lệ cửa sổ để panel không ra ngoài màn hình khi đổi kích thước. Không lưu FEN hay kết quả phân tích.
- **Quyền nhập thành từ FEN** cho biết quyền còn lại cho Trắng/Đen. Ví dụ `Trắng: O-O, O-O-O` nghĩa là chưa mất hai quyền đó, không khẳng định cả hai nước đều hợp lệ ngay bây giờ.
- Đường đi còn quân, vua đang bị chiếu, hoặc ô vua đi qua/đến bị tấn công vẫn ngăn nhập thành. Stockfish xét các điều kiện hợp lệ khi chọn bestmove; dòng quyền không phải một khuyến nghị nhập thành.

## Stockfish đã đóng gói

**Stockfish.js 18.0.8 lite-single**, một thread, Hash 64 MB:

| File gốc | File local |
| --- | --- |
| `bin/stockfish-18-lite-single.js` | `engine/stockfish.js` |
| `bin/stockfish-18-lite-single.wasm` | `engine/stockfish.wasm` |
| `Copying.txt` | `engine/COPYING.txt` |

`engine/worker.js` là bootstrap local của extension: tải loader gốc bằng `importScripts`, chỉ định URL WASM rõ ràng, chuyển lỗi tải/biên dịch về UI. Hai file upstream JS/WASM không bị chỉnh sửa và vẫn giữ checksum trong provenance.

WASM khoảng 7.3 MB, JS khoảng 21 KB; NNUE đã nằm trong build. Không tải remote JS/WASM lúc runtime. Giữ hai file cùng phiên bản.

Khởi tạo: `uci` → `uciok` → `isready` → `readyok`, cấu hình `MultiPV=1`, `Hash=64`, rồi `isready` lần nữa. Fast = 500 ms, Strong = 2000 ms mặc định, Deep = 5000 ms. Thời gian tải WASM không tính trong movetime.

Bản lite nhỏ và yếu hơn bản full. Tùy chọn `threads` trong `engine.js` kiểm tra UCI option và môi trường; UI không đưa ra multi-thread cho build single hiện tại. Muốn dùng multi-thread cần thay build và cấu hình môi trường phù hợp.

Nguồn tải và checksum của các asset đã đóng gói nằm trong `engine/PROVENANCE.json`.

Stockfish dùng GPLv3. Giữ license và cung cấp corresponding source/build scripts đúng phiên bản nếu phân phối binary: [upstream Stockfish.js](https://github.com/nmrugg/stockfish.js), [package 18.0.8](https://www.npmjs.com/package/stockfish/v/18.0.8).

## Debug

### Khi ON nhưng chưa có mũi tên

Popup hiển thị trạng thái thực tế từ tab đang mở: chưa kết nối content script, chưa tìm thấy board, thiếu FEN, panel không phản hồi, đang phân tích hoặc hoàn tất. Trạng thái được đẩy qua kết nối runtime khi thay đổi, không polling và không lưu vào storage.

Bản 0.3.1 sửa trường hợp URL `/game/<id>` bị bỏ qua ở bản cũ. Nếu popup báo chưa kết nối, reload tab sau khi reload extension; ON trong popup chỉ là setting, không chứng minh content script đã được inject. Nếu panel không tải được, popup sẽ báo sau 8 giây thay vì chờ im lặng.

Bản 0.3.2 sửa lỗi Worker không khởi động khi panel nhúng trên trang có COEP: đã tái hiện lỗi cũ bằng fixture có `Cross-Origin-Embedder-Policy: require-corp`. Manifest thêm `cross_origin_embedder_policy: { "value": "require-corp" }` để tài nguyên extension có policy tương ứng. Không thay policy của Chess.com, không bật remote code và vẫn dùng engine một thread. Xem [Chrome: manifest COEP](https://developer.chrome.com/docs/extensions/reference/manifest/cross-origin-embedder-policy).

### Content script / board reader

DevTools trên Chess.com → Console:

```text
[Chess Analyzer] content.js injected — local board analysis.
```

Trong execution context **top** của trang (MAIN world), kiểm tra không thay đổi ván cờ:

```js
const reader = globalThis.ChessAnalyzerBoardReader;
const board = reader.findBoard();
reader.isAnalysisAllowed(board);
reader.getOrientation(board);
reader.getFen(board);
```

Đây chỉ là xem dữ liệu trong RAM của DevTools. Module không tự log/lưu FEN hoặc Stockfish output.

Trong DevTools của popup (chuột phải popup → Inspect):

```js
await chrome.storage.local.get(null); // enabled, analysisMode, language; panelPosition nếu đã di chuyển
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
await chrome.tabs.sendMessage(tab.id, { type: 'ANALYZER_PING' });
```

Ping trả trạng thái observer/board/search và thông báo hiện tại, không chứa lịch sử. Khi OFF, `observing` và `searching` phải false.

### Engine

DevTools → chọn context iframe `panel.html`; **Sources → Threads** có worker khi đã bắt đầu phân tích. Network phải tải `stockfish.js` và `stockfish.wasm` từ `chrome-extension://…`. OFF/chuyển sang trang chưa hỗ trợ làm worker biến mất. Đặt breakpoint ở `_send()`/`_line()` trong `engine.js` để xem UCI trong RAM.

### Lỗi cần kiểm tra

| Thông báo | Kiểm tra |
| --- | --- |
| Không có log inject / `Extension context invalidated` | Reload tab sau khi cài/cập nhật extension; kiểm tra Site access của Chrome |
| `Không có FEN đầy đủ…` | `board.game`/API của Chess.com khác adapter hiện tại; sửa các nguồn trong `getFen()` |
| `FEN ... chưa khớp` | Board đang animation, state chưa theo kịp DOM hoặc adapter đang đọc sai board |
| `Không đọc được mã quân hoặc ô cờ` | Chess.com đổi class/attributes; sửa `readPieces()` |
| Vẫn hiện `Chưa xác nhận game đã kết thúc` | Tab đang chạy code bản cũ; reload extension và tab để dùng bản mới |
| `Không nhận được state` | MAIN bridge chưa inject, script bị lỗi hoặc tab còn code cũ |
| `ERR_FILE_NOT_FOUND`, `Failed to fetch` | Thiếu/sai tên JS/WASM hoặc load nhầm thư mục |
| CSP violation / `Refused to compile WebAssembly` | Manifest phải có `wasm-unsafe-eval`; Worker chạy trong extension origin |
| `Failed to construct Worker`, `SecurityError` | Kiểm tra origin panel; không tạo Worker từ code thuộc origin Chess.com |
| `CompileError`, `LinkError`, `Aborted(...)` | Loader/WASM khác phiên bản hoặc file bị hỏng |
| Timeout `uciok`, `readyok`, `stop` | Xem Network/worker console; wrapper giải phóng worker và báo lỗi |
| `Không tải được engine/worker.js` | Worker chưa chạy bootstrap: kiểm tra đã reload bản 0.3.2, COEP/CSP và file worker.js |
| `Stockfish lỗi khi tải WASM` / `biên dịch WASM` | UI giữ chi tiết gốc từ fetch/CompileError; kiểm tra file và phiên bản trình duyệt |

CSP chỉ cho script/worker/connect từ extension, bật `wasm-unsafe-eval`; không có `eval()`, `new Function()` hoặc inline JavaScript trong extension HTML. Tài liệu: [Chrome CSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy), [content script isolated world](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).

## Kiểm thử và giới hạn đã biết

Trong quá trình phát triển, đã kiểm thử parser/FEN, UCI race/timeout/stop, extension MV3 và WASM thật, dữ liệu realtime, ON/OFF, nhớ settings, DOM/state bridge, board tải muộn, thay board, cập nhật position, mismatch/thiếu metadata, flip/resize/scroll, SPA vào/ra và ván online có state đang chơi. Không ghi screenshot, trace hoặc kết quả phân tích ra file.

**DOM/state của Chess.com production chưa được xác minh thành công trong môi trường này:** cả Analysis và Computer dừng tại trang “Just a moment…” trong Chromium tự động, không có node board. Không thực hiện bypass; chưa kiểm thử trên ván người thật tại Chess.com. Bài kiểm thử phát triển đã dùng fixture mô phỏng DOM/API Chess.com và Stockfish WASM thật. API như `board.game.getFEN()` là adapter cần đối chiếu khi site thay đổi, không phải API công khai được Chess.com cam kết ổn định. Nếu không tương thích, extension báo thiếu dữ liệu và không phân tích; không tự bịa FEN.

Chỉ đọc board hiển thị lớn nhất; chưa hỗ trợ đồng thời nhiều board, Chess960 hoặc biến thể. Mỗi tab/frame phân tích là một instance, tối đa một worker. Hash 64 MB là bộ nhớ bảng hash, không phải giới hạn tổng RAM của WASM.
