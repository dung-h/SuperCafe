<h2>Sửa trang: <?= htmlspecialchars($page['title'] ?? '', ENT_QUOTES, 'UTF-8') ?></h2>

<?php if (!empty($error)): ?>
  <div class="alert alert-danger"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
<?php endif; ?>

<?php if (!empty($ok)): ?>
  <div class="alert alert-success"><?= htmlspecialchars($ok, ENT_QUOTES, 'UTF-8') ?></div>
<?php endif; ?>

<?php if ($page['slug'] === 'about'): ?>
  
  <form method="post" enctype="multipart/form-data">
    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">

    <div class="mb-3">
      <label class="form-label">Tiêu đề trang</label>
      <input type="text" name="page_title" class="form-control" 
             value="<?= htmlspecialchars($page['title'] ?? 'Giới thiệu') ?>" required>
    </div>

    <h4 class="mt-4">Các sections</h4>
    <div id="sections-container">
      <?php foreach ($sections as $idx => $sec): ?>
        <div class="card mb-3 section-item">
          <div class="card-body">
            <div class="row">
              <div class="col-md-3">
                <label class="form-label">Loại section</label>
                <select name="sections[<?= $idx ?>][type]" class="form-control">
                  <option value="hero" <?= ($sec['section_type'] ?? '') === 'hero' ? 'selected' : '' ?>>Hero</option>
                  <option value="card" <?= ($sec['section_type'] ?? '') === 'card' ? 'selected' : '' ?>>Card</option>
                  <option value="value" <?= ($sec['section_type'] ?? '') === 'value' ? 'selected' : '' ?>>Value</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label">Tiêu đề</label>
                <input type="text" name="sections[<?= $idx ?>][title]" class="form-control" 
                       value="<?= htmlspecialchars($sec['title'] ?? '') ?>">
              </div>
              <div class="col-md-5">
                <label class="form-label">Ảnh</label>
                <input type="file" name="sections[<?= $idx ?>][image_file]" class="form-control" accept="image/*">
                <input type="hidden" name="sections[<?= $idx ?>][image]" value="<?= htmlspecialchars($sec['image_path'] ?? '') ?>">
                <?php if (!empty($sec['image_path'])): ?>
                  <small class="text-muted">Hiện tại: <?= htmlspecialchars($sec['image_path']) ?></small>
                  <img src="<?= htmlspecialchars($sec['image_path']) ?>" style="max-width:100px;margin-top:5px;" class="d-block">
                <?php endif; ?>
              </div>
            </div>
            <div class="mt-2">
              <label class="form-label">Nội dung</label>
              <textarea name="sections[<?= $idx ?>][content]" class="form-control" rows="3"><?= htmlspecialchars($sec['content'] ?? '') ?></textarea>
            </div>
            <button type="button" class="btn btn-sm btn-danger mt-2" onclick="this.closest('.section-item').remove()">Xóa section</button>
          </div>
        </div>
      <?php endforeach; ?>
    </div>

    <button type="button" class="btn btn-secondary mb-3" id="add-section">+ Thêm section</button>

    <h4 class="mt-4">Về Lowland Coffee</h4>
    <div class="mb-3">
      <label class="form-label">Nội dung giới thiệu chung</label>
      <textarea name="page_content" class="form-control" rows="5"><?= htmlspecialchars($page['content'] ?? '', ENT_QUOTES, 'UTF-8') ?></textarea>
      <small class="text-muted">Phần này hiển thị ở cuối trang About</small>
    </div>

    <div>
      <button type="submit" class="btn btn-primary">Lưu</button>
      <a href="/?r=adminpage/list" class="btn btn-secondary">Quay lại</a>
    </div>
  </form>

  <script>
  var sectionIdx = <?= count($sections) ?>;
  document.getElementById('add-section').addEventListener('click', function(){
    var html = '<div class="card mb-3 section-item"><div class="card-body">' +
      '<div class="row">' +
      '<div class="col-md-3"><label class="form-label">Loại section</label>' +
      '<select name="sections[' + sectionIdx + '][type]" class="form-control">' +
      '<option value="hero">Hero</option><option value="card">Card</option><option value="value">Value</option>' +
      '</select></div>' +
      '<div class="col-md-4"><label class="form-label">Tiêu đề</label>' +
      '<input type="text" name="sections[' + sectionIdx + '][title]" class="form-control"></div>' +
      '<div class="col-md-5"><label class="form-label">Ảnh</label>' +
      '<input type="file" name="sections[' + sectionIdx + '][image_file]" class="form-control" accept="image/*">' +
      '<input type="hidden" name="sections[' + sectionIdx + '][image]" value=""></div>' +
      '</div>' +
      '<div class="mt-2"><label class="form-label">Nội dung</label>' +
      '<textarea name="sections[' + sectionIdx + '][content]" class="form-control" rows="3"></textarea></div>' +
      '<button type="button" class="btn btn-sm btn-danger mt-2" onclick="this.closest(\'.section-item\').remove()">Xóa section</button>' +
      '</div></div>';
    document.getElementById('sections-container').insertAdjacentHTML('beforeend', html);
    sectionIdx++;
  });
  </script>

<?php else: ?>
  
  <form method="post">
    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
    
    <div class="mb-3">
      <label class="form-label">Tiêu đề</label>
      <input type="text" name="title" class="form-control" required value="<?= htmlspecialchars($page['title'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
    </div>
    
    <div class="mb-3">
      <label class="form-label">Nội dung</label>
      <textarea name="content" class="form-control" rows="15" required><?= htmlspecialchars($page['content'] ?? '', ENT_QUOTES, 'UTF-8') ?></textarea>
    </div>
    
    <button type="submit" class="btn btn-primary">Lưu</button>
    <a href="/?r=adminpage/list" class="btn btn-secondary">Quay lại</a>
  </form>

<?php endif; ?>
