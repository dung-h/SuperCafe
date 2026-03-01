<div class="container py-4">
  <h1 class="mb-3"><?= htmlspecialchars($post['title']) ?></h1>
  <p class="text-muted mb-2"><em><?= htmlspecialchars($post['excerpt'] ?? '') ?></em></p>
  <p class="text-muted mb-4">
    <?= htmlspecialchars($post['author'] ?? 'Lowland Team') ?> ·
    <?= !empty($post['created_at']) ? date('d/m/Y', strtotime($post['created_at'])) : '' ?>
  </p>

  <?php if (!empty($post['image'])): ?>
    <div class="mb-4">
      <img src="<?= htmlspecialchars($post['image']) ?>" alt="<?= htmlspecialchars($post['title']) ?>" class="img-fluid rounded shadow-sm">
    </div>
  <?php endif; ?>

  <div class="card shadow-sm border-0">
    <div class="card-body">
      <div class="post-content">
        <?= $post['content'] ?? '' ?>
      </div>
    </div>
  </div>

  <hr class="my-4">

  <!-- Comments Section -->
  <div id="comments">
    <h3 class="mb-4">Bình luận (<?= count($comments) ?>)</h3>

    <!-- Add Comment Form -->
    <div class="card shadow-sm border-0 mb-4">
      <div class="card-body">
        <h5 class="card-title">Gửi bình luận của bạn</h5>
        <form action="/?r=post/addComment" method="POST">
          <input type="hidden" name="post_id" value="<?= $post['id'] ?>">
          <input type="hidden" name="_csrf" value="<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>">
          <?php if (!isset($_SESSION['user_id'])): ?>
            <div class="mb-3">
              <label for="author_name" class="form-label">Tên của bạn</label>
              <input type="text" class="form-control" id="author_name" name="author_name" required>
            </div>
          <?php endif; ?>
          <div class="mb-3">
            <label for="content" class="form-label">Nội dung bình luận</label>
            <textarea class="form-control" id="content" name="content" rows="3" required></textarea>
          </div>
          <button type="submit" class="btn btn-primary">Gửi bình luận</button>
        </form>
      </div>
    </div>

    <!-- Comments List -->
    <?php if (empty($comments)): ?>
      <p>Chưa có bình luận nào. Hãy là người đầu tiên!</p>
    <?php else: ?>
      <?php foreach ($comments as $comment): ?>
        <div class="d-flex mb-3">
          <div class="flex-shrink-0">
            <img src="<?= htmlspecialchars($comment['avatar_path'] ?? '/assets/images/noimage.svg') ?>" alt="Avatar" class="rounded-circle" width="50" height="50">
          </div>
          <div class="ms-3 flex-grow-1">
            <div class="fw-bold">
              <?= htmlspecialchars($comment['full_name'] ?? $comment['author_name'] ?? 'Anonymous') ?>
            </div>
            <div class="text-muted small">
              <?= date('d/m/Y H:i', strtotime($comment['created_at'])) ?>
            </div>
            <p class="mt-1 mb-0"><?= nl2br(htmlspecialchars($comment['content'])) ?></p>
          </div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>

  <p class="mt-3">
    <a class="btn btn-outline-secondary" href="/?r=post/list">← Quay lại danh sách</a>
  </p>
</div>
