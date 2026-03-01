<h1 class="page-title my-3">FAQ</h1>

<div class="card card-md mb-3">
  <div class="card-body d-flex gap-2 align-items-center">
    <a class="btn btn-primary" href="/?r=adminFaq/edit">+ Thêm câu hỏi</a>
    <form method="get" class="d-flex gap-2 ms-auto align-items-center">
      <input type="hidden" name="r" value="adminFaq/list">
      <select name="status" class="form-select" style="max-width:160px">
        <option value="">Tất cả</option>
        <option value="public" <?= ($status ?? '') === 'public' ? 'selected' : '' ?>>Đang hiển thị</option>
        <option value="hidden" <?= ($status ?? '') === 'hidden' ? 'selected' : '' ?>>Đang ẩn</option>
      </select>
      <input type="text" class="form-control" name="q" placeholder="Tìm câu hỏi..." value="<?= htmlspecialchars($q ?? '', ENT_QUOTES, 'UTF-8') ?>">
      <button class="btn btn-outline-secondary" type="submit">Lọc</button>
    </form>
  </div>
</div>

<div class="card">
  <div class="table-responsive">
    <table class="table table-vcenter" id="faq-table">
      <thead>
        <tr>
          <th style="width:36px"></th>
          <th>#</th>
          <th>Câu hỏi</th>
          <th>Trạng thái</th>
          <th class="text-nowrap">Thao tác</th>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($items as $it): ?>
        <tr draggable="true" data-id="<?= (int)$it['id'] ?>" data-public="<?= !empty($it['is_public']) ? '1' : '0' ?>">
          <td style="cursor:grab">⋮⋮</td>
          <td><?= (int)$it['id'] ?></td>
          <td><?= htmlspecialchars($it['question']) ?></td>
          <td>
            <form method="post" action="/?r=adminFaq/toggle" class="d-inline faq-toggle-form">
              <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf) ?>">
              <input type="hidden" name="id" value="<?= (int)$it['id'] ?>">
              <input type="hidden" name="is_public" value="<?= !empty($it['is_public']) ? 1 : 0 ?>">
              <?php if (!empty($it['is_public'])): ?>
                <button type="submit" class="btn btn-sm btn-outline-success">Đang hiển thị</button>
              <?php else: ?>
                <button type="submit" class="btn btn-sm btn-outline-secondary">Đang ẩn</button>
              <?php endif; ?>
            </form>
          </td>
          <td class="text-nowrap">
            <a class="btn btn-sm btn-outline-primary" href="/?r=adminFaq/edit&id=<?= (int)$it['id'] ?>">Sửa</a>
            <form method="post" action="/?r=adminFaq/delete" style="display:inline" onsubmit="return confirm('Xóa mục này?')">
              <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf) ?>">
              <input type="hidden" name="id" value="<?= (int)$it['id'] ?>">
              <button class="btn btn-sm btn-outline-danger">Xóa</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php if (!empty($totalPages) && $totalPages > 1): ?>
  <div class="mt-3">
    <nav>
      <ul class="pagination">
        <?php for ($i = 1; $i <= $totalPages; $i++): ?>
          <?php if ($i == $page): ?>
            <li class="page-item active"><span class="page-link"><?= $i ?></span></li>
          <?php else: ?>
            <li class="page-item">
              <a class="page-link" href="/?r=adminFaq/list&page=<?= $i ?>&q=<?= urlencode($q) ?>&status=<?= urlencode($status ?? '') ?>"><?= $i ?></a>
            </li>
          <?php endif; ?>
        <?php endfor; ?>
      </ul>
    </nav>
  </div>
<?php endif; ?>

<form id="reorder-form" method="post" action="/?r=adminFaq/reorder" class="d-none">
  <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf) ?>">
</form>

<script>
(function(){
  var tbody = document.querySelector('#faq-table tbody');
  if (!tbody) return;
  var dragEl = null;

  tbody.addEventListener('dragstart', function(e){
    dragEl = e.target.closest('tr');
    if (!dragEl) return;
    e.dataTransfer.effectAllowed = 'move';
  });

  tbody.addEventListener('dragover', function(e){
    e.preventDefault();
    var tr = e.target.closest('tr');
    if (!tr || tr === dragEl) return;
    var rect = tr.getBoundingClientRect();
    var after = (e.clientY - rect.top) > (rect.height / 2);
    tbody.insertBefore(dragEl, after ? tr.nextSibling : tr);
  });

  tbody.addEventListener('drop', function(e){
    e.preventDefault();
    updatePositionsAndSend();
  });

  function updatePositionsAndSend(){
    var rows = tbody.querySelectorAll('tr');
    var ids = [];
    for (var i = 0; i < rows.length; i++) {
      rows[i].querySelector('.pos').textContent = i;
      ids.push(rows[i].getAttribute('data-id'));
    }
    var form = document.getElementById('reorder-form');
    var fd = new FormData(form);
    for (var j = 0; j < ids.length; j++) {
      fd.append('ids[]', ids[j]);
    }
    fetch(form.action, { method: 'POST', body: fd })
      .then(function(r){ return r.json(); })
      .catch(function(){});
  }

  tbody.addEventListener('submit', function(e){
    var form = e.target.closest('.faq-toggle-form');
    if (!form) return;
    e.preventDefault();

    var fd = new FormData(form);
    fetch(form.action, {
      method: 'POST',
      body: fd,
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data || !data.ok) return;
      var btn = form.querySelector('button');
      var input = form.querySelector('input[name="is_public"]');
      var tr = form.closest('tr');
      input.value = data.is_public ? '1' : '0';
      tr.dataset.public = data.is_public ? '1' : '0';
      if (data.is_public) {
        btn.textContent = 'Đang hiển thị';
        btn.classList.remove('btn-outline-secondary');
        btn.classList.add('btn-outline-success');
      } else {
        btn.textContent = 'Đang ẩn';
        btn.classList.remove('btn-outline-success');
        btn.classList.add('btn-outline-secondary');
      }
    })
    .catch(function(){
      form.submit();
    });
  });
})();
</script>
