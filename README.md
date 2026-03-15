# SuperCafe

SuperCafe là repository demo tổng hợp các công nghệ và quy trình triển khai mình đã học khi xây dựng một hệ thống bán hàng đa kênh.

## Live Demo

- SuperCafe Website: https://dungho.io.vn/lowlandcafe/
- Facebook Page/Bot: https://facebook.com/profile.php?id=61588610807836
- Telegram Bot: https://t.me/Demo_015_bot

## Mục Tiêu Kỹ Thuật

- Xây dựng web app theo mô hình MVC.
- Triển khai chatbot đa kênh (web, Messenger, Telegram).
- Tổ chức lớp vận hành thực tế: health check, alert, queue worker, backup/restore, hardening.
- Demo luồng end-to-end trên domain thật.

## Giá Trị Demo

- Frontend bán hàng có giỏ hàng và luồng đặt hàng.
- Chatbot tích hợp trực tiếp trên web.
- Các kênh hội thoại hoạt động song song trên cùng hệ thống.
- Có bộ script kiểm tra nhanh để đánh giá trạng thái vận hành.

## Cấu Trúc Chính

- `LTW251/`: ứng dụng web SuperCafe (PHP MVC).
- `OpenClaw/`: dịch vụ chatbot và gateway đa kênh.
- `scripts/`: script vận hành và smoke-check.
- `docs/`: runbook và tài liệu tổng quan.

## Lệnh Vận Hành Nhanh

```bash
./scripts/chatbot-smoke.sh
./scripts/omnichannel-smoke.sh
./scripts/ops-dashboard.sh
./scripts/sre-alert-check.sh
./scripts/ops-guardian.sh
./scripts/ops-alert-test.sh
```

## Monitoring Và Alert

- Kiểm tra định kỳ: `scripts/sre-alert-check.sh`
- Giám sát + auto-heal: `scripts/ops-guardian.sh`
- Test kênh cảnh báo: `scripts/ops-alert-test.sh`
- Runbook vận hành: `docs/ops-runbook.md`

## Lưu Ý Bảo Mật

- Không commit secrets thật vào repository.
- Không public token, key, password trong issue/PR/screenshot.
- Nếu tái sử dụng cho môi trường production, cần rà soát lại toàn bộ chính sách bảo mật trước khi phát hành.
