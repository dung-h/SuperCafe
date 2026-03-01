<div class="container py-5">
  <div class="row">
    <!-- SIDEBAR ĐƠN HÀNG -->
    <div class="col-lg-4 order-lg-2 mb-4 mb-lg-0">
      <div class="card shadow-sm border-0">
        <div class="card-header bg-coffee text-white">
          <h5 class="mb-0"><i class="fas fa-shopping-bag me-2"></i>Sản phẩm đã chọn</h5>
        </div>
        <div class="card-body">
          <div class="space-y-3">
            <?php foreach ($items as $item): ?>
              <div class="d-flex justify-content-between align-items-start pb-3 border-bottom">
                <div>
                  <?php if (!empty($item['image'])): ?>
                    <img src="<?= htmlspecialchars($item['image'], ENT_QUOTES, 'UTF-8') ?>" 
                         alt="<?= htmlspecialchars($item['name'], ENT_QUOTES, 'UTF-8') ?>"
                         class="rounded" 
                         style="width: 50px; height: 50px; object-fit: cover; margin-bottom: 0.5rem;">
                  <?php endif; ?>
                  <div>
                    <small class="text-muted d-block"><?= htmlspecialchars($item['name'], ENT_QUOTES, 'UTF-8') ?></small>
                    <small class="text-muted">x<?= $item['qty'] ?></small>
                  </div>
                </div>
                <strong class="text-coffee"><?= number_format($item['subtotal'], 0, ',', '.') ?>đ</strong>
              </div>
            <?php endforeach; ?>
          </div>

          <div class="mt-4 pt-3 border-top">
            <div class="d-flex justify-content-between align-items-center">
              <h6 class="mb-0">Tạm tính đơn hàng</h6>
              <h5 class="text-coffee fw-bold mb-0"><?= number_format($total, 0, ',', '.') ?>đ</h5>
            </div>
            <small class="text-muted d-block mt-2">Miễn phí vận chuyển</small>
          </div>
        </div>
      </div>
    </div>

    <!-- FORM THANH TOÁN -->
    <div class="col-lg-8 order-lg-1">
      <div class="card shadow-sm border-0">
        <div class="card-header bg-white border-bottom">
          <h4 class="mb-0"><i class="fas fa-info-circle me-2"></i>Thông tin nhận hàng</h4>
        </div>
        <div class="card-body p-4">
          <?php if (isset($error) && $error): ?>
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
              <i class="fas fa-exclamation-triangle me-2"></i><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
              <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
          <?php endif; ?>

          <form method="post" id="checkout-form">
            <input type="hidden" name="_csrf" value="<?= htmlspecialchars($this->csrfToken(), ENT_QUOTES, 'UTF-8') ?>">
            
            <div class="mb-4">
              <label class="form-label fw-bold">Họ tên <span class="text-danger">*</span></label>
              <input type="text" name="name" class="form-control form-control-lg" required placeholder="Nhập họ tên đầy đủ">
            </div>
            
            <div class="mb-4">
              <label class="form-label fw-bold">Số điện thoại <span class="text-danger">*</span></label>
              <input type="tel" name="phone" class="form-control form-control-lg" required placeholder="Ví dụ: 0901234567">
            </div>
            
            <div class="mb-4">
              <label class="form-label fw-bold">Email <span class="text-danger">*</span></label>
              <input type="email" name="email" class="form-control form-control-lg" required placeholder="Ví dụ: user@example.com">
            </div>

            <div class="mb-4">
              <label class="form-label fw-bold">Địa chỉ nhận hàng <span class="text-danger">*</span></label>
              <input type="text" name="address" class="form-control form-control-lg" required placeholder="Nhập đầy đủ địa chỉ nhận hàng">
            </div>

            <div class="d-grid gap-2">
              <button type="submit" class="btn btn-success btn-lg fw-bold">
                <i class="fas fa-check-circle me-2"></i>Hoàn tất thanh toán
              </button>
              <a href="/?r=cart/index" class="btn btn-outline-secondary btn-lg">
                <i class="fas fa-arrow-left me-2"></i>Quay lại giỏ hàng
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('checkout-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    var name = form.elements['name'].value.trim();
    var phone = form.elements['phone'].value.trim();
    var email = form.elements['email'].value.trim();
    var address = form.elements['address'].value.trim();
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    var phonePattern = /^[0-9]{9,11}$/;
    if (!name || !phone || !email || !address) {
      e.preventDefault();
      alert('Vui lòng nhập đầy đủ họ tên, số điện thoại, email và địa chỉ.');
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
    }
  });
});
</script>
