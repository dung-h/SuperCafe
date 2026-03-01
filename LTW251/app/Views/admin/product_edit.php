<?php
$isEdit = !empty($product) && !empty($product['id']);
$currentImage = '';
if (!empty($product)) {
  $img = (string)($product['image'] ?? '');
  if ($img === '' || strpos($img, '/uploads/') !== 0) {
    $img = '/assets/images/noimage.svg';
  }
  $currentImage = $img;
}
?>

<h2><?= $isEdit ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới' ?></h2>

<?php if (!empty($error)): ?>
  <div class="alert alert-danger"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
<?php endif; ?>

<form method="post" enctype="multipart/form-data">
  <input type="hidden" name="_csrf" value="<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>">
  
  <div class="mb-3">
    <label class="form-label">Tên sản phẩm *</label>
    <input type="text"
           name="name"
           class="form-control"
           maxlength="200"
           required
           value="<?= htmlspecialchars($product['name'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  
  <div class="mb-3">
    <label class="form-label">Giá (VNĐ)</label>
    <input type="number"
           name="price"
           class="form-control"
           min="0"
           step="1000"
           value="<?= htmlspecialchars($product['price'] ?? 0, ENT_QUOTES, 'UTF-8') ?>">
  </div>
  
  <div class="mb-3">
    <label class="form-label">Mô tả ngắn</label>
    <input type="text"
           name="short_desc"
           class="form-control"
           maxlength="255"
           value="<?= htmlspecialchars($product['short_desc'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  
  <div class="mb-3">
    <label class="form-label">Mô tả chi tiết</label>
    <textarea name="description"
              class="form-control"
              rows="6"><?= htmlspecialchars($product['description'] ?? '', ENT_QUOTES, 'UTF-8') ?></textarea>
  </div>

  <div class="mb-3">
    <label class="form-label">Hình sản phẩm</label>
    <?php if ($currentImage !== ''): ?>
      <div class="mb-2">
        <img src="<?= htmlspecialchars($currentImage, ENT_QUOTES, 'UTF-8') ?>"
             alt="Ảnh hiện tại"
             style="max-height: 160px;" class="img-thumbnail">
      </div>
    <?php endif; ?>
    <input type="file"
           name="image"
           class="form-control"
           accept=".jpg,.jpeg,.png,.webp,.gif,.svg">
    <div class="form-text">
      Nếu không chọn ảnh mới, hệ thống sẽ giữ nguyên ảnh hiện tại (hoặc ảnh mặc định nếu chưa có).
    </div>
  </div>
  
  <button type="submit" class="btn btn-primary">Lưu</button>
  <a href="/?r=adminProduct/list" class="btn btn-secondary">Hủy</a>
</form>

