<?php $c = $contact; ?>

<div class="d-flex justify-content-between align-items-center mb-3">
    <h2>Phản hồi liên hệ #<?= $c['id'] ?></h2>
    <a href="<?= BASE_URL ?>/?r=admin/contacts" class="btn btn-secondary">
        <i class="bi bi-arrow-left"></i> Quay lại danh sách
    </a>
</div>

<?php if (!empty($success)): ?>
    <div class="alert alert-success"><?= $success ?></div>
<?php endif; ?>

<?php if (!empty($error)): ?>
    <div class="alert alert-danger"><?= $error ?></div>
<?php endif; ?>

<div class="card mb-4">
    <div class="card-body">
        <div class="row">
            <div class="col-md-6">
                <p><strong>Họ tên:</strong> <?= htmlspecialchars($c['name']) ?></p>
                <p><strong>Email:</strong> <?= htmlspecialchars($c['email']) ?>
                    <?php if (isset($emailExists)): ?>
                        <?php if ($emailExists): ?>
                            <span class="badge bg-success ms-2"><i class="bi bi-check-circle"></i> Email Hợp lệ</span>
                        <?php else: ?>
                            <span class="badge bg-danger ms-2"><i class="bi bi-x-circle"></i> Email Không tồn tại</span>
                        <?php endif; ?>
                    <?php endif; ?>
                </p>
                <?php if (!$c['is_resolved']): ?>
                <form method="post" class="d-inline-block mb-3">
                    <button type="submit" name="check_email" value="1" class="btn btn-outline-info btn-sm">
                        <i class="bi bi-search"></i> Kiểm tra tồn tại Email
                    </button>
                </form>
                <?php endif; ?>
                
                <p><strong>Thời gian gửi:</strong>
                    <?= (new DateTime($c['created_at']))->format('d/m/Y H:i') ?>
                </p>
            </div>
            <div class="col-md-6 text-md-end">
                <p><strong>Trạng thái:</strong><br>
                    <?php if ($c['is_resolved']): ?>
                        <span class="badge bg-success fs-6">Đã xử lý</span>
                    <?php else: ?>
                        <span class="badge bg-warning text-dark fs-6">Chưa xử lý</span>
                    <?php endif; ?>
                </p>
            </div>
        </div>
    </div>
</div>

<h5>Nội dung khách gửi:</h5>
<div class="bg-light p-4 rounded mb-4 border">
    <?= nl2br(htmlspecialchars($c['message'])) ?>
</div>

<?php if (!$c['is_resolved']): ?>
    <div class="card border-primary">
        <div class="card-header bg-primary text-white">Soạn phản hồi</div>
        <div class="card-body">
            <form method="post">
                <div class="mb-3">
                    <label class="form-label"><strong>Nội dung email gửi khách:</strong></label>
                    <textarea name="reply_message" class="form-control" rows="6" required
                              placeholder="Nhập nội dung trả lời..."></textarea>
                </div>
                <div class="mb-3">
                    <label class="form-label">Ghi chú nội bộ (không gửi khách):</label>
                    <textarea name="admin_note" class="form-control" rows="3"
                              placeholder="Ghi chú cho nhân viên khác..."><?= htmlspecialchars($c['admin_note'] ?? '') ?></textarea>
                </div>
                <button type="submit" name="send_reply" value="1" class="btn btn-primary btn-lg">
                    <i class="bi bi-send"></i> Gửi phản hồi & Hoàn tất
                </button>
            </form>
        </div>
    </div>

<?php else: ?>
    <div class="card border-success">
        <div class="card-header bg-success text-white">Chi tiết xử lý</div>
        <div class="card-body">
            <p><strong>Thời gian xử lý:</strong> 
                <?php 
                    $repliedAt = $c['replied_at'] ?? $c['created_at'];
                    if($repliedAt != '0000-00-00 00:00:00') {
                        echo (new DateTime($repliedAt))->format('d/m/Y H:i');
                    }
                ?>
            </p>
            
            <hr>
            <h6>Nội dung đã gửi:</h6>
            <div class="p-3 bg-light border rounded">
                <?= nl2br(htmlspecialchars($c['reply_content'])) ?>
            </div>

            <?php if (!empty($c['admin_note'])): ?>
                <hr>
                <h6>Ghi chú nội bộ:</h6>
                <p class="mb-0 text-muted fst-italic">
                    <?= nl2br(htmlspecialchars($c['admin_note'])) ?>
                </p>
            <?php endif; ?>
        </div>
    </div>
<?php endif; ?>