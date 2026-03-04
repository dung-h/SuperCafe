<?php
$fmtVnd = function ($value) {
  return number_format((float)$value, 0, ',', '.') . ' đ';
};

$normalizeImage = function ($raw) {
  $path = trim((string)$raw);
  if ($path === '') {
    return BASE_URL . '/assets/images/product-placeholder.svg';
  }
  if (preg_match('/^https?:\/\//i', $path)) {
    return $path;
  }
  return rtrim((string)BASE_URL, '/') . ($path[0] === '/' ? $path : ('/' . $path));
};

$recipientName = trim((string)($recipient['name'] ?? ''));
$recipientPhone = trim((string)($recipient['phone'] ?? ''));
$recipientAddress = trim((string)($recipient['address'] ?? ''));
$editName = trim((string)($editForm['name'] ?? ''));
$editPhone = trim((string)($editForm['phone'] ?? ''));
$editAddress = trim((string)($editForm['address'] ?? ''));
$editPayment = trim((string)($editForm['paymentMethod'] ?? ''));
?>

<style>
  .order-review-wrap { max-width: 980px; margin: 24px auto; padding: 0 12px 28px; }
  .order-review-head { margin-bottom: 16px; }
  .order-review-head h1 { font-size: 30px; margin: 0 0 8px; color: #3f2a22; }
  .order-review-head p { margin: 0; color: #6f5a53; }
  .order-review-alert { border: 1px solid #e6d6ce; background: #fff7f2; color: #6a4335; border-radius: 12px; padding: 12px 14px; margin: 14px 0; }
  .order-review-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); margin-top: 14px; }
  .order-review-card { border: 1px solid #ecdcd4; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 8px 20px rgba(52, 31, 23, 0.06); }
  .order-review-media { aspect-ratio: 4/3; overflow: hidden; background: #f3ede9; }
  .order-review-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .order-review-body { padding: 12px 14px 14px; }
  .order-review-name { font-size: 17px; font-weight: 700; color: #2f2019; margin: 0 0 4px; line-height: 1.3; }
  .order-review-sku { font-size: 13px; color: #86695f; margin: 0 0 8px; }
  .order-review-desc { font-size: 13px; color: #604941; margin: 0 0 10px; min-height: 34px; }
  .order-review-row { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; margin: 3px 0; }
  .order-review-row strong { color: #3c291f; }
  .order-review-footer { margin-top: 18px; border-top: 1px dashed #dcc8bf; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
  .order-review-total { font-size: 21px; font-weight: 800; color: #4b2e22; }
  .order-review-actions a { text-decoration: none; border-radius: 10px; padding: 10px 14px; display: inline-block; border: 1px solid #c7b0a5; color: #5a4033; margin-right: 8px; }
  .order-review-actions a.primary { background: #5a3d31; border-color: #5a3d31; color: #fff; }
  .order-review-actions .confirm-btn { border-radius: 10px; padding: 10px 14px; border: 1px solid #2f7e4f; background: #2f7e4f; color: #fff; font-weight: 700; }
  .order-review-actions .confirm-btn[disabled] { opacity: 1; background: #b8c7bd; border-color: #b8c7bd; color: #f8f8f8; cursor: not-allowed; }
  .order-review-recipient { margin: 14px 0 6px; border: 1px solid #e8d7ce; background: #fff; border-radius: 12px; padding: 12px 14px; }
  .order-review-recipient h3 { margin: 0 0 10px; font-size: 17px; color: #3a281f; }
  .order-review-meta { color: #6e5549; font-size: 13px; margin-top: 8px; }
  .order-review-recipient-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px 14px; }
  .order-review-recipient .label { font-size: 12px; color: #8a6d5f; margin-bottom: 3px; }
  .order-review-recipient .value { color: #33231d; font-weight: 600; word-break: break-word; }
  .order-review-inline { display: inline-block; margin-right: 8px; }
  .order-review-edit-form { margin-top: 12px; border-top: 1px dashed #e2d3cb; padding-top: 12px; }
  .order-review-edit-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px 12px; }
  .order-review-edit-form label { display: block; font-size: 12px; color: #7f6559; margin-bottom: 4px; }
  .order-review-edit-form input,
  .order-review-edit-form select { width: 100%; border: 1px solid #d6c3b8; border-radius: 8px; padding: 8px 10px; font-size: 14px; }
  .order-review-edit-form .btn-save { margin-top: 10px; border: 1px solid #8a5d48; background: #fff; color: #623f31; border-radius: 10px; padding: 9px 14px; font-weight: 700; }
  .order-review-edit-hint { font-size: 12px; color: #7d6255; margin-top: 8px; }
  @media (max-width: 768px) {
    .order-review-head h1 { font-size: 24px; }
    .order-review-total { font-size: 18px; }
  }
</style>

<div class="order-review-wrap">
  <div class="order-review-head">
    <h1>Kiểm tra đơn hàng trực quan</h1>
    <p>Trang này giúp bạn đối chiếu món bằng hình ảnh trước khi bấm xác nhận đơn trong bot.</p>
  </div>

  <?php if (!empty($identityView)): ?>
    <div class="order-review-meta">
      Kênh: <strong><?= htmlspecialchars($identityView['channel'], ENT_QUOTES, 'UTF-8') ?></strong>
      <?php if (!empty($identityView['nativeUserIdMasked'])): ?>
        <span class="order-review-inline">|</span>User: <strong><?= htmlspecialchars($identityView['nativeUserIdMasked'], ENT_QUOTES, 'UTF-8') ?></strong>
      <?php endif; ?>
      <?php if (!empty($identityView['source']) && $identityView['source'] !== 'direct'): ?>
        <span class="order-review-inline">|</span>
        <strong><?= $identityView['source'] === 'restored' ? 'Đã khôi phục phiên gần nhất' : 'Đã tự nhận diện phiên từ giỏ món' ?></strong>
      <?php endif; ?>
    </div>
  <?php else: ?>
    <div class="order-review-alert">
      Link hiện tại chưa có định danh phiên bot (kênh/user), nên chưa đồng bộ được thông tin nhận hàng.
      Bạn có thể nhập thông tin định danh bên dưới hoặc mở lại link mới từ bot để tự điền.
    </div>
  <?php endif; ?>

  <?php if (is_array($editResult)): ?>
    <div class="order-review-alert" style="<?= !empty($editResult['ok']) ? 'border-color:#d0e9da;background:#f1fbf5;color:#265d3d;' : '' ?>">
      <?= htmlspecialchars((string)($editResult['message'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
    </div>
  <?php endif; ?>

  <?php if (is_array($confirmResult)): ?>
    <div class="order-review-alert" style="<?= !empty($confirmResult['ok']) ? 'border-color:#d0e9da;background:#f1fbf5;color:#265d3d;' : '' ?>">
      <?= htmlspecialchars((string)($confirmResult['message'] ?? ''), ENT_QUOTES, 'UTF-8') ?>
    </div>
  <?php endif; ?>

  <section class="order-review-recipient">
    <h3>Thông tin nhận hàng đồng bộ từ bot</h3>
    <div class="order-review-recipient-grid">
      <div>
        <div class="label">Người nhận</div>
        <div class="value"><?= $recipientName !== '' ? htmlspecialchars($recipientName, ENT_QUOTES, 'UTF-8') : '(chưa có)' ?></div>
      </div>
      <div>
        <div class="label">Số điện thoại</div>
        <div class="value"><?= $recipientPhone !== '' ? htmlspecialchars($recipientPhone, ENT_QUOTES, 'UTF-8') : '(chưa có)' ?></div>
      </div>
      <div>
        <div class="label">Địa chỉ giao hàng</div>
        <div class="value"><?= $recipientAddress !== '' ? htmlspecialchars($recipientAddress, ENT_QUOTES, 'UTF-8') : '(chưa có)' ?></div>
      </div>
      <div>
        <div class="label">Thanh toán</div>
        <div class="value">
          <?php
            $method = (string)($recipient['paymentMethod'] ?? '');
            if ($method === 'bank_transfer') {
              echo 'Chuyển khoản';
            } elseif ($method === 'cod') {
              echo 'COD';
            } else {
              echo '(chưa có)';
            }
          ?>
        </div>
      </div>
    </div>
    <?php if (!empty($recipient['missingFields']) && (empty($confirmResult) || empty($confirmResult['ok']))): ?>
      <div class="order-review-meta">
        Phiên bot còn thiếu thông tin: <?= htmlspecialchars(implode(', ', (array)$recipient['missingFields']), ENT_QUOTES, 'UTF-8') ?>.
        Hãy quay lại bot để điền đủ rồi xác nhận tại đây.
      </div>
    <?php endif; ?>

    <form method="post" action="<?= BASE_URL ?>/?r=site/orderReview" class="order-review-edit-form">
      <input type="hidden" name="action" value="update_recipient">
      <input type="hidden" name="items" value="<?= htmlspecialchars((string)$itemsRaw, ENT_QUOTES, 'UTF-8') ?>">
      <input type="hidden" name="ext" value="<?= htmlspecialchars((string)$extToken, ENT_QUOTES, 'UTF-8') ?>">

      <div class="order-review-edit-grid">
        <?php if (empty($identityView)): ?>
          <div>
            <label for="rv-ch">Kênh bot</label>
            <select id="rv-ch" name="ch" required>
              <option value="">Chọn kênh</option>
              <option value="messenger" <?= $channelHint === 'messenger' ? 'selected' : '' ?>>Messenger</option>
              <option value="telegram" <?= $channelHint === 'telegram' ? 'selected' : '' ?>>Telegram</option>
              <option value="web" <?= $channelHint === 'web' ? 'selected' : '' ?>>Web</option>
            </select>
          </div>
          <div>
            <label for="rv-uid">User ID theo kênh</label>
            <input id="rv-uid" type="text" name="uid" value="<?= htmlspecialchars((string)$uidHint, ENT_QUOTES, 'UTF-8') ?>" placeholder="VD: PSID Messenger hoặc Telegram ID">
          </div>
        <?php else: ?>
          <input type="hidden" name="ch" value="<?= htmlspecialchars((string)$channelHint, ENT_QUOTES, 'UTF-8') ?>">
          <input type="hidden" name="uid" value="<?= htmlspecialchars((string)$uidHint, ENT_QUOTES, 'UTF-8') ?>">
        <?php endif; ?>

        <div>
          <label for="rv-name">Tên người nhận</label>
          <input id="rv-name" type="text" name="recipient_name" value="<?= htmlspecialchars($editName, ENT_QUOTES, 'UTF-8') ?>" placeholder="Nhập tên người nhận">
        </div>
        <div>
          <label for="rv-phone">Số điện thoại</label>
          <input id="rv-phone" type="text" name="recipient_phone" value="<?= htmlspecialchars($editPhone, ENT_QUOTES, 'UTF-8') ?>" placeholder="VD: 0912345678">
        </div>
        <div>
          <label for="rv-address">Địa chỉ giao hàng</label>
          <input id="rv-address" type="text" name="recipient_address" value="<?= htmlspecialchars($editAddress, ENT_QUOTES, 'UTF-8') ?>" placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành">
        </div>
        <div>
          <label for="rv-payment">Thanh toán</label>
          <select id="rv-payment" name="recipient_payment">
            <option value="">Giữ nguyên / chưa chọn</option>
            <option value="bank_transfer" <?= $editPayment === 'bank_transfer' ? 'selected' : '' ?>>Chuyển khoản</option>
            <option value="cod" <?= $editPayment === 'cod' ? 'selected' : '' ?>>COD</option>
          </select>
        </div>
      </div>
      <button class="btn-save" type="submit">Sửa thông tin nhận hàng</button>
      <div class="order-review-edit-hint">Bấm nút này để lưu trực tiếp vào session bot hiện tại trước khi xác nhận đơn.</div>
    </form>
  </section>

  <?php if (!$hasInput): ?>
    <div class="order-review-alert">
      Chưa có dữ liệu món cần kiểm tra. Hãy mở trang này từ nút "Xem ảnh món trên web" trong bot.
    </div>
  <?php elseif (empty($reviewItems)): ?>
    <div class="order-review-alert">
      Không đọc được danh sách món hợp lệ từ tham số <code>items</code>. Dữ liệu nhận được:
      <br><code><?= htmlspecialchars($itemsRaw, ENT_QUOTES, 'UTF-8') ?></code>
    </div>
  <?php else: ?>
    <?php if (!empty($missingSkus)): ?>
      <div class="order-review-alert">
        Một số SKU không còn tồn tại trong hệ thống nên không hiển thị ảnh:
        <strong><?= htmlspecialchars(implode(', ', $missingSkus), ENT_QUOTES, 'UTF-8') ?></strong>
      </div>
    <?php endif; ?>

    <div class="order-review-grid">
      <?php foreach ($reviewItems as $item): ?>
        <article class="order-review-card">
          <div class="order-review-media">
            <img src="<?= htmlspecialchars($normalizeImage($item['image']), ENT_QUOTES, 'UTF-8') ?>"
                 alt="<?= htmlspecialchars($item['name'], ENT_QUOTES, 'UTF-8') ?>">
          </div>
          <div class="order-review-body">
            <h2 class="order-review-name"><?= htmlspecialchars($item['name'], ENT_QUOTES, 'UTF-8') ?></h2>
            <p class="order-review-sku"><?= htmlspecialchars($item['sku'], ENT_QUOTES, 'UTF-8') ?><?= $item['category'] !== '' ? (' | ' . htmlspecialchars($item['category'], ENT_QUOTES, 'UTF-8')) : '' ?></p>
            <p class="order-review-desc"><?= htmlspecialchars($item['description'] !== '' ? $item['description'] : 'Không có mô tả ngắn.', ENT_QUOTES, 'UTF-8') ?></p>
            <div class="order-review-row"><span>Số lượng</span><strong>x<?= (int)$item['qty'] ?></strong></div>
            <div class="order-review-row"><span>Đơn giá</span><strong><?= htmlspecialchars($fmtVnd($item['unitPriceVnd']), ENT_QUOTES, 'UTF-8') ?></strong></div>
            <div class="order-review-row"><span>Tạm tính</span><strong><?= htmlspecialchars($fmtVnd($item['lineTotalVnd']), ENT_QUOTES, 'UTF-8') ?></strong></div>
          </div>
        </article>
      <?php endforeach; ?>
    </div>

    <div class="order-review-footer">
      <div>
        <div style="font-size:13px;color:#7a5f56;">Tổng tạm tính các món hiển thị</div>
        <div class="order-review-total"><?= htmlspecialchars($fmtVnd($subtotalVnd), ENT_QUOTES, 'UTF-8') ?></div>
      </div>
      <div class="order-review-actions">
        <form method="post" action="<?= BASE_URL ?>/?r=site/orderReview" style="display:inline-block;margin-right:8px;">
          <input type="hidden" name="action" value="confirm">
          <input type="hidden" name="items" value="<?= htmlspecialchars((string)$itemsRaw, ENT_QUOTES, 'UTF-8') ?>">
          <input type="hidden" name="ch" value="<?= htmlspecialchars((string)$channelHint, ENT_QUOTES, 'UTF-8') ?>">
          <input type="hidden" name="uid" value="<?= htmlspecialchars((string)$uidHint, ENT_QUOTES, 'UTF-8') ?>">
          <input type="hidden" name="ext" value="<?= htmlspecialchars((string)$extToken, ENT_QUOTES, 'UTF-8') ?>">
          <button class="confirm-btn" type="submit" <?= empty($canConfirm) ? 'disabled' : '' ?>>Xác nhận đặt đơn ngay</button>
        </form>
        <a href="<?= BASE_URL ?>/?r=product/list">Xem toàn bộ menu</a>
        <a class="primary" href="<?= BASE_URL ?>/">Về trang chủ</a>
      </div>
    </div>
  <?php endif; ?>
</div>
