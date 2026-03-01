
<div class="container py-5">
    <div class="row mb-4 align-items-center">
        <div class="col-md-6">
            <h1 class="display-6 fw-bold text-coffee-dark">Tin tức &amp; Sự kiện</h1>
            <p class="text-muted">Cập nhật những thông tin mới nhất từ Lowland Coffee</p>
        </div>
        <div class="col-md-6">
            <form method="get" class="d-flex gap-2">
                <input type="hidden" name="r" value="post/list">
                <input class="form-control" name="q" placeholder="Tìm kiếm bài viết..." value="<?= htmlspecialchars($q) ?>">
                <button class="btn btn-coffee" type="submit"><i class="fas fa-search"></i></button>
            </form>
        </div>
    </div>

    <?php if (empty($items)): ?>
        <div class="alert alert-info text-center">
            <i class="fas fa-info-circle me-2"></i> Không tìm thấy bài viết nào.
        </div>
    <?php else: ?>
        <div class="row g-4">
            <?php foreach ($items as $post): ?>
                <div class="col-md-6 col-lg-4">
                    <div class="card h-100 shadow-sm border-0 hover-shadow transition-all">
                        <a href="/?r=post/detail&id=<?= (int)$post['id'] ?>" class="overflow-hidden">
                            <img src="<?= htmlspecialchars($post['image'] ?: '/assets/images/noimage.svg', ENT_QUOTES, 'UTF-8') ?>" 
                                 class="card-img-top" 
                                 alt="<?= htmlspecialchars($post['title']) ?>"
                                 style="height: 200px; object-fit: cover; transition: transform 0.3s ease;">
                        </a>
                        <div class="card-body d-flex flex-column">
                            <div class="mb-2 text-muted small">
                                <i class="far fa-calendar-alt me-1"></i>
                                <?= date('d/m/Y', strtotime($post['created_at'])) ?> · <?= htmlspecialchars($post['author'] ?? 'Lowland Team') ?>
                            </div>
                            <h5 class="card-title fw-bold">
                                <a href="/?r=post/detail&id=<?= (int)$post['id'] ?>" class="text-decoration-none text-dark stretched-link">
                                    <?= htmlspecialchars($post['title']) ?>
                                </a>
                            </h5>
                            <p class="card-text text-muted flex-grow-1">
                                <?= htmlspecialchars($post['excerpt'] ?? '') ?>
                            </p>
                            <div class="mt-3 pt-3 border-top d-flex justify-content-between align-items-center">
                                <span class="text-coffee fw-bold small">Đọc tiếp <i class="fas fa-arrow-right ms-1"></i></span>
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
                            <a class="page-link <?= $i == $page ? 'bg-coffee border-coffee' : 'text-coffee' ?>" 
                               href="/?r=post/list&page=<?= $i ?>&q=<?= urlencode($q) ?>">
                                <?= $i ?>
                            </a>
                        </li>
                    <?php endfor; ?>
                </ul>
            </nav>
        <?php endif; ?>
    <?php endif; ?>
</div>

<style>
    .hover-shadow:hover {
        transform: translateY(-5px);
        box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important;
    }
    .hover-shadow:hover .card-img-top {
        transform: scale(1.05);
    }
    .text-coffee {
        color: var(--coffee) !important;
    }
    .bg-coffee {
        background-color: var(--coffee) !important;
        color: white !important;
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
</style>
