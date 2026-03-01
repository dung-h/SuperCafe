<?php
// Group sections by type
$hero = [];
$cards = [];
$values = [];
foreach ($sections as $sec) {
  if ($sec['section_type'] === 'hero') $hero[] = $sec;
  elseif ($sec['section_type'] === 'card') $cards[] = $sec;
  elseif ($sec['section_type'] === 'value') $values[] = $sec;
}
$heroSection = !empty($hero) ? $hero[0] : null;
?>

<div class="container py-5">
  <?php if ($heroSection): ?>
  <section class="row align-items-center mb-5">
    <div class="col-lg-7">
      <h1 class="display-4 fw-bold mb-3"><?= htmlspecialchars($heroSection['title'] ?? 'Giới thiệu', ENT_QUOTES, 'UTF-8') ?></h1>
      <?php if (!empty($page['updated_at'])): ?>
        <p class="text-muted mb-3" style="font-size:0.9em">
          Cập nhật lần cuối: <?= htmlspecialchars(date('d/m/Y H:i', strtotime($page['updated_at'])), ENT_QUOTES, 'UTF-8') ?>
        </p>
      <?php endif; ?>
      <p class="lead text-muted mb-4">
        <?= nl2br(htmlspecialchars($heroSection['content'], ENT_QUOTES, 'UTF-8')) ?>
      </p>
      <div class="d-flex flex-wrap gap-3">
        <a href="/?r=product/list" class="btn btn-primary btn-lg">
          Xem menu đồ uống
        </a>
        <a href="/?r=site/contact" class="btn btn-outline-secondary btn-lg">
          Đặt bàn / Liên hệ
        </a>
      </div>
    </div>
    <div class="col-lg-5 mt-4 mt-lg-0">
      <div class="ratio ratio-4x3 rounded shadow-sm overflow-hidden">
        <img src="<?= htmlspecialchars($heroSection['image_path'] ?: '/assets/images/hero-about.png', ENT_QUOTES, 'UTF-8') ?>"
             alt="<?= htmlspecialchars($heroSection['title'], ENT_QUOTES, 'UTF-8') ?>"
             class="w-100 h-100"
             style="object-fit: cover;">
      </div>
    </div>
  </section>
  <?php endif; ?>

  <?php if (!empty($cards)): ?>
  <section class="mb-5">
    <div class="row g-4">
      <?php foreach ($cards as $card): ?>
      <div class="col-md-4">
        <div class="card h-100 shadow-sm border-0">
          <?php if (!empty($card['image_path'])): ?>
            <div class="position-relative overflow-hidden" style="height: 200px;">
              <img src="<?= htmlspecialchars($card['image_path'], ENT_QUOTES, 'UTF-8') ?>" 
                   alt="<?= htmlspecialchars($card['title'], ENT_QUOTES, 'UTF-8') ?>"
                   class="w-100 h-100"
                   style="object-fit: cover;">
            </div>
          <?php endif; ?>
          <div class="card-body">
            <h2 class="h4 fw-bold mb-3"><?= htmlspecialchars($card['title'], ENT_QUOTES, 'UTF-8') ?></h2>
            <p class="text-muted mb-0">
              <?= nl2br(htmlspecialchars($card['content'], ENT_QUOTES, 'UTF-8')) ?>
            </p>
          </div>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if (!empty($values)): ?>
  <section class="mb-5">
    <h2 class="h3 fw-bold mb-4">Giá trị cốt lõi</h2>
    <div class="row g-4">
      <?php foreach ($values as $value): ?>
      <div class="col-md-4">
        <div class="card h-100 border-0 shadow-sm">
          <?php if (!empty($value['image_path'])): ?>
            <div class="position-relative overflow-hidden" style="height: 200px;">
              <img src="<?= htmlspecialchars($value['image_path'], ENT_QUOTES, 'UTF-8') ?>" 
                   alt="<?= htmlspecialchars($value['title'], ENT_QUOTES, 'UTF-8') ?>"
                   class="w-100 h-100"
                   style="object-fit: cover;">
            </div>
          <?php endif; ?>
          <div class="card-body">
            <h3 class="h5 fw-bold mb-2"><?= htmlspecialchars($value['title'], ENT_QUOTES, 'UTF-8') ?></h3>
            <p class="text-muted mb-0">
              <?= nl2br(htmlspecialchars($value['content'], ENT_QUOTES, 'UTF-8')) ?>
            </p>
          </div>
        </div>
      </div>
      <?php endforeach; ?>
    </div>
  </section>
  <?php endif; ?>

  <?php if (!empty($page['content'])): ?>
    <section class="mb-4">
      <h2 class="h3 fw-bold mb-3">Về Lowland Coffee</h2>
      <div class="card border-0 shadow-sm">
        <div class="card-body">
          <div><?= $page['content'] ?></div>
        </div>
      </div>
    </section>
  <?php endif; ?>
</div>
