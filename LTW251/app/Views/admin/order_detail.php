<h2>Chi tiết đơn hàng #<?= $order['id'] ?></h2>

<div class="row mb-4">
  <div class="col-md-6">
    <h5>Thông tin khách hàng</h5>
    <p><strong>Họ tên:</strong> <?= htmlspecialchars($order['customer_name'], ENT_QUOTES, 'UTF-8') ?></p>
    <p><strong>Điện thoại:</strong> <?= htmlspecialchars($order['customer_phone'] ?? '', ENT_QUOTES, 'UTF-8') ?></p>
    <p>
      <strong>Email:</strong>
      <?php $detailEmail = trim((string)($order['customer_email'] ?? '')); ?>
      <?php if ($detailEmail !== ''): ?>
        <?= htmlspecialchars($detailEmail, ENT_QUOTES, 'UTF-8') ?>
      <?php else: ?>
        <span class="text-muted fst-italic">Khách vãng lai (không email)</span>
      <?php endif; ?>
    </p>
    <p><strong>Địa chỉ:</strong> <?= htmlspecialchars($order['customer_address'] ?? '', ENT_QUOTES, 'UTF-8') ?></p>
    <p><strong>Ngày đặt:</strong> <?= date('d/m/Y H:i', strtotime($order['created_at'])) ?></p>
  </div>
  
  <div class="col-md-6">
    <h5>Trạng thái đơn hàng</h5>
    <form method="post" action="/?r=adminOrder/updateStatus">
      <input type="hidden" name="_csrf" value="<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>">
      <input type="hidden" name="id" value="<?= $order['id'] ?>">
      <select name="status" class="form-select mb-2">
        <option value="pending" <?= $order['status'] === 'pending' ? 'selected' : '' ?>>Chờ xử lý</option>
        <option value="processing" <?= $order['status'] === 'processing' ? 'selected' : '' ?>>Đang xử lý</option>
        <option value="completed" <?= $order['status'] === 'completed' ? 'selected' : '' ?>>Hoàn thành</option>
        <option value="cancelled" <?= $order['status'] === 'cancelled' ? 'selected' : '' ?>>Đã hủy</option>
      </select>
      <button type="submit" class="btn btn-primary">Cập nhật</button>
    </form>
  </div>
</div>

<h5>Sản phẩm</h5>
<table class="table table-bordered">
  <thead>
    <tr>
      <th>Sản phẩm</th>
      <th>Giá</th>
      <th>Số lượng</th>
      <th>Tạm tính</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($items as $item): ?>
      <tr>
        <td><?= htmlspecialchars($item['product_name'] ?? 'N/A', ENT_QUOTES, 'UTF-8') ?></td>
        <td><?= number_format($item['price'], 0, ',', '.') ?>đ</td>
        <td><?= (int)$item['qty'] ?></td>
        <td><?= number_format($item['price'] * $item['qty'], 0, ',', '.') ?>đ</td>
      </tr>
    <?php endforeach; ?>
  </tbody>
  <tfoot>
    <tr>
      <th colspan="3">Tổng cộng</th>
      <th><?= number_format($total, 0, ',', '.') ?>đ</th>
    </tr>
  </tfoot>
</table>

<a href="/?r=adminOrder/list" class="btn btn-secondary">Quay lại</a>
