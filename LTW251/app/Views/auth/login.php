<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <div class="text-center mb-4">
        <div class="mb-3">
          <i class="fas fa-coffee fa-3x text-coffee"></i>
        </div>
        <h2 class="text-coffee-dark">Chào mừng trở lại!</h2>
        <p class="text-muted">Đăng nhập vào tài khoản Lowland Coffee của bạn.</p>
      </div>

      <?php if (!empty($error)): ?>
        <div class="alert alert-danger border-0 shadow-sm mb-4">
          <i class="fas fa-exclamation-circle me-2"></i>
          <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
        </div>
      <?php endif; ?>

      <div class="card shadow-sm border-0">
        <div class="card-body p-4">
          <form method="post" id="login-form">
            <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
            
            <div class="mb-3">
              <label for="email" class="form-label fw-semibold text-coffee-dark">
                <i class="fas fa-envelope me-2"></i>Email
              </label>
              <input type="email" class="form-control form-control-lg" id="email" name="email" 
                     value="<?= htmlspecialchars($email ?? '', ENT_QUOTES, 'UTF-8') ?>" 
                     placeholder="Nhập email của bạn" required>
            </div>

            <div class="mb-2"> <label for="password" class="form-label fw-semibold text-coffee-dark">
                <i class="fas fa-lock me-2"></i>Mật khẩu
              </label>
              <input type="password" class="form-control form-control-lg" id="password" name="password" 
                     placeholder="Nhập mật khẩu" required>
            </div>

            <div class="text-end mb-4">
                <a href="<?= BASE_URL ?>/?r=auth/forgotPassword" class="text-decoration-none text-muted small">
                    Quên mật khẩu?
                </a>
            </div>

            <div class="d-grid mb-3">
              <button type="submit" class="btn btn-coffee btn-lg">
                <i class="fas fa-sign-in-alt me-2"></i>Đăng nhập
              </button>
            </div>

            <div class="text-center">
              <p class="text-muted mb-2">Chưa có tài khoản?</p>
              <a href="/?r=auth/register" class="btn btn-outline-coffee">
                <i class="fas fa-user-plus me-2"></i>Tạo tài khoản mới
              </a>
            </div>
          </form>
        </div>
      </div>

      <div class="text-center mt-4">
        <small class="text-muted">
          <i class="fas fa-shield-alt me-1"></i>
          Thông tin của bạn được bảo mật hoàn toàn.
        </small>
      </div>
    </div>
  </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('login-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    var email = form.elements['email'].value.trim();
    var password = form.elements['password'].value.trim();
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !password) {
      e.preventDefault();
      alert('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }
    if (!emailPattern.test(email)) {
      e.preventDefault();
      alert('Email không hợp lệ. Vui lòng kiểm tra lại.');
    }
  });
});
</script>