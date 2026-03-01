<div class="container py-5">
    <div class="row mb-4 align-items-center">
        <div class="col-md-6">
            <h1 class="display-6 fw-bold text-coffee-dark">Sản phẩm của chúng tôi</h1>
            <p class="text-muted">Khám phá hương vị cà phê tuyệt hảo</p>
        </div>
        <div class="col-md-6">
            <form method="get" class="d-flex gap-2">
                <input type="hidden" name="r" value="product/list">
                <input class="form-control" name="q" placeholder="Tìm kiếm sản phẩm..." value="<?= htmlspecialchars($q) ?>">
                <button class="btn btn-coffee" type="submit"><i class="fas fa-search"></i></button>
            </form>
        </div>
    </div>

    <?php if (empty($items)): ?>
        <div class="alert alert-info text-center">
            <i class="fas fa-info-circle me-2"></i> Không tìm thấy sản phẩm nào phù hợp.
        </div>
    <?php else: ?>
        <div class="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-4">
            <?php foreach ($items as $p): ?>
                <div class="col">
                    <div class="card h-100 shadow-sm border-0 product-card">
                        <div class="position-relative overflow-hidden">
                            <img src="<?= htmlspecialchars($p['image'] ?: '/assets/images/noimage.svg', ENT_QUOTES, 'UTF-8') ?>" 
                                 class="card-img-top" 
                                 alt="<?= htmlspecialchars($p['name']) ?>"
                                 style="height: 250px; object-fit: cover; transition: transform 0.3s ease;">
                            <div class="product-overlay position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-dark bg-opacity-50 opacity-0 transition-all">
                                <a href="/?r=product/detail&id=<?= (int)$p['id'] ?>" class="btn btn-light rounded-circle mx-1" title="Xem chi tiết">
                                    <i class="fas fa-eye"></i>
                                </a>
                                <form method="post" action="/?r=cart/add">
                                    <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
                                    <input type="hidden" name="qty" value="1">
                                    <button class="btn btn-coffee rounded-circle mx-1" title="Thêm vào giỏ" type="submit">
                                    <i class="fas fa-shopping-cart"></i>
                                </button>
                                </form>
                            </div>
                        </div>
                        <div class="card-body text-center">
                            <h5 class="card-title">
                                <a href="/?r=product/detail&id=<?= (int)$p['id'] ?>" class="text-decoration-none text-dark fw-bold">
                                    <?= htmlspecialchars($p['name']) ?>
                                </a>
                            </h5>
                            <p class="card-text text-muted small text-truncate"><?= htmlspecialchars($p['short_desc'] ?? '') ?></p>
                            <div class="d-flex justify-content-center align-items-center gap-2">
                                <span class="text-coffee fw-bold fs-5"><?= number_format($p['price']) ?> đ</span>
                                <?php if (!empty($p['old_price'])): ?>
                                    <span class="text-muted text-decoration-line-through small"><?= number_format($p['old_price']) ?> đ</span>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>
            <?php endforeach; ?>
        </div>

        <!-- Pagination -->
        <?php if ($totalPages > 1): ?>
            <nav class="mt-5" aria-label="Page navigation">
                <ul class="pagination justify-content-center">
                    <?php for ($i = 1; $i <= $totalPages; $i++): ?>
                        <li class="page-item <?= $i == $page ? 'active' : '' ?>">
                            <?php if ($i == $page): ?>
                                <span class="page-link bg-coffee border-coffee"><?= $i ?></span>
                            <?php else: ?>
                                <a class="page-link text-coffee" href="/?r=product/list&page=<?= $i ?>&q=<?= urlencode($q) ?>">
                                    <?= $i ?>
                                </a>
                            <?php endif; ?>
                        </li>
                    <?php endfor; ?>
                </ul>
            </nav>
        <?php endif; ?>
    <?php endif; ?>
</div>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<style>
    .product-card:hover {
        transform: translateY(-5px);
        transition: transform 0.3s ease;
    }
    .product-card:hover .product-overlay {
        opacity: 1 !important;
    }
    .product-card:hover .card-img-top {
        transform: scale(1.05);
    }
    .bg-coffee {
        background-color: var(--coffee) !important;
        color: white !important;
    }
    .text-coffee {
        color: var(--coffee) !important;
    }
    .border-coffee {
        border-color: var(--coffee) !important;
    }
    .btn-coffee {
        background-color: var(--coffee);
        color: white;
        border: none;
    }
    .btn-coffee:hover {
        background-color: var(--coffee-dark);
        color: white;
    }
    .product-overlay {
        z-index: 10;
    }
</style>
