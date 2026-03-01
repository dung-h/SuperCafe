<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <div class="text-center mb-4">
        <div class="mb-3">
          <i class="fas fa-user-plus fa-3x text-coffee"></i>
        </div>
        <h2 class="text-coffee-dark">Tham gia Lowland Coffee</h2>
        <p class="text-muted">Tạo tài khoản để trải nghiệm những hương vị cà phê tuyệt vời.</p>
      </div>

      <?php if (!empty($error)): ?>
        <div class="alert alert-danger border-0 shadow-sm mb-4">
          <i class="fas fa-exclamation-circle me-2"></i>
          <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
        </div>
      <?php endif; ?>

      <div class="card shadow-sm border-0">
        <div class="card-body p-4">
          <form method="post" id="register-form">
            <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
            
            <div class="mb-3">
              <label for="name" class="form-label fw-semibold text-coffee-dark">
                <i class="fas fa-user me-2"></i>Họ và tên
              </label>
              <input type="text" class="form-control form-control-lg" id="name" name="name" 
                     value="<?= htmlspecialchars($name ?? '', ENT_QUOTES, 'UTF-8') ?>" 
                     placeholder="Nhập họ và tên" required>
            </div>

            <div class="mb-3">
              <label for="phone" class="form-label fw-semibold text-coffee-dark">
                <i class="fas fa-phone me-2"></i>Số điện thoại
              </label>
              <input type="tel" class="form-control form-control-lg" id="phone" name="phone" 
                     value="<?= htmlspecialchars($phone ?? '', ENT_QUOTES, 'UTF-8') ?>" 
                     placeholder="Nhập số điện thoại" required>
            </div>

            <div class="mb-3">
              <label for="email" class="form-label fw-semibold text-coffee-dark">
                <i class="fas fa-envelope me-2"></i>Email
              </label>
              <input type="email" class="form-control form-control-lg" id="email" name="email" 
                     value="<?= htmlspecialchars($email ?? '', ENT_QUOTES, 'UTF-8') ?>" 
                     placeholder="Nhập email của bạn" required>
            </div>

            <div class="mb-3">
              <label for="password" class="form-label fw-semibold text-coffee-dark">
                <i class="fas fa-lock me-2"></i>Mật khẩu
              </label>
              <input type="password" class="form-control form-control-lg" id="password" name="password" 
                     placeholder="Tạo mật khẩu mạnh" required>
            </div>

            <div class="mb-4">
              <label for="password_confirm" class="form-label fw-semibold text-coffee-dark">
                <i class="fas fa-lock me-2"></i>Nhập lại mật khẩu
              </label>
              <input type="password" class="form-control form-control-lg" id="password_confirm" name="password_confirm" 
                     placeholder="Xác nhận mật khẩu" required>
            </div>

            <div class="d-grid mb-3">
              <button type="submit" class="btn btn-coffee btn-lg">
                <i class="fas fa-user-plus me-2"></i>Tạo tài khoản
              </button>
            </div>

            <div class="text-center">
              <p class="text-muted mb-2">Đã có tài khoản?</p>
              <a href="/?r=auth/login" class="btn btn-outline-coffee">
                <i class="fas fa-sign-in-alt me-2"></i>Đăng nhập ngay
              </a>
            </div>
          </form>
        </div>
      </div>

      <div class="text-center mt-4">
        <small class="text-muted">
          <i class="fas fa-shield-alt me-1"></i>
          Bằng cách đăng ký, bạn đồng ý với điều khoản sử dụng của Lowland Coffee.
        </small>
      </div>
    </div>
  </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('register-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    var name = form.elements['name'].value.trim();
    var phone = form.elements['phone'].value.trim();
    var email = form.elements['email'].value.trim();
    var password = form.elements['password'].value;
    var confirmPassword = form.elements['password_confirm'].value;
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var phonePattern = /^[0-9]{9,11}$/;
    if (!name || !phone || !email || !password || !confirmPassword) {
      e.preventDefault();
      alert('Vui lòng nhập đầy đủ họ tên, số điện thoại, email và mật khẩu.');
      return;
    }
    if (!phonePattern.test(phone)) {
      e.preventDefault();
      alert('Số điện thoại không hợp lệ.');
      return;
    }
    if (!emailPattern.test(email)) {
      e.preventDefault();
      alert('Email không hợp lệ. Vui lòng kiểm tra lại.');
      return;
    }
    if (password.length < 6) {
      e.preventDefault();
      alert('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      e.preventDefault();
      alert('Mật khẩu xác nhận không trùng khớp.');
    }
  });
});
</script>
