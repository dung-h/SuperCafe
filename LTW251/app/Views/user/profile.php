<div class="container py-5">
  <div class="row justify-content-center">
    <div class="col-lg-10">
      <h1 class="fw-bold mb-4" style="color: #5D4037;">
        <i class="fas fa-user-circle me-2"></i>Tài khoản của bạn
      </h1>
<div class="container py-4">
    <div class="row mb-4 align-items-center">
        <div class="col">
            <nav aria-label="breadcrumb">
                <ol class="breadcrumb mb-1">
                    <li class="breadcrumb-item"><a href="<?= BASE_URL ?>/" class="text-decoration-none">Trang chủ</a></li>
                    <li class="breadcrumb-item active" aria-current="page">Tài khoản</li>
                </ol>
            </nav>
            <h2 class="fw-bold text-coffee-dark">Hồ sơ cá nhân</h2>
        </div>
    </div>

      <?php if (!empty($error)): ?>
        <div class="alert alert-danger alert-dismissible fade show">
          <i class="fas fa-exclamation-circle me-2"></i><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
      <?php endif; ?>
      
      <?php if (!empty($ok)): ?>
        <div class="alert alert-success alert-dismissible fade show">
          <i class="fas fa-check-circle me-2"></i><?= htmlspecialchars($ok, ENT_QUOTES, 'UTF-8') ?>
          <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
      <?php endif; ?>
    <?php if (!empty($error)): ?>
        <div class="alert alert-danger alert-dismissible fade show shadow-sm" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i> <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    <?php endif; ?>
    <?php if (!empty($ok)): ?>
        <div class="alert alert-success alert-dismissible fade show shadow-sm" role="alert">
            <i class="bi bi-check-circle-fill me-2"></i> <?= htmlspecialchars($ok, ENT_QUOTES, 'UTF-8') ?>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    <?php endif; ?>

      <div class="row g-4">
        <div class="col-md-8">
          <div class="card shadow-sm border-0">
            <div class="card-header text-white py-3" style="background-color: #5D4037;">
              <h5 class="mb-0"><i class="fas fa-user-edit me-2"></i>Thông tin cá nhân</h5>
            </div>
            <div class="card-body p-4">
              <form method="post" enctype="multipart/form-data">
                <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
                
                <div class="mb-4">
                  <label class="form-label fw-bold text-muted small">
                    <i class="fas fa-signature me-1"></i>HỌ TÊN
                  </label>
                  <input type="text" name="name" class="form-control form-control-lg" 
                         value="<?= htmlspecialchars($name ?? '', ENT_QUOTES, 'UTF-8') ?>" required>
                </div>
                
                <div class="mb-4">
                  <label class="form-label fw-bold text-muted small">
                    <i class="fas fa-envelope me-1"></i>EMAIL
                  </label>
                  <input type="email" name="email" class="form-control form-control-lg" 
                         value="<?= htmlspecialchars($email ?? '', ENT_QUOTES, 'UTF-8') ?>" required>
                </div>
                
                <div class="mb-4">
                  <label class="form-label fw-bold text-muted small">
                    <i class="fas fa-image me-1"></i>ẢNH ĐẠI DIỆN
                  </label>
                  <?php if (!empty($user['avatar_path'])): ?>
                    <div class="mb-3 text-center">
                      <img src="<?= htmlspecialchars($user['avatar_path'], ENT_QUOTES, 'UTF-8') ?>" 
                           alt="Avatar" 
                           class="rounded-circle shadow-sm"
                           style="width:120px; height:120px; object-fit:cover; border:4px solid #f8f9fa">
                    </div>
                  <?php endif; ?>
                  <input type="file" name="avatar" class="form-control" accept="image/*">
                  <div class="form-text">JPG, PNG, GIF, WEBP. Tối đa 4MB.</div>
                </div>
                
                <div class="d-grid">
                  <button type="submit" class="btn btn-coffee btn-lg">
                    <i class="fas fa-save me-2"></i>Lưu thay đổi
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card shadow-sm border-0 mb-4">
            <div class="card-header bg-secondary text-white py-3">
              <h5 class="mb-0"><i class="fas fa-shield-alt me-2"></i>Bảo mật</h5>
            </div>
            <div class="card-body p-4">
              <p class="text-muted mb-3">
                <i class="fas fa-info-circle me-1"></i>
                Bảo vệ tài khoản của bạn
              </p>
              <a href="/?r=user/changePassword" class="btn btn-outline-secondary w-100">
                <i class="fas fa-key me-2"></i>Đổi mật khẩu
              </a>
            </div>
          </div>

          <div class="card shadow-sm border-0 bg-light">
            <div class="card-body p-4">
              <h6 class="fw-bold mb-3" style="color: #5D4037;">
                <i class="fas fa-user-tag me-2"></i>Thông tin tài khoản
              </h6>
              <div class="mb-2">
                <small class="text-muted d-block">Vai trò</small>
                <span class="badge" style="background-color: #5D4037;"><?= strtoupper($user['role'] ?? 'user') ?></span>
              </div>
              <?php if (!empty($user['created_at'])): ?>
                <div class="mt-3">
                  <small class="text-muted d-block">Ngày tham gia</small>
                  <span class="text-dark"><?= date('d/m/Y', strtotime($user['created_at'])) ?></span>
                </div>
              <?php endif; ?>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>