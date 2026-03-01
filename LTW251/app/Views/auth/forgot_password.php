<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-md-5">
            <div class="card shadow-sm border-0">
                <div class="card-body p-4 text-center">
                    <h3 class="mb-3 text-coffee">Quên mật khẩu?</h3>
                    <p class="text-muted mb-4">Nhập email của bạn, chúng tôi sẽ gửi link đặt lại mật khẩu.</p>

                    <?php if (!empty($error)): ?>
                        <div class="alert alert-danger"><?= $error ?></div>
                    <?php endif; ?>
                    <?php if (!empty($success)): ?>
                        <div class="alert alert-success"><?= $success ?></div>
                    <?php endif; ?>

                    <form method="post">
                        <div class="mb-3 text-start">
                            <label class="form-label">Email đăng ký</label>
                            <input type="email" name="email" class="form-control" required placeholder="name@example.com">
                        </div>
                        <div class="d-grid">
                            <button type="submit" class="btn btn-primary">Gửi yêu cầu</button>
                        </div>
                    </form>
                    <div class="mt-3">
                        <a href="<?= BASE_URL ?>/?r=auth/login" class="text-decoration-none text-muted">Quay lại đăng nhập</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>