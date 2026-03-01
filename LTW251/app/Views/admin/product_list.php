<div class="d-flex justify-content-between align-items-center mb-3">
  <h2>Quản lý sản phẩm</h2>
  <a href="/?r=adminProduct/edit" class="btn btn-primary">Thêm sản phẩm mới</a>
</div>

<form method="get" class="row g-2 mb-3">
  <input type="hidden" name="r" value="adminProduct/list">
  <div class="col-md-6">
    <input type="text" name="search" class="form-control" placeholder="Tìm kiếm sản phẩm..." value="<?= htmlspecialchars($search ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  <div class="col-md-3">
    <select name="has_image" class="form-select">
      <option value="">Tất cả</option>
      <option value="1" <?= ($has_image ?? '') === '1' ? 'selected' : '' ?>>Có hình</option>
      <option value="0" <?= ($has_image ?? '') === '0' ? 'selected' : '' ?>>Không hình</option>
    </select>
  </div>
  <div class="col-md-3">
    <button type="submit" class="btn btn-primary w-100">Lọc</button>
  </div>
</form>

<?php if (empty($products)): ?>
  <p>Chưa có sản phẩm nào.</p>
<?php else: ?>
  <table class="table table-bordered">
    <thead>
      <tr>
        <th>ID</th>
        <th>Tên sản phẩm</th>
        <th>Giá</th>
        <th>Mô tả ngắn</th>
        <th>Thao tác</th>
      </tr>
    </thead>
    <tbody>
      <?php foreach ($products as $p): ?>
        <tr>
          <td><?= $p['id'] ?></td>
          <td><?= htmlspecialchars($p['name'], ENT_QUOTES, 'UTF-8') ?></td>
          <td><?= number_format($p['price'], 0, ',', '.') ?>đ</td>
          <td><?= htmlspecialchars($p['short_desc'] ?? '', ENT_QUOTES, 'UTF-8') ?></td>
          <td>
            <a href="/?r=adminProduct/edit&id=<?= $p['id'] ?>" class="btn btn-sm btn-info">Sửa</a>
            <a href="/?r=adminProduct/delete&id=<?= $p['id'] ?>&_csrf=<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>" 
               class="btn btn-sm btn-danger" 
               onclick="return confirm('Xóa sản phẩm này?')">Xóa</a>
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
               href="/?r=adminProduct/list&page=<?= $i ?>&search=<?= urlencode($search ?? '') ?>&has_image=<?= urlencode($has_image ?? '') ?>">
              <?= $i ?>
            </a>
          </li>
        <?php endfor; ?>
      </ul>
    </nav>
  <?php endif; ?>
<?php endif; ?>

