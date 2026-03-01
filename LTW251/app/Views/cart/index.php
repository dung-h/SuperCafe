<div class="container py-4">
  <div class="row">
    <div class="col-12">
      <div class="d-flex align-items-center mb-4">
        <i class="fas fa-shopping-cart fa-2x text-coffee me-3"></i>
        <h2 class="mb-0 text-coffee-dark">Giỏ hàng của bạn</h2>
      </div>

      <?php if (empty($items)): ?>
        <div class="text-center py-5">
          <div class="mb-4">
            <i class="fas fa-shopping-cart fa-5x text-muted"></i>
          </div>
          <h4 class="text-muted mb-3">Giỏ hàng trống</h4>
          <p class="text-muted mb-4">Hãy thêm một số sản phẩm tuyệt vời từ Lowland Coffee!</p>
          <a href="/?r=product/list" class="btn btn-coffee btn-lg px-4">
            <i class="fas fa-shopping-bag me-2"></i>Khám phá menu
          </a>
        </div>
      <?php else: ?>
        <div class="row">
          <div class="col-lg-8">
            <div class="card shadow-sm">
              <div class="card-header bg-coffee text-white">
                <h5 class="mb-0"><i class="fas fa-list me-2"></i>Sản phẩm đã chọn</h5>
              </div>
              <div class="card-body p-0">
                <?php foreach ($items as $index => $item): ?>
                  <div class="p-4 <?= $index < count($items) - 1 ? 'border-bottom' : '' ?>">
                    <div class="row align-items-center">
                      <div class="col-md-2 text-center mb-3 mb-md-0">
                        <?php if (!empty($item['image'])): ?>
                          <img src="<?= htmlspecialchars($item['image'], ENT_QUOTES, 'UTF-8') ?>" 
                               alt="<?= htmlspecialchars($item['name'], ENT_QUOTES, 'UTF-8') ?>"
                               class="rounded-circle" 
                               style="width: 60px; height: 60px; object-fit: cover;">
                        <?php else: ?>
                          <div class="bg-coffee-light rounded-circle d-inline-flex align-items-center justify-content-center" style="width: 60px; height: 60px;">
                            <i class="fas fa-coffee fa-lg text-white"></i>
                          </div>
                        <?php endif; ?>
                      </div>
                      <div class="col-md-4 mb-3 mb-md-0">
                        <h6 class="mb-1 fw-bold" style="color: #3E2723;"><?= htmlspecialchars($item['name'], ENT_QUOTES, 'UTF-8') ?></h6>
                        <small class="text-muted">Lowland Coffee</small>
                      </div>
                      <div class="col-md-2 mb-2 mb-md-0">
                        <span class="fw-bold" style="color: #5D4037;"><?= number_format($item['price'], 0, ',', '.') ?>đ</span>
                      </div>
                      <div class="col-md-2 mb-2 mb-md-0">
                        <div class="input-group input-group-sm">
                          <span class="input-group-text">SL:</span>
                          <input type="number" class="form-control text-center" value="<?= $item['qty'] ?>" min="1" readonly>
                        </div>
                      </div>
                      <div class="col-md-1 mb-2 mb-md-0 text-center">
                        <span class="fw-bold" style="color: #5D4037;"><?= number_format($item['subtotal'], 0, ',', '.') ?>đ</span>
                      </div>
                      <div class="col-md-1 text-center">
                        <a href="/?r=cart/remove&id=<?= $item['id'] ?>" class="btn btn-sm btn-outline-danger" title="Xóa sản phẩm">
                          <i class="fas fa-trash"></i>
                        </a>
                      </div>
                    </div>
                  </div>
                <?php endforeach; ?>
              </div>
            </div>
          </div>
          
          <div class="col-lg-4 mt-4 mt-lg-0">
            <div class="card shadow-sm sticky-top" style="top: 20px;">
              <div class="card-header bg-cream">
                <h5 class="mb-0 text-coffee-dark">
                  <i class="fas fa-calculator me-2"></i>Tạm tính đơn hàng
                </h5>
              </div>
              <div class="card-body">
                <div class="d-flex justify-content-between mb-3">
                  <span style="color: #333; font-weight: 500;">Tạm tính:</span>
                  <span class="fw-bold" style="color: #5D4037;"><?= number_format($total, 0, ',', '.') ?>đ</span>
                </div>
                <div class="d-flex justify-content-between mb-3">
                  <span style="color: #333; font-weight: 500;">Phí vận chuyển:</span>
                  <span class="text-success fw-bold">Miễn phí</span>
                </div>
                <hr>
                <div class="d-flex justify-content-between mb-4">
                  <strong class="h5" style="color: #3E2723;">Tổng cộng:</strong>
                  <strong class="h5" style="color: #5D4037;"><?= number_format($total, 0, ',', '.') ?>đ</strong>
                </div>
                
                <div class="d-grid gap-2">
                  <a href="/?r=cart/checkout" class="btn btn-coffee btn-lg">
                    <i class="fas fa-credit-card me-2"></i>Thanh toán ngay
                  </a>
                  <a href="/?r=product/list" class="btn btn-outline-coffee">
                    <i class="fas fa-arrow-left me-2"></i>Tiếp tục mua sắm
                  </a>
                </div>
                
                <div class="mt-3 p-3 bg-light rounded">
                  <small class="text-muted">
                    <i class="fas fa-shield-alt me-1"></i>
                    Thanh toán an toàn và bảo mật 100%
                  </small>
                </div>
              </div>
            </div>
          </div>
        </div>
      <?php endif; ?>
    </div>
  </div>
</div>
