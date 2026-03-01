<div class="container py-5">
  <!-- Tiêu đề 3 ô nhỏ ở trên -->
  <div class="row mb-5 text-center">
    <div class="col-md-4 mb-4 mb-md-0">
      <div class="p-4 bg-white shadow-sm rounded h-100">
        <div class="text-coffee mb-3"><i class="fas fa-map-marker-alt fa-2x"></i></div>
        <h5 class="fw-bold mb-2">Địa chỉ</h5>
        <p class="text-muted mb-0 small">
          <?= nl2br(htmlspecialchars($contactSettings['address'] ?? '268 Lý Thường Kiệt, Q.10, TP.HCM', ENT_QUOTES, 'UTF-8')) ?>
        </p>
      </div>
    </div>
    <div class="col-md-4 mb-4 mb-md-0">
      <div class="p-4 bg-white shadow-sm rounded h-100">
        <div class="text-coffee mb-3"><i class="fas fa-phone-alt fa-2x"></i></div>
        <h5 class="fw-bold mb-2">Điện thoại</h5>
        <p class="text-muted mb-0">
          <?= htmlspecialchars($contactSettings['phone'] ?? '0123 456 789', ENT_QUOTES, 'UTF-8') ?>
        </p>
      </div>
    </div>
    <div class="col-md-4">
      <div class="p-4 bg-white shadow-sm rounded h-100">
        <div class="text-coffee mb-3"><i class="fas fa-envelope fa-2x"></i></div>
        <h5 class="fw-bold mb-2">Email</h5>
        <p class="text-muted mb-0">
          <?= htmlspecialchars($contactSettings['email'] ?? 'phedecoffee@gmail.com', ENT_QUOTES, 'UTF-8') ?>
        </p>
      </div>
    </div>
  </div>

  <!-- PHẦN CHÍNH: 2 CỘT DỌC (Form bên trái – Bản đồ bên phải) -->
  <div class="row g-5 align-items-start">
    
    <!-- CỘT TRÁI: Form liên hệ (50%) -->
    <div class="col-lg-6">
      <div class="card shadow-lg border-0 h-100">
        <div class="card-body p-5">
          <div class="text-center mb-4">
            <h2 class="fw-bold text-coffee-dark">Gửi tin nhắn cho chúng tôi</h2>
            <p class="text-muted">Chúng tôi phản hồi trong vòng 2–4 giờ</p>
          </div>

          <?php if (!empty($message)): ?>
            <div class="alert alert-success d-flex align-items-center" role="alert">
              <i class="fas fa-check-circle me-2"></i>
              <div><?= htmlspecialchars($message, ENT_QUOTES, 'UTF-8') ?></div>
            </div>
          <?php endif; ?>

          <form method="post" id="contact-form">
            <div class="row">
              <div class="col-12 mb-3">
                <label class="form-label text-muted small fw-bold">HỌ & TÊN</label>
                <input type="text" name="name" class="form-control" required placeholder="Nguyễn Văn A">
              </div>
              <div class="col-12 mb-3">
                <label class="form-label text-muted small fw-bold">EMAIL</label>
                <input type="email" name="email" class="form-control" required placeholder="example@gmail.com">
              </div>
              <div class="col-12 mb-4">
                <label class="form-label text-muted small fw-bold">NỘI DUNG TIN NHẮN</label>
                <textarea name="message" class="form-control" rows="6" required placeholder="Bạn muốn hỏi gì về menu, đặt chỗ hay góp ý?"></textarea>
              </div>
            </div>

            <div class="text-center">
              <button type="submit" class="btn btn-coffee btn-lg px-5 fw-bold shadow-sm">
                Gửi ngay
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- CỘT PHẢI: Bản đồ Google Maps (50%) -->
    <div class="col-lg-6">
      <div class="card shadow-lg border-0 h-100 overflow-hidden">
        <div class="card-header bg-dark text-white text-center py-3">
          <h4 class="mb-0 fw-bold">Vị trí quán Phê Đi Coffee</h4>
        </div>
        <div class="card-body p-0">
          <div class="ratio ratio-16x9">
            <iframe 
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4777.207945000932!2d106.65817769618629!3d10.772081646838936!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752ec3c161a3fb%3A0xef77cd47a1cc691e!2zVHLGsOG7nW5nIMSQ4bqhaSBo4buNYyBCw6FjaCBraG9hIC0gxJDhuqFpIGjhu41jIFF14buRYyBnaWEgVFAuSENN!5e0!3m2!1svi!2s!4v1765077506787!5m2!1svi!2s" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade">              width="100%" 
              height="100%" 
              style="border:0;" 
              allowfullscreen="" 
              loading="lazy" 
              referrerpolicy="no-referrer-when-downgrade">
            </iframe>
          </div>
        </div>
        <div class="card-footer bg-light text-center py-3">
          <p class="mb-1 fw-bold">268 Lý Thường Kiệt, P.14, Q.10, TP.HCM</p>
          <a href="https://maps.app.goo.gl/xyz123" target="_blank" class="btn btn-danger btn-sm">
            Chỉ đường ngay
          </a>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- CSS vẫn giữ nguyên -->
<style>
.text-coffee { color: #6f4e37 !important; }
.text-coffee-dark { color: #4a2c1e !important; }
.btn-coffee {
  background: linear-gradient(45deg, #8b4513, #a0522d);
  color: white;
  border: none;
  transition: all 0.3s;
}
.btn-coffee:hover {
  background: linear-gradient(45deg, #6f4e37, #8b4513);
  transform: translateY(-3px);
  box-shadow: 0 10px 20px rgba(139,69,19,0.3);
}
.form-control:focus {
  border-color: #8b4513;
  box-shadow: 0 0 0 0.2rem rgba(139,69,19,0.25);
}
</style>

<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('contact-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    var name = form.elements['name'].value.trim();
    var email = form.elements['email'].value.trim();
    var message = form.elements['message'].value.trim();
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !email || !message) {
      e.preventDefault();
      alert('Vui lòng nhập đầy đủ họ tên, email và nội dung.');
      return;
    }
    if (!emailPattern.test(email)) {
      e.preventDefault();
      alert('Email không hợp lệ. Vui lòng kiểm tra lại.');
    }
  });
});
</script>

