<h1 class="page-title my-3"><?= isset($faq) ? 'Sửa FAQ' : 'Thêm FAQ' ?></h1>

<?php if (!empty($error)): ?>
  <div class="alert alert-danger" role="alert"><?= htmlspecialchars($error) ?></div>
<?php endif; ?>

<form method="post" class="card card-md" onsubmit="syncQuill()">
  <div class="card-body">
    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf) ?>">
    <div class="mb-3">
      <label class="form-label">Vị trí (số nhỏ → lên đầu)</label>
      <input type="number" class="form-control" name="position" value="<?= isset($faq)?(int)$faq['position']:0 ?>">
    </div>
    <div class="mb-3">
      <label class="form-label">Câu hỏi</label>
      <input class="form-control" name="question" value="<?= htmlspecialchars($faq['question'] ?? '') ?>" required>
    </div>
    <div class="mb-3">
      <label class="form-label">Trả lời</label>
      <div id="editor" style="height: 220px; background:#fff;"></div>
      <textarea class="d-none" name="answer" id="answer"><?= htmlspecialchars($faq['answer'] ?? '') ?></textarea>
    </div>
    <button class="btn btn-primary">Lưu</button>
  </div>
</form>

<link href="https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.snow.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/quill@1.3.7/dist/quill.min.js"></script>
<script>
  const quill = new Quill('#editor', { theme: 'snow' });
  
  // Load nội dung HTML từ textarea vào editor (không escape)
  const existingContent = document.getElementById('answer').value;
  if (existingContent) {
    quill.root.innerHTML = existingContent;
  }
  
  function syncQuill(){ 
    document.getElementById('answer').value = quill.root.innerHTML.trim(); 
  }
</script>
