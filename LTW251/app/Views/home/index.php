
<!-- Hero Section -->
<section class="hero d-flex align-items-center" style="background: linear-gradient(135deg, rgba(109, 76, 65, 0.85), rgba(161, 136, 127, 0.7)), url('<?= BASE_URL ?>/assets/images/hero-home.png') center/cover no-repeat; min-height: 60vh; color: white;">
    <div class="container">
        <div class="row">
            <div class="col-lg-6">
                <h1 class="display-4 fw-bold mb-3">Lowland Coffee</h1>
                <p class="lead mb-4">Khám phá hương vị cà phê đặc biệt từ vùng đất thấp Việt Nam. Từng tách cà phê là một hành trình cảm nhận hương thơm và vị đậm đà.</p>
                <a href="<?= BASE_URL ?>/?r=product/list" class="btn btn-primary btn-lg px-4 me-2">Khám phá menu</a>
                <a href="<?= BASE_URL ?>/?r=site/contact" class="btn btn-outline-light btn-lg px-4">Liên hệ</a>
            </div>
        </div>
    </div>
</section>

<section class="py-5">
    <div class="container">
        <div class="text-center mb-5">
            <h2 class="display-5 fw-bold text-coffee-dark">Sản phẩm đặc biệt</h2>
            <p class="text-muted">Những món đặc biệt được yêu thích nhất tại Lowland Coffee</p>
        </div>
        <div class="row g-4">
            <?php foreach (array_slice($products, 0, 6) as $p): ?>
                <div class="col-md-4">
                    <div class="card h-100 shadow-sm hover-card">
                        <div class="card-img-top" style="height: 200px; background: url('<?= BASE_URL . htmlspecialchars($p['image'] ?? '/assets/images/noimage.svg', ENT_QUOTES, 'UTF-8') ?>') center/cover no-repeat;">
                        </div>
                        <div class="card-body">
                            <h5 class="card-title text-coffee-dark"><?= htmlspecialchars($p['name']) ?></h5>
                            <p class="card-text text-muted"><?= htmlspecialchars($p['short_desc'] ?? 'Hương vị đặc biệt từ Lowland Coffee') ?></p>
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="h5 text-coffee fw-bold"><?= number_format($p['price']) ?> đ</span>
                                <a href="<?= BASE_URL ?>/?r=product/detail&id=<?= (int)$p['id'] ?>" class="btn btn-coffee">
                                    <i class="fas fa-eye me-1"></i>Xem chi tiết
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>
        <div class="text-center mt-4">
            <a href="<?= BASE_URL ?>/?r=product/list" class="btn btn-outline-coffee btn-lg">
                <i class="fas fa-th-large me-2"></i>Xem tất cả sản phẩm
            </a>
        </div>
    </div>
</section>

<section class="py-5 bg-light">
    <div class="container">
        <div class="text-center mb-5">
            <h2 class="display-5 fw-bold text-coffee-dark">Tin tức &amp; Blog</h2>
            <p class="text-muted">Những câu chuyện thú vị về cà phê và văn hóa Lowland</p>
        </div>
        <div class="row g-4">
            <?php foreach (array_slice($posts, 0, 3) as $post): ?>
                <div class="col-md-4">
                    <article class="card h-100 shadow-sm hover-card">

                            <div class="card-img-top" style="height: 200px; background: url('<?= BASE_URL . htmlspecialchars($post['image'] ?? '/assets/images/post-placeholder.svg', ENT_QUOTES, 'UTF-8') ?>') center/cover no-repeat;">
                        </div>
                        <div class="card-body">
                            <h5 class="card-title">
                                <a href="<?= BASE_URL ?>/?r=post/detail&id=<?= (int)$post['id'] ?>" class="text-decoration-none text-coffee-dark">
                                    <?= htmlspecialchars($post['title']) ?>
                                </a>
                            </h5>
                            <p class="card-text text-muted"><?= htmlspecialchars($post['excerpt'] ?? substr(strip_tags($post['content'] ?? ''), 0, 100) . '...') ?></p>
                            <div class="d-flex justify-content-between align-items-center mt-3">
                                <small class="text-muted">
                                    <i class="fas fa-calendar me-1"></i>
                                    <?= date('d/m/Y', strtotime($post['created_at'])) ?>
                                </small>
                                <a href="<?= BASE_URL ?>/?r=post/detail&id=<?= (int)$post['id'] ?>" class="btn btn-sm btn-outline-coffee">Đọc thêm</a>
                            </div>
                        </div>
                    </article>
                </div>
            <?php endforeach; ?>
        </div>
        <div class="text-center mt-4">
            <a href="<?= BASE_URL ?>/?r=post/list" class="btn btn-outline-coffee btn-lg">
                <i class="fas fa-blog me-2"></i>Xem tất cả bài viết
            </a>
        </div>
    </div>
</section>