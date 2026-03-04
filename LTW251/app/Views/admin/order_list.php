<h2>Quản lý đơn hàng</h2>

<form class="row g-2 mb-3" method="get" action="">
  <input type="hidden" name="r" value="adminOrder/list">
  <div class="col-md-3">
    <select name="status" class="form-select">
      <option value="all" <?= ($status ?? 'all') === 'all' ? 'selected' : '' ?>>Tất cả trạng thái</option>
      <option value="pending" <?= ($status ?? 'all') === 'pending' ? 'selected' : '' ?>>Chờ xử lý</option>
      <option value="processing" <?= ($status ?? 'all') === 'processing' ? 'selected' : '' ?>>Đang xử lý</option>
      <option value="completed" <?= ($status ?? 'all') === 'completed' ? 'selected' : '' ?>>Hoàn thành</option>
      <option value="cancelled" <?= ($status ?? 'all') === 'cancelled' ? 'selected' : '' ?>>Đã hủy</option>
    </select>
  </div>
  <div class="col-md-6">
    <input type="text" name="q" class="form-control" placeholder="Tìm theo tên hoặc email..." value="<?= htmlspecialchars($q ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  <div class="col-md-3">
    <button type="submit" class="btn btn-primary">Lọc</button>
  </div>
</form>

<table class="table table-bordered">
  <thead>
    <tr>
      <th>ID</th>
      <th>Khách hàng</th>
      <th>Email</th>
      <th>Trạng thái</th>
      <th>Ngày tạo</th>
      <th>Thao tác</th>
    </tr>
  </thead>
  <tbody>
    <?php if (empty($orders)): ?>
      <tr>
        <td colspan="6" class="text-center text-muted">Chưa có đơn hàng nào.</td>
      </tr>
    <?php else: ?>
      <?php foreach ($orders as $o): ?>
        <tr>
          <td><?= (int)$o['id'] ?></td>
          <td><?= htmlspecialchars($o['customer_name'], ENT_QUOTES, 'UTF-8') ?></td>
          <td>
            <?php $email = trim((string)($o['customer_email'] ?? '')); ?>
            <?php if ($email !== ''): ?>
              <?= htmlspecialchars($email, ENT_QUOTES, 'UTF-8') ?>
            <?php else: ?>
              <span class="text-muted fst-italic">Khách vãng lai (không email)</span>
            <?php endif; ?>
          </td>
          <td>
            <?php
              $badges = [
                'pending' => 'order-status-badge order-status-pending',
                'processing' => 'order-status-badge order-status-processing',
                'completed' => 'order-status-badge order-status-completed',
                'cancelled' => 'order-status-badge order-status-cancelled'
              ];
              $labels = [
                'pending' => 'Chờ xử lý',
                'processing' => 'Đang xử lý',
                'completed' => 'Hoàn thành',
                'cancelled' => 'Đã hủy'
              ];
            ?>
            <span class="<?= $badges[$o['status']] ?? 'order-status-badge bg-secondary text-white' ?>">
              <?= $labels[$o['status']] ?? htmlspecialchars($o['status'], ENT_QUOTES, 'UTF-8') ?>
            </span>
          </td>
          <td><?= htmlspecialchars(date('d/m/Y H:i', strtotime($o['created_at'])), ENT_QUOTES, 'UTF-8') ?></td>
          <td>
            <a href="/?r=adminOrder/detail&id=<?= (int)$o['id'] ?>" class="btn btn-sm btn-info">Chi tiết</a>
          </td>
        </tr>
      <?php endforeach; ?>
    <?php endif; ?>
  </tbody>
</table>

<?php if (!empty($totalPages) && $totalPages > 1): ?>
  <nav>
    <ul class="pagination">
      <?php for ($i = 1; $i <= $totalPages; $i++): ?>
        <li class="page-item <?= $i == $page ? 'active' : '' ?>">
          <a class="page-link"
             href="/?r=adminOrder/list&page=<?= $i ?>&status=<?= urlencode($status ?? 'all') ?>&q=<?= urlencode($q ?? '') ?>">
            <?= $i ?>
          </a>
        </li>
      <?php endfor; ?>
    </ul>
  </nav>
<?php endif; ?>
