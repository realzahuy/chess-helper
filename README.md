# Chess Analyzer

**Language / Ngôn ngữ:** [English](#english) · [Tiếng Việt](#tiếng-việt)

## English

Chess Analyzer is a Chrome extension that shows Stockfish's suggested move as an arrow on a Chess.com board. Analysis runs locally in your browser.

### Requirements

- Google Chrome 120 or newer.
- The complete `chess-analyzer` folder, including the Stockfish files in `chess-analyzer/engine`.

### Install

1. On GitHub, select **Code → Download ZIP** and extract the repository.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Select **Load unpacked** and choose the extracted `chess-analyzer` folder containing `manifest.json`.

### Use

1. Open a chessboard on Chess.com. Reload the tab once if it was open before installation.
2. Open the **Chess Analyzer** popup and switch it **ON**.
3. Choose **Fast**, **Strong**, or **Deep**. The analysis panel and arrow update automatically.
4. Drag the panel by its heading to move it. Select **Beside board** to reset its position.
5. Select **Language → English** or **Tiếng Việt** in the popup. The panel updates immediately and remembers your choice.
6. Switch **OFF** to stop analysis and clear the arrow.

### Help

- **ON but no arrow:** read the status in the popup. Reload the Chess.com tab if it is not connected. If a complete FEN is unavailable, the extension waits for board data.
- **Stockfish Worker error:** select **Reload** for the extension at `chrome://extensions`, then reload the Chess.com tab.
- **Updating the extension:** reload the extension and the Chess.com tab.

### Stockfish license

The bundled Stockfish files include their GPLv3 license in [chess-analyzer/engine/COPYING.txt](chess-analyzer/engine/COPYING.txt).

## Tiếng Việt

Chess Analyzer là Chrome Extension hiển thị nước đi Stockfish gợi ý bằng mũi tên trên bàn cờ Chess.com. Phân tích chạy trong trình duyệt.

### Yêu cầu

- Google Chrome phiên bản 120 trở lên.
- Thư mục `chess-analyzer` đầy đủ, gồm các file Stockfish trong `chess-analyzer/engine`.

### Cài đặt

1. Trên GitHub, chọn **Code → Download ZIP** rồi giải nén repository.
2. Mở `chrome://extensions` trong Chrome và bật **Developer mode**.
3. Chọn **Load unpacked** và chọn thư mục `chess-analyzer` vừa giải nén, là thư mục chứa `manifest.json`.

### Sử dụng

1. Mở một bàn cờ trên Chess.com. Nếu tab đã mở trước khi cài extension, hãy tải lại tab một lần.
2. Mở popup **Chess Analyzer** và bật **ON**.
3. Chọn **Fast**, **Strong** hoặc **Deep**. Panel và mũi tên tự cập nhật.
4. Kéo tiêu đề panel để đổi vị trí; bấm **Về cạnh bàn cờ** để đặt lại.
5. Chọn **Ngôn ngữ → Tiếng Việt** hoặc **English** trong popup. Panel đổi ngay và ghi nhớ lựa chọn.
6. Tắt **OFF** để dừng phân tích và xóa mũi tên.

### Trợ giúp

- **ON nhưng không có mũi tên:** xem dòng trạng thái trong popup. Tải lại tab Chess.com nếu tab chưa kết nối. Nếu thiếu FEN đầy đủ, extension sẽ chờ dữ liệu bàn cờ.
- **Lỗi Stockfish Worker:** vào `chrome://extensions`, bấm **Reload** cho extension rồi tải lại tab Chess.com.
- **Cập nhật extension:** reload extension và tab Chess.com.

### Giấy phép Stockfish

Các file Stockfish được đóng gói cùng giấy phép GPLv3 trong [chess-analyzer/engine/COPYING.txt](chess-analyzer/engine/COPYING.txt).
