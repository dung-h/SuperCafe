<h2>Quản lý trang</h2>

<table class="table table-bordered">
  <thead>
    <tr>
      <th>Slug</th>
      <th>Tiêu đề</th>
      <th>Cập nhật</th>
      <th>Thao tác</th>
    </tr>
  </thead>
  <tbody>
    <?php foreach ($pages as $p): ?>
      <tr>
        <td><?= htmlspecialchars($p['slug'], ENT_QUOTES, 'UTF-8') ?></td>
        <td><?= htmlspecialchars($p['title'], ENT_QUOTES, 'UTF-8') ?></td>
        <td><?= date('d/m/Y H:i', strtotime($p['updated_at'])) ?></td>
        <td>
          <a href="/?r=adminpage/edit&slug=<?= urlencode($p['slug']) ?>" class="btn btn-sm btn-info">Sửa</a>
        </td>
      </tr>
    <?php endforeach; ?>
  </tbody>
</table>
