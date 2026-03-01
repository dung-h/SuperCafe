<h2>Trả lời câu hỏi FAQ</h2>

<?php if (!empty($error)): ?>
  <div class="alert alert-danger"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
<?php endif; ?>

<?php if (!empty($success)): ?>
  <div class="alert alert-success"><?= htmlspecialchars($success, ENT_QUOTES, 'UTF-8') ?></div>
<?php endif; ?>

<div class="card mb-3">
  <div class="card-header">
    <h3 class="card-title">Thông tin câu hỏi</h3>
  </div>
  <div class="card-body">
    <div class="row mb-3">
      <div class="col-md-6">
        <strong>Người hỏi:</strong> <?= htmlspecialchars($item['name']) ?>
      </div>
      <div class="col-md-6">
        <strong>Email:</strong> <?= htmlspecialchars($item['email']) ?>
      </div>
    </div>
    <div class="mb-3">
      <strong>Ngày gửi:</strong> <?= date('d/m/Y H:i', strtotime($item['created_at'])) ?>
    </div>
    <div class="mb-3">
      <strong>Câu hỏi:</strong>
      <div class="p-3 bg-light rounded mt-2">
        <?= nl2br(htmlspecialchars($item['question'])) ?>
      </div>
    </div>
    <?php if ($item['is_answered']): ?>
      <div class="mb-3">
        <strong>Trả lời lúc:</strong> <?= date('d/m/Y H:i', strtotime($item['answered_at'])) ?>
      </div>
      <div class="mb-3">
        <strong>Trạng thái:</strong>
        <?php if ($item['is_public']): ?>
          <span class="badge bg-info">Đang hiển thị công khai</span>
        <?php else: ?>
          <span class="badge bg-secondary">Chưa công khai</span>
        <?php endif; ?>
      </div>
    <?php endif; ?>
  </div>
</div>

<form method="post">
  <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
  
  <div class="card mb-3">
    <div class="card-header">
      <h3 class="card-title">Câu trả lời</h3>
    </div>
    <div class="card-body">
      <div class="mb-3">
        <label class="form-label">Nội dung trả lời <span class="text-danger">*</span></label>
        <textarea name="answer" class="form-control" rows="8" required><?= htmlspecialchars($item['answer'] ?? '', ENT_QUOTES, 'UTF-8') ?></textarea>
        <small class="text-muted">Câu trả lời sẽ được gửi qua email cho người hỏi.</small>
      </div>
      
      <div class="mb-3">
        <label class="form-check">
          <input type="checkbox" name="is_public" class="form-check-input" value="1" <?= !empty($item['is_public']) ? 'checked' : '' ?>>
          <span class="form-check-label">Hiển thị câu hỏi và câu trả lời này công khai trên trang FAQ</span>
        </label>
        <small class="text-muted d-block">Nếu chọn, câu hỏi và câu trả lời sẽ được thêm vào danh sách FAQ công khai để người dùng khác tham khảo.</small>
      </div>
    </div>
  </div>
  
  <button type="submit" class="btn btn-primary">Lưu câu trả lời</button>
  <a href="/?r=adminFaqQuestion/list" class="btn btn-secondary">Quay lại</a>
</form>
