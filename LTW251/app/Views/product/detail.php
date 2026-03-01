<div class="container py-4">
  <h1 class="mb-3"><?= htmlspecialchars($p['name'], ENT_QUOTES, 'UTF-8') ?></h1>
  <div class="row">
    <div class="col-md-5 mb-3">
      <div class="card shadow-sm">
        <img src="<?= htmlspecialchars($p['image'] ?: '/assets/images/noimage.svg', ENT_QUOTES, 'UTF-8') ?>"
             class="card-img-top"
             alt="<?= htmlspecialchars($p['name'], ENT_QUOTES, 'UTF-8') ?>">
      </div>
    </div>
    <div class="col-md-7">
      <div class="card mb-3">
        <div class="card-body">
          <p><strong>Giá:</strong> <?= number_format($p['price']) ?> đ</p>
          <p><?= nl2br(htmlspecialchars($p['description'] ?? '', ENT_QUOTES, 'UTF-8')) ?></p>
        </div>
      </div>

      <form method="post" action="/?r=cart/add" class="mb-3" id="product-add-cart-form">
        <input type="hidden" name="id" value="<?= (int)$p['id'] ?>">
        <div class="mb-2">
          <label>Số lượng:</label>
          <input type="number" name="qty" value="1" min="1" max="999" style="width:80px">
        </div>
        <button type="submit" class="btn btn-success">Thêm vào giỏ hàng</button>
      </form>
      
      <a href="/?r=product/list" class="btn btn-secondary">← Quay lại</a>
    </div>
  </div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('product-add-cart-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    var qty = parseInt(form.elements['qty'].value, 10);
    if (!qty || qty < 1) {
      e.preventDefault();
      alert('Số lượng phải lớn hơn hoặc bằng 1.');
    }
  });
});
</script>
