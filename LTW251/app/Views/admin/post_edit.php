<h2><?= isset($post) ? 'Sửa bài viết' : 'Thêm bài viết mới' ?></h2>

<?php if (isset($error)): ?>
  <div class="alert alert-danger"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
<?php endif; ?>

<form method="post" enctype="multipart/form-data">
  <input type="hidden" name="_csrf" value="<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>">
  
  <div class="mb-3">
    <label class="form-label">Tiêu đề *</label>
    <input type="text" name="title" class="form-control" required value="<?= htmlspecialchars($post['title'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  
  <div class="mb-3">
    <label class="form-label">Mô tả ngắn</label>
    <input type="text" name="excerpt" class="form-control" maxlength="255" value="<?= htmlspecialchars($post['excerpt'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>
  
  <div class="mb-3">
    <label class="form-label">Nội dung</label>
    <textarea name="content" class="form-control" rows="15"><?= htmlspecialchars($post['content'] ?? '', ENT_QUOTES, 'UTF-8') ?></textarea>
  </div>

  <div class="mb-3">
    <label class="form-label">Ảnh bìa bài viết</label>
    <input type="file" name="image" class="form-control" accept=".jpg,.jpeg,.png,.webp,.gif,.svg">
  </div>
  
  <button type="submit" class="btn btn-primary">Lưu</button>
  <a href="/?r=adminpost/list" class="btn btn-secondary">Hủy</a>
</form>

