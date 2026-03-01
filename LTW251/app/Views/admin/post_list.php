<div class="d-flex justify-content-between align-items-center mb-3">
  <h2>Quản lý bài viết</h2>
  <a href="/?r=adminpost/edit" class="btn btn-primary">Thêm bài viết mới</a>
</div>

<form method="get" class="row g-2 mb-3">
  <input type="hidden" name="r" value="adminpost/list">
  <div class="col-md-8">
    <input type="text" name="search" class="form-control" placeholder="Tìm kiếm bài viết..." value="<?= htmlspecialchars($search ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  <div class="col-md-2">
    <select name="has_image" class="form-select">
      <option value="">Tất cả</option>
      <option value="1" <?= ($has_image ?? '') === '1' ? 'selected' : '' ?>>Có hình</option>
      <option value="0" <?= ($has_image ?? '') === '0' ? 'selected' : '' ?>>Không hình</option>
    </select>
  </div>
  <div class="col-md-2">
    <button type="submit" class="btn btn-primary w-100">Lọc</button>
  </div>
</form>

<?php if (empty($posts)): ?>
  <p>Chưa có bài viết nào.</p>
<?php else: ?>
  <table class="table table-bordered">
    <thead>
      <tr>
        <th>ID</th>
        <th>Tiêu đề</th>
        <th>Mô tả ngắn</th>
        <th>Ngày tạo</th>
        <th>Thao tác</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($posts as $p): ?>
        <tr>
          <td><?= $p['id'] ?></td>
          <td><?= htmlspecialchars($p['title'], ENT_QUOTES, 'UTF-8') ?></td>
          <td><?= htmlspecialchars($p['excerpt'] ?? '', ENT_QUOTES, 'UTF-8') ?></td>
          <td><?= date('d/m/Y', strtotime($p['created_at'])) ?></td>
          <td>
            <a href="/?r=adminpost/edit&id=<?= $p['id'] ?>" class="btn btn-sm btn-info">Sửa</a>
            <a href="/?r=adminpost/delete&id=<?= $p['id'] ?>&_csrf=<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>" 
               class="btn btn-sm btn-danger" 
               onclick="return confirm('Xóa bài viết này?')">Xóa</a>
          </td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
  
  <?php if ($totalPages > 1): ?>
    <nav>
      <ul class="pagination">
        <?php for ($i = 1; $i <= $totalPages; $i++): ?>
          <li class="page-item <?= $i == $page ? 'active' : '' ?>">
            <a class="page-link"
               href="/?r=adminpost/list&page=<?= $i ?>&search=<?= urlencode($search ?? '') ?>&has_image=<?= urlencode($has_image ?? '') ?>">
              <?= $i ?>
            </a>
          </li>
        <?php endfor; ?>
      </ul>
    </nav>
  <?php endif; ?>
<?php endif; ?>

