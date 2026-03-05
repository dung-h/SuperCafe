<?php
// Seed knowledge base FAQs for chatbot retrieval (BotBridgeController::faqAnswer)
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../app/Models/DB.php';

$faqs = [
  [
    'question' => 'Quán Lowland Coffee mở cửa lúc mấy giờ?',
    'answer' => 'Lowland Coffee mở cửa theo khung giờ ghi tại mục Liên hệ trên website. Bạn có thể hỏi bot: "giờ mở cửa" để lấy thông tin mới nhất.',
  ],
  [
    'question' => 'Lowland Coffee có giao hàng không?',
    'answer' => 'Quán có hỗ trợ giao hàng theo địa chỉ bạn cung cấp trong bước đặt đơn. Bạn có thể đặt qua bot hoặc qua website.',
  ],
  [
    'question' => 'Làm sao để đặt món nhanh qua bot?',
    'answer' => 'Bạn có thể bấm "Bắt đầu đặt đơn" hoặc gửi theo mẫu: ORDER SKU:SL,SKU:SL | Họ tên | SĐT | Địa chỉ | bank_transfer|cod.',
  ],
  [
    'question' => 'Có thể kiểm tra trạng thái đơn hàng như thế nào?',
    'answer' => 'Bạn gửi mã đơn theo dạng ORD-YYYYMMDD-XXXX, bot sẽ trả về trạng thái và thông tin đơn hàng.',
  ],
  [
    'question' => 'Quán hỗ trợ thanh toán bằng cách nào?',
    'answer' => 'Hiện hỗ trợ hai phương thức: chuyển khoản (bank_transfer) và thanh toán khi nhận hàng (cod).',
  ],
  [
    'question' => 'Nếu chọn chuyển khoản thì cần ghi nội dung gì?',
    'answer' => 'Khi chuyển khoản, bạn ghi đúng mã đơn hàng trong nội dung để hệ thống đối soát nhanh hơn.',
  ],
  [
    'question' => 'Nếu muốn gặp tư vấn viên thì làm sao?',
    'answer' => 'Bạn nhắn "gặp tư vấn viên", bot sẽ chuyển phiên sang hỗ trợ trực tiếp.',
  ],
  [
    'question' => 'Sau khi gặp tư vấn viên, quay lại bot như thế nào?',
    'answer' => 'Bạn nhắn "tiếp tục với bot" để quay lại chế độ trả lời tự động.',
  ],
  [
    'question' => 'Bot có thể làm được những gì?',
    'answer' => 'Bot hỗ trợ xem menu, lọc theo danh mục, thêm món vào đơn, nhập thông tin giao hàng, xác nhận đơn, kiểm tra đơn và gọi tư vấn viên.',
  ],
  [
    'question' => 'Có thể xem menu theo danh mục không?',
    'answer' => 'Có. Bạn có thể chọn các danh mục như Cà phê, Trà sữa, Trà trái cây, Nước ép để xem món phù hợp.',
  ],
  [
    'question' => 'SKU là gì khi đặt hàng?',
    'answer' => 'SKU là mã định danh món. Ví dụ: BAC-XIU-L hoặc WEB-P22, dùng để đặt nhanh và chính xác.',
  ],
  [
    'question' => 'Nếu nhập sai số điện thoại thì sao?',
    'answer' => 'Bot sẽ yêu cầu nhập lại số điện thoại hợp lệ. Số điện thoại hợp lệ thường có 9-11 chữ số.',
  ],
  [
    'question' => 'Có thể dùng link Google Maps cho địa chỉ giao hàng không?',
    'answer' => 'Có thể. Bạn có thể gửi link Google Maps hoặc địa chỉ text chi tiết để bot lưu thông tin giao hàng.',
  ],
  [
    'question' => 'Website có hỗ trợ xem lại món bằng hình ảnh trước khi xác nhận không?',
    'answer' => 'Có. Bot có thể gửi link trang review để bạn kiểm tra món bằng hình ảnh trước khi xác nhận đơn.',
  ],
  [
    'question' => 'Làm sao để hủy đơn đang nhập dở?',
    'answer' => 'Bạn bấm "Hủy đơn" hoặc nhắn "hủy đơn", bot sẽ kết thúc luồng đặt hiện tại.',
  ],
  [
    'question' => 'Làm sao để quay về bước trước khi đặt hàng?',
    'answer' => 'Bạn bấm "Quay lại" để chỉnh thông tin ở bước trước trong wizard đặt hàng.',
  ],
  [
    'question' => 'Đơn hàng ở trạng thái awaiting_payment nghĩa là gì?',
    'answer' => 'Trạng thái awaiting_payment nghĩa là hệ thống đang chờ bạn hoàn tất thanh toán chuyển khoản.',
  ],
  [
    'question' => 'Đơn hàng ở trạng thái new nghĩa là gì?',
    'answer' => 'Trạng thái new nghĩa là đơn vừa được tạo và đang chờ cửa hàng xác nhận xử lý.',
  ],
  [
    'question' => 'Nếu bot trả lời chưa đúng thì nên làm gì?',
    'answer' => 'Bạn có thể diễn đạt lại ngắn gọn hơn, chọn các nút gợi ý, hoặc nhắn "gặp tư vấn viên" để được hỗ trợ trực tiếp.',
  ],
  [
    'question' => 'Lowland Coffee có menu nào nổi bật?',
    'answer' => 'Bạn có thể thử các nhóm món phổ biến như Cà phê, Trà sữa, Trà trái cây, Nước ép và xem các món đang còn hàng trên bot.',
  ],
  [
    'question' => 'Có thể đặt nhiều món cùng lúc không?',
    'answer' => 'Có. Bạn có thể gửi nhiều SKU theo mẫu SKU:SL,SKU:SL hoặc thêm món từng bước trong wizard.',
  ],
  [
    'question' => 'Tôi muốn đổi phương thức thanh toán sau khi chọn thì làm sao?',
    'answer' => 'Bạn dùng nút "Quay lại" để về bước thanh toán và chọn lại bank_transfer hoặc cod.',
  ],
  [
    'question' => 'Có thể đặt hàng mà không cần tài khoản website không?',
    'answer' => 'Có. Bạn vẫn có thể đặt đơn qua bot với tên, số điện thoại, địa chỉ và phương thức thanh toán.',
  ],
  [
    'question' => 'Bot có hỗ trợ Messenger, Telegram và Web không?',
    'answer' => 'Có. Hệ thống bot hiện hỗ trợ đa kênh: Messenger, Telegram và widget chat trên website.',
  ],
  [
    'question' => 'Nếu món hết hàng thì bot xử lý như thế nào?',
    'answer' => 'Khi món không còn đủ tồn kho, hệ thống sẽ báo để bạn đổi sang món khác còn hàng.',
  ],
  [
    'question' => 'Làm sao để xem thông tin sản phẩm chi tiết?',
    'answer' => 'Bạn có thể hỏi theo tên món hoặc mã SKU, bot sẽ trả về giá, mô tả và danh mục sản phẩm.',
  ],
  [
    'question' => 'Có thể theo dõi đơn bằng mã đơn không?',
    'answer' => 'Có. Chỉ cần gửi đúng mã ORD-YYYYMMDD-XXXX, bot sẽ trả về trạng thái mới nhất.',
  ],
  [
    'question' => 'Khi nào nên dùng nút gợi ý thay vì nhắn tự do?',
    'answer' => 'Khi bạn cần thao tác nhanh, nút gợi ý giúp bot hiểu chính xác action và giảm lỗi diễn giải.',
  ],
  [
    'question' => 'Quy trình đặt đơn chuẩn trên bot gồm những bước nào?',
    'answer' => 'Quy trình gồm: chọn món -> tên người nhận -> số điện thoại -> địa chỉ -> phương thức thanh toán -> xác nhận đơn.',
  ],
  [
    'question' => 'Nếu tôi không nhớ SKU thì có đặt được không?',
    'answer' => 'Được. Bạn có thể mở menu theo danh mục và bấm nút đặt trực tiếp trên từng món.',
  ],
];

