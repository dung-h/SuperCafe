<h2>Quản lý bình luận</h2>

<form class="row g-2 mb-3" method="get" action="">
  <input type="hidden" name="r" value="admincomment/list">
  <div class="col-md-3">
    <select name="status" class="form-select">
      <option value="all" <?= ($status ?? 'all') === 'all' ? 'selected' : '' ?>>Tất cả trạng thái</option>
      <option value="pending" <?= ($status ?? 'all') === 'pending' ? 'selected' : '' ?>>Chưa duyệt</option>
      <option value="approved" <?= ($status ?? 'all') === 'approved' ? 'selected' : '' ?>>Đã duyệt</option>
    </select>
  </div>
  <div class="col-md-6">
    <input type="text" name="q" class="form-control" placeholder="Tìm theo bài viết, tên hoặc nội dung..." value="<?= htmlspecialchars($q ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  <div class="col-md-3">
    <button type="submit" class="btn btn-primary">Lọc</button>
  </div>
</form>

<table class="table table-bordered">
  <thead>
    <tr>
      <th>ID</th>
      <th>Bài viết</th>
      <th>Người gửi</th>
      <th>Nội dung</th>
      <th>Trạng thái</th>
      <th>Ngày tạo</th>
      <th>Thao tác</th>
    </tr>
  </thead>
  <tbody>
    <?php if (empty($comments)): ?>
      <tr>
        <td colspan="7" class="text-center text-muted">Chưa có bình luận nào.</td>
      </tr>
    <?php else: ?>
      <?php foreach ($comments as $c): ?>
        <tr>
          <td><?= (int)$c['id'] ?></td>
          <td><?= htmlspecialchars($c['post_title'] ?? '', ENT_QUOTES, 'UTF-8') ?></td>
          <td><?= htmlspecialchars($c['author_name'] ?? '', ENT_QUOTES, 'UTF-8') ?></td>
          <td><?= htmlspecialchars(mb_substr($c['content'] ?? '', 0, 100), ENT_QUOTES, 'UTF-8') ?></td>
          <td>
            <?php if (!empty($c['is_approved'])): ?>
              <span class="badge bg-success">Đã duyệt</span>
            <?php else: ?>
              <span class="badge bg-warning text-dark">Chưa duyệt</span>
            <?php endif; ?>
          </td>
          <td><?= htmlspecialchars(date('d/m/Y H:i', strtotime($c['created_at'])), ENT_QUOTES, 'UTF-8') ?></td>
          <td>
            <a href="/?r=admincomment/toggleApprove&id=<?= (int)$c['id'] ?>&_csrf=<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>"
               class="btn btn-sm btn-info">
              <?= !empty($c['is_approved']) ? 'Bỏ duyệt' : 'Duyệt' ?>
            </a>
            <a href="/?r=admincomment/delete&id=<?= (int)$c['id'] ?>&_csrf=<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>"
               class="btn btn-sm btn-danger"
               onclick="return confirm('Xóa bình luận này?')">Xóa</a>
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
             href="/?r=admincomment/list&page=<?= $i ?>&status=<?= urlencode($status ?? 'all') ?>&q=<?= urlencode($q ?? '') ?>">
            <?= $i ?>
          </a>
        </li>
      <?php endfor; ?>
    </ul>
  </nav>
<?php endif; ?>

