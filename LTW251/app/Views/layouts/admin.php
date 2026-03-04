<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= htmlspecialchars($title ?? 'Admin - Lowland Coffee', ENT_QUOTES, 'UTF-8') ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/css/tabler.min.css" rel="stylesheet">
  
  <style>
    :root {
      --coffee-primary: #5D4037;
      --coffee-dark: #3E2723;
      --coffee-light: #D7CCC8;
      --coffee-bg: #f4f6fa;
    }
    body {
      background-color: var(--coffee-bg);
      font-family: 'Quicksand', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    /* ... Custom CSS giữ nguyên ... */
    .navbar-top { background: linear-gradient(to right, var(--coffee-dark), var(--coffee-primary)); color: #fff; border-bottom: 1px solid rgba(255,255,255,0.1); }
    .navbar-top .navbar-brand { color: #fff !important; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    .navbar-menu .nav-link:hover { color: var(--coffee-primary); background-color: rgba(93, 64, 55, 0.05); }
    .navbar-menu .nav-item.active .nav-link, .navbar-menu .nav-link.active { color: var(--coffee-primary) !important; font-weight: bold; position: relative; }
    .navbar-menu .nav-link.active::after { content: ''; position: absolute; bottom: 0; left: 0; width: 100%; height: 2px; background-color: var(--coffee-primary); }
    .btn-primary { background-color: var(--coffee-primary) !important; border-color: var(--coffee-primary) !important; }
    .btn-primary:hover { background-color: var(--coffee-dark) !important; }
    .order-status-badge {
      display: inline-block;
      padding: 0.35rem 0.6rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      line-height: 1;
    }
    .order-status-pending { background: #1d4ed8; color: #fff; }
    .order-status-processing { background: #f59e0b; color: #111827; }
    .order-status-completed { background: #15803d; color: #fff; }
    .order-status-cancelled { background: #dc2626; color: #fff; }
    /* ... Dropdown animation ... */
    .dropdown-menu { animation: slideDown 0.2s ease-out; border-radius: 0.5rem !important; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
    .dropdown-item { padding: 0.5rem 1rem; transition: all 0.2s; }
    .dropdown-item:hover { background-color: #f8f9fa; padding-left: 1.25rem; }
  </style>
</head>
<body class="layout-fluid">
  <div class="page">
    
    <header class="navbar navbar-expand-md navbar-dark navbar-top d-print-none">
      <div class="container-xl">
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbar-menu">
          <span class="navbar-toggler-icon"></span>
        </button>
        
        <h1 class="navbar-brand navbar-brand-autodark d-none-navbar-horizontal pe-0 pe-md-3">
          <a href="<?= BASE_URL ?>/?r=admin/index" class="text-decoration-none text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-coffee" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 14c.83 .642 2.077 1.017 3.5 1c1.423 .017 2.67 -.358 3.5 -1c.83 -.642 2.077 -1.017 3.5 -1c1.423 -.017 2.67 .358 3.5 1" /><path d="M8 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" /><path d="M12 3a2.4 2.4 0 0 0 -1 2a2.4 2.4 0 0 0 1 2" /><path d="M3 10h14v5a6 6 0 0 1 -6 6h-2a6 6 0 0 1 -6 -6v-5z" /><path d="M16.746 16.726a3 3 0 1 0 .252 -5.555" /></svg>
            LOWLAND ADMIN
          </a>
        </h1>

        <div class="navbar-nav flex-row order-md-last">
          <div class="nav-item dropdown">
            <?php 
              $user = null;
              if (!empty($_SESSION['user_id'])) {
                $pdo = DB::pdo();
                $stmt = $pdo->prepare('SELECT * FROM users WHERE id=?');
                $stmt->execute([$_SESSION['user_id']]);
                $user = $stmt->fetch();
              }
              $avatarPath = $user['avatar_path'] ?? '';
            ?>
            <a href="#" class="nav-link d-flex lh-1 text-reset p-0" data-bs-toggle="dropdown" aria-expanded="false">
              <?php if (!empty($avatarPath)): ?>
                <img src="<?= BASE_URL . htmlspecialchars($avatarPath, ENT_QUOTES, 'UTF-8') ?>" 
                     alt="Avatar" 
                     class="avatar avatar-sm rounded-circle" 
                     style="width: 32px; height: 32px; object-fit: cover;">
              <?php else: ?>
                <span class="avatar avatar-sm" style="background-image: url('https://ui-avatars.com/api/?name=Admin&background=667eea')"></span>
              <?php endif; ?>
              <div class="d-none d-xl-block ps-2">
                <div class="text-white fw-bold">Quản trị viên</div>
                <div class="mt-1 small text-white opacity-75">Admin</div>
              </div>
            </a>
            <div class="dropdown-menu dropdown-menu-end dropdown-menu-arrow shadow-lg border-0" style="min-width: 220px;">
              <div class="dropdown-header" style="background-color: #fff; color: #333; padding: 1rem; margin: 0; border-bottom: 1px solid #dee2e6;">
                <div class="d-flex align-items-center gap-3">
                  <?php if (!empty($avatarPath)): ?>
                    <img src="<?= BASE_URL . htmlspecialchars($avatarPath, ENT_QUOTES, 'UTF-8') ?>" 
                         alt="Avatar" 
                         class="avatar avatar-md rounded-circle" 
                         style="width: 48px; height: 48px; object-fit: cover;">
                  <?php else: ?>
                    <span class="avatar avatar-md" style="background-image: url('https://ui-avatars.com/api/?name=Admin&background=5D4037&color=fff')"></span>
                  <?php endif; ?>
                  <div>
                    <div class="fw-bold">Quản trị viên</div>
                    <small class="text-muted">Administrator</small>
                  </div>
                </div>
              </div>
              <a href="<?= BASE_URL ?>/" class="dropdown-item d-flex align-items-center">
                <i class="bi bi-house-door me-2"></i> Về trang chủ
              </a>
              <div class="dropdown-divider"></div>
              <a href="<?= BASE_URL ?>/?r=auth/logout" class="dropdown-item d-flex align-items-center text-danger">
                <i class="bi bi-box-arrow-right me-2"></i> Đăng xuất
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>

    <div class="navbar-expand-md navbar-menu">
      <div class="collapse navbar-collapse" id="navbar-menu">
        <div class="navbar navbar-light">
          <div class="container-xl">
            <ul class="navbar-nav">
              <?php 
                $r = $_GET['r'] ?? 'admin/index'; 
                function isActive($route, $currentR) {
                  if ($route == 'admin/index') {
                      return $currentR == $route ? 'active' : '';
                  }
                  return strpos($currentR, $route) === 0 ? 'active' : '';
                }
              ?>

              <li class="nav-item <?= isActive('admin/index', $r) ?>">
                <a class="nav-link" href="<?= BASE_URL ?>/?r=admin/index">
                  <span class="nav-link-icon d-md-none d-lg-inline-block">
                    <svg xmlns="http://www.w3.org/2000/svg" class="icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="12" cy="13" r="2" /><line x1="13.45" y1="11.55" x2="15.5" y2="9.5" /><path d="M6.4 20a9 9 0 1 1 11.2 0z" /></svg>
                  </span>
                  <span class="nav-link-title">Dashboard</span>
                </a>
              </li>

              <li class="nav-item <?= isActive('adminChat', $r) ?>">
                <a class="nav-link text-blue" href="<?= BASE_URL ?>/?r=adminChat/index">
                  <span class="nav-link-title fw-bold">Hỗ trợ trực tuyến</span>
                </a>
              </li>

              <li class="nav-item <?= isActive('adminUser', $r) ?>">
                <a class="nav-link" href="<?= BASE_URL ?>/?r=adminUser/list">
                  <span class="nav-link-title">Người dùng</span>
                </a>
              </li>

              <li class="nav-item <?= isActive('adminProduct', $r) ?>">
                <a class="nav-link" href="<?= BASE_URL ?>/?r=adminProduct/list">
                  <span class="nav-link-title">Sản phẩm</span>
                </a>
              </li>

              <li class="nav-item <?= isActive('adminOrder', $r) ?>">
                <a class="nav-link" href="<?= BASE_URL ?>/?r=adminOrder/list">
                  <span class="nav-link-title">Đơn hàng</span>
                </a>
              </li>
              
              <li class="nav-item <?= isActive('adminPost', $r) ?>">
                <a class="nav-link" href="<?= BASE_URL ?>/?r=adminPost/list">
                    <span class="nav-link-title">Bài viết</span>
                </a>
              </li>

              <li class="nav-item dropdown <?= isActive('adminFaq', $r) || isActive('adminFaqQuestion', $r) ? 'active' : '' ?>">
                <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown" aria-expanded="false">
                    <span class="nav-link-title">FAQ</span>
                </a>
                <div class="dropdown-menu" style="min-width: 200px;">
                  <a class="dropdown-item <?= isActive('adminFaq', $r) ? 'active' : '' ?>" href="<?= BASE_URL ?>/?r=adminFaq/list">
                    Quản lý câu hỏi chung
                  </a>
                  <a class="dropdown-item <?= isActive('adminFaqQuestion', $r) ? 'active' : '' ?>" href="<?= BASE_URL ?>/?r=adminFaqQuestion/list">
                    Câu hỏi từ người dùng
                  </a>
                </div>
              </li>
              
              <li class="nav-item <?= isActive('admin/contact', $r) ?>">
                <a class="nav-link" href="<?= BASE_URL ?>/?r=admin/contacts">
                    <span class="nav-link-title">Liên hệ</span>
                </a>
              </li>

            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="page-wrapper">
      <div class="container-xl py-4">
        <?= $content ?? "" ?>
      </div>
      
      <footer class="footer footer-transparent d-print-none">
        <div class="container-xl">
          <div class="row text-center align-items-center flex-row-reverse">
            <div class="col-12 col-lg-auto mt-3 mt-lg-0">
              <ul class="list-inline list-inline-dots mb-0">
                <li class="list-inline-item">
                  © <?= date('Y') ?> <strong>Lowland Coffee</strong>.
                </li>
                <li class="list-inline-item">
                  <a href="<?= BASE_URL ?>/" class="link-secondary">Xem trang chủ</a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/@tabler/core@1.0.0-beta20/dist/js/tabler.min.js"></script>
</body>
</html>
