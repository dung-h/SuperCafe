<h1>Reset mật khẩu</h1>

<div class="card">
  <p>Đã reset mật khẩu cho người dùng:</p>
  <ul>
    <li>ID: <?= (int)$user['id'] ?></li>
    <li>Email: <?= htmlspecialchars($user['email'], ENT_QUOTES, 'UTF-8') ?></li>
  </ul>
  <p>Mật khẩu mới là:</p>
  <pre><?= htmlspecialchars($newPass, ENT_QUOTES, 'UTF-8') ?></pre>
  <p class="mt-2">
    <a class="btn" href="/?r=adminUser/list">Quay lại danh sách người dùng</a>
  </p>
</div>

