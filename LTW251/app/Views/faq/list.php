<?php
function h($s) {
  return htmlspecialchars($s ?? '', ENT_QUOTES, 'UTF-8');
}

function highlight($text, $q) {
  if ($q === '' || $text === null) {
    return h($text);
  }
  $pattern = '/' . preg_quote($q, '/') . '/i';
  return preg_replace($pattern, '<mark class="bg-warning">$0</mark>', h($text));
}
?>

<div class="container py-5">
  <div class="row">
    <div class="col-lg-8 mx-auto">
      <div class="text-center mb-5">
        <i class="fas fa-question-circle fa-3x text-coffee mb-3"></i>
        <h1 class="display-5 fw-bold text-coffee-dark">Câu hỏi thường gặp</h1>
        <p class="text-muted">Tìm hiểu thêm về Lowland Coffee và các dịch vụ tại quán.</p>
      </div>

      <div class="card shadow-sm border-0 mb-4">
        <div class="card-body">
          <form method="get" class="row g-2">
            <input type="hidden" name="r" value="faq/list">
            <div class="col">
              <div class="input-group input-group-lg">
                <span class="input-group-text border-0 bg-light">
                  <i class="fas fa-search text-coffee"></i>
                </span>
                <input type="text"
                       class="form-control border-0 bg-light"
                       name="q"
                       placeholder="Tìm kiếm câu hỏi..."
                       value="<?= h($q) ?>">
              </div>
            </div>
            <div class="col-auto">
              <button type="submit" class="btn btn-coffee btn-lg">
                <i class="fas fa-search me-1"></i>Tìm
              </button>
            </div>
          </form>
        </div>
      </div>

      <?php if (empty($items)): ?>
        <div class="text-center py-5">
          <i class="fas fa-search fa-4x text-muted mb-3"></i>
          <h4 class="text-muted">Không tìm thấy câu hỏi phù hợp</h4>
          <p class="text-muted">Hãy thử với từ khóa khác hoặc xem toàn bộ danh sách FAQ.</p>
        </div>
      <?php else: ?>
        <div class="accordion accordion-flush" id="faqAccordion">
          <?php foreach ($items as $index => $it): ?>
            <div class="accordion-item border-0 shadow-sm mb-3">
              <h2 class="accordion-header" id="heading<?= (int)$index ?>">
                <button class="accordion-button collapsed bg-light text-coffee-dark fw-semibold"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapse<?= (int)$index ?>"
                        aria-expanded="false"
                        aria-controls="collapse<?= (int)$index ?>">
                  <i class="fas fa-question-circle text-coffee me-3"></i>
                  <?= highlight($it['question'], $q) ?>
                </button>
              </h2>
              <div id="collapse<?= (int)$index ?>"
                   class="accordion-collapse collapse"
                   aria-labelledby="heading<?= (int)$index ?>"
                   data-bs-parent="#faqAccordion">
                <div class="accordion-body bg-white">
                  <div class="d-flex">
                    <div class="me-3">
                      <i class="fas fa-comment-dots text-coffee"></i>
                    </div>
                    <div>
                      <?= nl2br(highlight($it['answer'], $q)) ?>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if (!empty($totalPages) && $totalPages > 1): ?>
        <nav aria-label="FAQ pagination" class="mt-4">
          <ul class="pagination justify-content-center">
            <?php for ($i = 1; $i <= $totalPages; $i++): ?>
              <li class="page-item <?= $i == $page ? 'active' : '' ?>">
                <?php if ($i == $page): ?>
                  <span class="page-link bg-coffee border-coffee"><?= $i ?></span>
                <?php else: ?>
                  <a class="page-link text-coffee"
                     href="/?r=faq/list&page=<?= $i ?>&q=<?= urlencode($q) ?>">
                    <?= $i ?>
                  </a>
                <?php endif; ?>
              </li>
            <?php endfor; ?>
          </ul>
        </nav>
      <?php endif; ?>

      <div class="mt-5">
        <div class="card shadow-lg border-0">
          <div class="card-body p-4 p-md-5">
            <div class="text-center mb-4">
              <h2 class="h4 fw-bold text-coffee-dark mb-2">Vẫn chưa tìm thấy câu trả lời?</h2>
              <p class="text-muted mb-0">Gửi câu hỏi cho Lowland Coffee, chúng tôi sẽ phản hồi qua email và có thể bổ sung vào mục FAQ.</p>
            </div>

            <?php if (!empty($message)): ?>
              <div class="alert alert-info d-flex align-items-center mb-4" role="alert">
                <i class="fas fa-info-circle me-2"></i>
                <div><?= h($message) ?></div>
              </div>
            <?php endif; ?>

            <form method="post" class="row g-3" id="faq-question-form">
              <div class="col-md-6">
                <label class="form-label small text-muted fw-semibold">Họ tên *</label>
                <input type="text"
                       name="name"
                       class="form-control"
                       required
                       placeholder="Nhập họ tên của bạn">
              </div>
              <div class="col-md-6">
                <label class="form-label small text-muted fw-semibold">Email *</label>
                <input type="email"
                       name="email"
                       class="form-control"
                       required
                       placeholder="Nhập email để chúng tôi phản hồi">
              </div>
              <div class="col-12">
                <label class="form-label small text-muted fw-semibold">Câu hỏi của bạn *</label>
                <textarea name="question"
                          class="form-control"
                          rows="4"
                          required
                          placeholder="Bạn đang thắc mắc điều gì về Lowland Coffee?"></textarea>
              </div>
              <div class="col-12 text-center mt-2">
                <button type="submit" class="btn btn-coffee px-5">
                  <i class="fas fa-paper-plane me-2"></i>Gửi câu hỏi
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
.text-coffee {
  color: var(--coffee) !important;
}
.text-coffee-dark {
  color: var(--coffee-dark) !important;
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

<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('faq-question-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    var name = form.elements['name'].value.trim();
    var email = form.elements['email'].value.trim();
    var question = form.elements['question'].value.trim();
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!name || !email || !question) {
      e.preventDefault();
      alert('Vui lòng nhập đầy đủ họ tên, email và nội dung câu hỏi.');
      return;
    }
    if (!emailPattern.test(email)) {
      e.preventDefault();
      alert('Email không hợp lệ. Vui lòng kiểm tra lại.');
    }
  });
});
</script>

