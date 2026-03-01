<h1 class="page-title my-3">Câu hỏi FAQ từ người dùng</h1>

<div class="card card-md mb-3">
  <div class="card-body d-flex gap-2 align-items-center">
    <form method="get" class="d-flex gap-2 ms-auto align-items-center">
      <input type="hidden" name="r" value="adminFaqQuestion/list">
      <select name="status" class="form-select" style="max-width:160px">
        <option value="all">Tất cả</option>
        <option value="new" <?= ($status ?? '') === 'new' ? 'selected' : '' ?>>Chưa xử lý</option>
        <option value="resolved" <?= ($status ?? '') === 'resolved' ? 'selected' : '' ?>>Đã xử lý</option>
      </select>
      <input type="text" class="form-control" name="q" placeholder="Tìm kiếm..." value="<?= htmlspecialchars($q ?? '', ENT_QUOTES, 'UTF-8') ?>">
      <button class="btn btn-outline-secondary" type="submit">Lọc</button>
    </form>
  </div>
</div>

<div class="card">
  <div class="table-responsive">
    <table class="table table-vcenter">
      <thead>
        <tr>
          <th>#</th>
          <th>Người hỏi</th>
          <th>Email</th>
          <th>Câu hỏi</th>
          <th>Trạng thái</th>
          <th>Ngày gửi</th>
          <th>Thao tác</th>
        </tr>
      </thead>
      <tbody>
      <?php if (empty($items)): ?>
        <tr>
          <td colspan="7" class="text-center text-muted py-4">Không có câu hỏi nào</td>
        </tr>
      <?php else: ?>
        <?php foreach ($items as $it): ?>
        <tr>
          <td><?= (int)$it['id'] ?></td>
          <td><?= htmlspecialchars($it['name']) ?></td>
          <td><?= htmlspecialchars($it['email']) ?></td>
          <td>
            <div style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <?= htmlspecialchars($it['question']) ?>
            </div>
          </td>
          <td>
            <?php if ($it['is_resolved']): ?>
              <span class="badge bg-success">Đã xử lý</span>
            <?php else: ?>
              <span class="badge bg-warning">Chưa xử lý</span>
            <?php endif; ?>
          </td>
          <td><?= date('d/m/Y H:i', strtotime($it['created_at'])) ?></td>
          <td class="text-nowrap">
            <?php if (!$it['is_resolved']): ?>
              <a class="btn btn-sm btn-outline-success" href="/?r=adminFaqQuestion/resolve&action=resolve&id=<?= (int)$it['id'] ?>">Đánh dấu đã xử lý</a>
            <?php endif; ?>
            <form method="post" action="/?r=adminFaqQuestion/delete" style="display:inline" onsubmit="return confirm('Xóa câu hỏi này?')">
              <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf ?? '', ENT_QUOTES, 'UTF-8') ?>">
              <input type="hidden" name="id" value="<?= (int)$it['id'] ?>">
              <button class="btn btn-sm btn-outline-danger">Xóa</button>
            </form>
          </td>
        </tr>
        <?php endforeach; ?>
      <?php endif; ?>
      </tbody>
    </table>
  </div>
</div>
