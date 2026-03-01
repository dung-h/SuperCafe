<div class="page-header mb-4">
  <div class="row align-items-center">
    <div class="col">
      <h2 class="page-title">Bảng điều khiển Admin</h2>
      <div class="text-muted mt-1">Tổng quan nhanh về Lowland Coffee</div>
    </div>
  </div>
</div>

<div class="row row-deck">
  <div class="col-sm-3 mb-3">
    <div class="card">
      <div class="card-body">
        <div class="subheader">Sản phẩm</div>
        <div class="h1 mb-3"><?= (int)$counts['products'] ?></div>
        <a href="/?r=adminProduct/list" class="btn btn-sm btn-primary">Quản lý sản phẩm</a>
      </div>
    </div>
  </div>
  <div class="col-sm-3 mb-3">
    <div class="card">
      <div class="card-body">
        <div class="subheader">Bài viết</div>
        <div class="h1 mb-3"><?= (int)$counts['posts'] ?></div>
        <a href="/?r=adminPost/list" class="btn btn-sm btn-primary">Quản lý bài viết</a>
      </div>
    </div>
  </div>
  <div class="col-sm-3 mb-3">
    <div class="card">
      <div class="card-body">
        <div class="subheader">Liên hệ</div>
        <div class="h1 mb-3"><?= (int)$counts['contacts'] ?></div>
        <a href="/?r=admin/contacts" class="btn btn-sm btn-primary">Quản lý liên hệ</a>
      </div>
    </div>
  </div>
  <div class="col-sm-3 mb-3">
    <div class="card">
      <div class="card-body">
        <div class="subheader">Câu hỏi FAQ</div>
        <div class="h1 mb-3 text-warning"><?= (int)$counts['faq_questions'] ?></div>
        <a href="/?r=adminFaqQuestion/list" class="btn btn-sm btn-primary">Xem câu hỏi</a>
      </div>
    </div>
  </div>
</div>

<div class="row mt-4">
  <div class="col-md-6 mb-3">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Nội dung trang</h3>
      </div>
      <div class="list-group list-group-flush">
        <a href="/?r=adminPage/editAbout" class="list-group-item list-group-item-action">
          Trang giới thiệu
        </a>
        <a href="/?r=adminFaq/list" class="list-group-item list-group-item-action">
          Câu hỏi thường gặp (FAQ)
        </a>
      </div>
    </div>
  </div>
  <div class="col-md-6 mb-3">
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Quản lý khác</h3>
      </div>
      <div class="list-group list-group-flush">
        <a href="/?r=adminOrder/list" class="list-group-item list-group-item-action">
          Đơn hàng
        </a>
        <a href="/?r=adminUser/list" class="list-group-item list-group-item-action">
          Người dùng
        </a>
        <a href="/?r=adminComment/list" class="list-group-item list-group-item-action">
          Bình luận bài viết
        </a>
      </div>
    </div>
  </div>
</div>

