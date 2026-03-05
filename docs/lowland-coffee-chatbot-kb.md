# Lowland Coffee Chatbot Knowledge Base (vi-VN)

Tài liệu này là bộ tri thức nền cho chatbot đa kênh (Messenger/Web/Telegram), ưu tiên tiếng Việt tự nhiên.

## 1) Hồ sơ quán

- Thương hiệu: Lowland Coffee
- Loại hình: quán cà phê + đồ uống mang đi/giao hàng
- Kênh hỗ trợ: Website, Messenger, Telegram
- Năng lực bot:
  - xem menu theo danh mục
  - đặt hàng theo wizard
  - kiểm tra trạng thái đơn
  - hướng dẫn thanh toán
  - chuyển sang tư vấn viên

## 2) Nhóm thông tin bot cần trả lời tốt

1. Thông tin quán:
- giờ mở cửa
- địa chỉ
- số điện thoại
- email
- cách liên hệ nhanh

2. Nghiệp vụ đặt đơn:
- bắt đầu đặt hàng
- thêm món/sửa số lượng
- xác nhận hoặc hủy đơn
- kiểm tra mã đơn `ORD-YYYYMMDD-XXXX`

3. Thanh toán:
- `bank_transfer`
- `cod`
- hướng dẫn nội dung chuyển khoản

4. Điều hướng và hỗ trợ:
- gặp tư vấn viên
- quay lại bot
- xử lý trường hợp bot chưa hiểu câu hỏi

## 3) Bộ câu hỏi mẫu nên ưu tiên

- "Quán mở cửa lúc mấy giờ?"
- "Địa chỉ quán ở đâu?"
- "Hotline quán là gì?"
- "Email liên hệ của quán?"
- "Hướng dẫn đặt đơn nhanh"
- "Làm sao kiểm tra mã đơn?"
- "Có hỗ trợ COD không?"
- "Có giao hàng không?"
- "Muốn gặp tư vấn viên"
- "Tiếp tục với bot"

## 4) Quy tắc biên soạn tri thức

- Trả lời ngắn, rõ, không mơ hồ.
- Dùng tiếng Việt có dấu.
- Không bịa thông tin; nếu thiếu dữ liệu thì nói rõ và gợi ý bước tiếp theo.
- Ưu tiên trả lời có cấu trúc:
  - thông tin chính
  - bước hành động tiếp theo

## 5) Cách nạp tri thức vào hệ thống hiện tại

BotBridge FAQ hiện đọc từ bảng `faqs` (public) và `contact_settings`.

Seed bộ FAQ chatbot:

```bash
php LTW251/scripts/seed_chatbot_kb.php
```

Sau đó test:

```bash
curl -sS -H 'Content-Type: application/json' \
  -H 'x-api-key: dev-bridge-key-change-me' \
  -d '{"question":"quán mở cửa lúc mấy giờ"}' \
  'http://127.0.0.1:9999/?r=botBridge/faqAnswer'
```

## 6) Lộ trình nâng cao tiếp theo

1. Tách KB thành nhiều domain:
- thông tin quán
- chính sách
- menu
- vận hành đơn hàng

2. Tăng độ chính xác truy hồi:
- keyword scoring + synonym dictionary
- semantic retrieval (vector store)

3. Chuẩn hóa quy trình update KB:
- kiểm duyệt nội dung trước khi publish
- versioning theo mốc thời gian
- regression test cho câu hỏi phổ biến

