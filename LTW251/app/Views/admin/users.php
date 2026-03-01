<div class="d-flex justify-content-between align-items-center mb-3">
    <h1>Quản lý người dùng</h1>
</div>

<div class="card mb-3">
  <div class="card-body">
    <form method="get" action="<?= BASE_URL ?>/" class="row g-2 align-items-end">
      <input type="hidden" name="r" value="adminUser/list">
      
      <div class="col-md-4">
        <label class="form-label">Tìm theo tên hoặc email</label>
        <input name="q"
               class="form-control"
               placeholder="Nhập tên hoặc email..."
               value="<?= htmlspecialchars($q ?? '', ENT_QUOTES, 'UTF-8') ?>">
      </div>
      <div class="col-md-3">
        <label class="form-label">Vai trò</label>
        <select name="role" class="form-select">
          <option value="">Tất cả</option>
          <option value="admin" <?= ($role ?? '') === 'admin' ? 'selected' : '' ?>>Admin</option>
          <option value="user" <?= ($role ?? '') === 'user' ? 'selected' : '' ?>>Người dùng</option>
        </select>
      </div>
      <div class="col-md-3">
        <label class="form-label">Trạng thái</label>
        <select name="status" class="form-select">
          <option value="">Tất cả</option>
          <option value="active" <?= ($status ?? '') === 'active' ? 'selected' : '' ?>>Hoạt động</option>
          <option value="blocked" <?= ($status ?? '') === 'blocked' ? 'selected' : '' ?>>Bị khóa</option>
        </select>
      </div>
      <div class="col-md-2">
        <button class="btn btn-primary w-100" type="submit">Lọc</button>
      </div>
    </form>
  </div>
</div>

<div class="card">
  <div class="table-responsive">
    <table class="table table-vcenter card-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Họ tên</th>
          <th>Email</th>
          <th>Vai trò</th>
          <th>Trạng thái</th>
          <th>Đăng nhập gần nhất</th>
          <th class="text-nowrap">Thao tác</th>
        </tr>
      </thead>
      <tbody>
      <?php if (empty($items)): ?>
          <tr><td colspan="7" class="text-center text-muted">Không tìm thấy người dùng nào.</td></tr>
      <?php else: ?>
          <?php foreach ($items as $it): ?>
            <tr>
              <td><?= (int)$it['id'] ?></td>
              <td><?= htmlspecialchars($it['full_name'] ?? '', ENT_QUOTES, 'UTF-8') ?></td>
              <td><?= htmlspecialchars($it['email'] ?? '', ENT_QUOTES, 'UTF-8') ?></td>
              <td>
                <?php if (($it['role'] ?? '') === 'admin'): ?>
                    <span class="badge bg-purple text-purple-fg">Admin</span>
                <?php else: ?>
                    <span class="badge bg-blue text-blue-fg">User</span>
                <?php endif; ?>
              </td>
              <td>
                <?php if (!empty($it['is_blocked'])): ?>
                  <span class="badge bg-danger">Đã khóa</span>
                <?php else: ?>
                  <span class="badge bg-success">Hoạt động</span>
                <?php endif; ?>
              </td>
              <td>
                  <?= $it['last_login_at'] ? date('d/m/Y H:i', strtotime($it['last_login_at'])) : '-' ?>
              </td>
              <td class="text-nowrap">
                <?php $isAdminSelf = ($it['email'] === 'admin@example.com' && ($it['role'] ?? '') === 'admin'); ?>
                
                <?php if (!$isAdminSelf): ?>
                  <a href="<?= BASE_URL ?>/?r=adminUser/edit&id=<?= $it['id'] ?>" 
                     class="btn btn-sm btn-outline-primary" title="Xem chi tiết & Sửa">
                    <i class="bi bi-pencil-square"></i> Sửa
                  </a>

                  <form method="post" action="<?= BASE_URL ?>/?r=adminUser/toggleBlock" style="display:inline-block">
                    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf ?? '', ENT_QUOTES, 'UTF-8') ?>">
                    <input type="hidden" name="id" value="<?= (int)$it['id'] ?>">
                    <?php if (!empty($it['is_blocked'])): ?>
                      <button class="btn btn-sm btn-outline-success" type="submit" title="Mở khóa tài khoản">
                        Mở
                      </button>
                    <?php else: ?>
                      <button class="btn btn-sm btn-outline-danger" type="submit" title="Khóa tài khoản">
                        Khóa
                      </button>
                    <?php endif; ?>
                  </form>

                  <form method="post"
                        action="<?= BASE_URL ?>/?r=adminUser/resetPassword"
                        style="display:inline-block"
                        onsubmit="return confirm('Reset mật khẩu người dùng này về mặc định?')">
                    <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf ?? '', ENT_QUOTES, 'UTF-8') ?>">
                    <input type="hidden" name="id" value="<?= (int)$it['id'] ?>">
                    <button class="btn btn-sm btn-outline-info" type="submit" title="Reset mật khẩu">
                        Reset MK
                    </button>
                  </form>
                <?php else: ?>
                  <span class="text-muted small fst-italic">Admin mặc định</span>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
      <?php endif; ?>
      </tbody>
    </table>
  </div>
</div>

<?php if (!empty($totalPages) && $totalPages > 1): ?>
  <nav class="mt-3">
    <ul class="pagination justify-content-center">
      <?php for ($i = 1; $i <= $totalPages; $i++): ?>
        <?php if ($i == $page): ?>
          <li class="page-item active"><span class="page-link"><?= $i ?></span></li>
        <?php else: ?>
          <li class="page-item">
            <a class="page-link"
               href="<?= BASE_URL ?>/?r=adminUser/list&page=<?= $i ?>&q=<?= urlencode($q ?? '') ?>&role=<?= urlencode($role ?? '') ?>&status=<?= urlencode($status ?? '') ?>">
              <?= $i ?>
            </a>
          </li>
        <?php endif; ?>
      <?php endfor; ?>
    </ul>
  </nav>
<?php endif; ?>