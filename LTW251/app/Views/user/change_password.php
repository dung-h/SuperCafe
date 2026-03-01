<style>
    /* Căn giữa form ra giữa màn hình */
    .password-page-wrapper {
        display: flex;
        justify-content: center;
        padding-top: 40px;
        padding-bottom: 60px;
    }

    /* Tạo khung thẻ Card đẹp mắt */
    .password-card {
        background-color: #ffffff;
        width: 100%;
        max-width: 450px; /* Giới hạn chiều rộng để không bị bè ra */
        padding: 40px;
        border-radius: 12px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.08); /* Đổ bóng nhẹ */
        border-top: 5px solid #6d4c41; /* Màu nâu chủ đạo */
    }

    /* Header của form */
    .card-header {
        text-align: center;
        margin-bottom: 30px;
    }
    .header-icon {
        font-size: 3rem;
        color: #6d4c41;
        margin-bottom: 10px;
    }
    .card-header h2 {
        margin: 0;
        color: #333;
        font-size: 1.5rem;
    }

    /* Style cho các ô input */
    .form-group {
        margin-bottom: 20px;
    }
    .form-group label {
        display: block;
        margin-bottom: 8px;
        font-weight: 600;
        color: #555;
    }
    .form-control-custom {
        width: 100%;
        padding: 12px 15px;
        border: 1px solid #ddd;
        border-radius: 8px;
        font-size: 1rem;
        box-sizing: border-box; /* Quan trọng: để padding không làm vỡ khung */
        transition: border-color 0.3s;
    }
    .form-control-custom:focus {
        outline: none;
        border-color: #6d4c41;
        box-shadow: 0 0 0 3px rgba(109, 76, 65, 0.1);
    }

    /* Style cho nút bấm */
    .btn-submit {
        width: 100%;
        padding: 12px;
        background-color: #6d4c41;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: bold;
        cursor: pointer;
        transition: background 0.3s;
        margin-top: 10px;
    }
    .btn-submit:hover {
        background-color: #5d4037;
    }
    
    .btn-cancel {
        display: block;
        width: 100%;
        text-align: center;
        margin-top: 15px;
        color: #888;
        text-decoration: none;
        font-size: 0.9rem;
    }
    .btn-cancel:hover {
        color: #333;
        text-decoration: underline;
    }

    /* Thông báo lỗi/thành công */
    .alert-box {
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 20px;
        font-size: 0.95rem;
    }
    .alert-error {
        background-color: #fde8e8;
        color: #c53030;
        border: 1px solid #fbd5d5;
    }
    .alert-ok {
        background-color: #def7ec;
        color: #03543f;
        border: 1px solid #bcf0da;
    }
</style>

<div class="password-page-wrapper">
    <div class="password-card">
        
        <div class="card-header">
            <div class="header-icon">
                <i class="bi bi-shield-lock"></i> </div>
            <h2>Đổi mật khẩu</h2>
        </div>

        <?php if (!empty($error)): ?>
            <div class="alert-box alert-error">
                <i class="bi bi-exclamation-circle-fill"></i> <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
            </div>
        <?php endif; ?>
        <?php if (!empty($ok)): ?>
            <div class="alert-box alert-ok">
                <i class="bi bi-check-circle-fill"></i> <?= htmlspecialchars($ok, ENT_QUOTES, 'UTF-8') ?>
            </div>
        <?php endif; ?>

        <form method="post">
            <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">
            
            <div class="form-group">
                <label>Mật khẩu hiện tại</label>
                <input type="password" name="current_password" class="form-control-custom" placeholder="Nhập mật khẩu cũ..." required>
            </div>
            
            <div class="form-group">
                <label>Mật khẩu mới</label>
                <input type="password" name="new_password" class="form-control-custom" placeholder="Tối thiểu 6 ký tự..." required>
            </div>
            
            <div class="form-group">
                <label>Nhập lại mật khẩu mới</label>
                <input type="password" name="new_password_confirm" class="form-control-custom" placeholder="Xác nhận lại..." required>
            </div>
            
            <button class="btn-submit" type="submit">Lưu thay đổi</button>
            
            <a href="<?= BASE_URL ?>/?r=user/profile" class="btn-cancel">Hủy bỏ, quay lại hồ sơ</a>
        </form>
    </div>
</div>