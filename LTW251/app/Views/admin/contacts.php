<h2>Liên hệ</h2>

<form class="row g-2 mb-3" method="get" action="<?= BASE_URL ?>">
  <input type="hidden" name="r" value="admin/contacts">
  <div class="col-md-3">
    <select name="status" class="form-select">
      <option value="all" <?= ($status ?? 'all') === 'all' ? 'selected' : '' ?>>Tất cả trạng thái</option>
      <option value="new" <?= ($status ?? 'all') === 'new' ? 'selected' : '' ?>>Chưa xử lý</option>
      <option value="resolved" <?= ($status ?? 'all') === 'resolved' ? 'selected' : '' ?>>Đã xử lý</option>
    </select>
  </div>
  <div class="col-md-6">
    <input type="text" name="q" class="form-control" placeholder="Tìm theo tên hoặc email..." value="<?= htmlspecialchars($q ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  <div class="col-md-3">
    <button type="submit" class="btn btn-primary">Lọc</button>
    <a href="<?= BASE_URL ?>/?r=admin/contactInfo" class="btn btn-outline-secondary">Thay đổi thông tin quán</a>
  </div>
</form>

<table class="table table-bordered align-middle">
  <thead>
    <tr>
      <th>ID</th>
      <th>Họ tên</th>
      <th>Email</th>
      <th>Nội dung</th>
      <th>Trạng thái</th>
      <th>Thao tác</th>
    </tr>
  </thead>
  <tbody>
    <?php if (empty($items)): ?>
      <tr>
        <td colspan="6" class="text-center text-muted">Chưa có liên hệ nào.</td>
      </tr>
    <?php else: ?>
      <?php foreach ($items as $it): ?>
        <tr>
          <td><?= (int)$it['id'] ?></td>
          <td><?= htmlspecialchars($it['name'], ENT_QUOTES, 'UTF-8') ?></td>
          <td><?= htmlspecialchars($it['email'], ENT_QUOTES, 'UTF-8') ?></td>
          <td><?= nl2br(htmlspecialchars($it['message'], ENT_QUOTES, 'UTF-8')) ?></td>
          <td>
            <?php if (!empty($it['is_resolved'])): ?>
              <span class="badge bg-success">Đã xử lý</span>
            <?php else: ?>
              <span class="badge bg-warning text-dark">Mới</span>
            <?php endif; ?>
          </td>
          <td class="text-center">
            <div class="btn-group" role="group">
              <a href="<?= BASE_URL ?>/?r=admin/contacts&action=reply&id=<?= $it['id'] ?>" 
                 class="btn btn-sm btn-primary" title="Phản hồi">
                 Phản hồi
              </a>

              <?php if (empty($it['is_resolved'])): ?>
                <a href="<?= BASE_URL ?>/?r=admin/contacts&action=resolve&id=<?= $it['id'] ?>" 
                   class="btn btn-sm btn-success">Đã xử lý</a>
              <?php endif; ?>

              <a href="<?= BASE_URL ?>/?r=admin/contacts&action=delete&id=<?= $it['id'] ?>" 
                 class="btn btn-sm btn-danger"
                 onclick="return confirm('Xóa vĩnh viễn liên hệ này?')">
                 Xóa
              </a>
            </div>
          </td>
        </tr>
      <?php endforeach; ?>
    <?php endif; ?>
  </tbody>
</table>