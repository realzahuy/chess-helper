# Chess Analyzer

Chrome Extension Manifest V3 phân tích vị trí cờ vua trên Chess.com bằng Stockfish WASM chạy local.

## Cài đặt

1. Mở `chrome://extensions` và bật **Developer mode**.
2. Chọn **Load unpacked** và chọn thư mục `chess-analyzer` của repository này.
3. Mở Chess.com, bật extension trong popup và chọn Fast, Strong hoặc Deep.

Extension cần toàn bộ thư mục `chess-analyzer`, gồm `engine/stockfish.js`, `engine/stockfish.wasm` và giấy phép trong `engine/COPYING.txt`.

Xem [hướng dẫn chi tiết](chess-analyzer/README.md) để biết phạm vi URL được hỗ trợ và cách debug.