try {
  $pdo = DB::pdo();
  $pdo->beginTransaction();

  $updateStmt = $pdo->prepare('UPDATE faqs SET answer = ?, position = ?, is_public = 1 WHERE question = ?');
  $insertStmt = $pdo->prepare('INSERT INTO faqs (question, answer, position, is_public) VALUES (?, ?, ?, 1)');
  $checkStmt = $pdo->prepare('SELECT id FROM faqs WHERE question = ? LIMIT 1');

  $position = 100;
  $inserted = 0;
  $updated = 0;

  foreach ($faqs as $item) {
    $question = trim((string)($item['question'] ?? ''));
    $answer = trim((string)($item['answer'] ?? ''));
    if ($question === '' || $answer === '') {
      continue;
    }

    $checkStmt->execute([$question]);
    $row = $checkStmt->fetch();
    if ($row) {
      $updateStmt->execute([$answer, $position, $question]);
      $updated++;
    } else {
      $insertStmt->execute([$question, $answer, $position]);
      $inserted++;
    }
    $position++;
  }

  $pdo->commit();
  echo "Seed chatbot KB thành công. inserted={$inserted}, updated={$updated}" . PHP_EOL;
} catch (Throwable $e) {
  if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  fwrite(STDERR, 'Seed chatbot KB thất bại: ' . $e->getMessage() . PHP_EOL);
  exit(1);
}

