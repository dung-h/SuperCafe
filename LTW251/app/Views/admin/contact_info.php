<h2>Cấu hình thông tin liên hệ</h2>

<?php if (!empty($error)): ?>
  <div class="alert alert-danger"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
<?php endif; ?>

<?php if (!empty($success)): ?>
  <div class="alert alert-success"><?= htmlspecialchars($success, ENT_QUOTES, 'UTF-8') ?></div>
<?php endif; ?>

<form method="post">
  <input type="hidden" name="_csrf" value="<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>">

  <div class="mb-3">
    <label class="form-label">Địa chỉ</label>
    <textarea name="address" class="form-control" rows="2" required><?= htmlspecialchars($info['address'] ?? '', ENT_QUOTES, 'UTF-8') ?></textarea>
  </div>

  <div class="mb-3">
    <label class="form-label">Điện thoại</label>
    <input type="text" name="phone" class="form-control" required value="<?= htmlspecialchars($info['phone'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>

  <div class="mb-3">
    <label class="form-label">Email</label>
    <input type="email" name="email" class="form-control" required value="<?= htmlspecialchars($info['email'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>

  <div class="mb-3">
    <label class="form-label">Giờ mở cửa</label>
    <input type="text" name="opening_hours" class="form-control" required value="<?= htmlspecialchars($info['opening_hours'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
  </div>

  <button type="submit" class="btn btn-primary">Lưu</button>
  <a href="/?r=admin/contacts" class="btn btn-secondary">Quay lại</a>
</form>

