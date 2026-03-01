<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= htmlspecialchars($title ?? 'Lowland Coffee - Quán cafe Sài Gòn', ENT_QUOTES, 'UTF-8') ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
  <link rel="stylesheet" href="<?= BASE_URL ?>/assets/main.css">
  <style>
    .dropdown-menu {
      animation: slideIn 0.2s ease-out;
      border-radius: 0.5rem;
      z-index: 9999 !important;
    }
    .navbar .dropdown {
      position: relative;
      z-index: 1000;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .dropdown-item {
      padding: 0.5rem 1rem;
      transition: all 0.2s;
    }
    .dropdown-item:hover {
      background-color: #f8f9fa;
      padding-left: 1.25rem;
    }
    .dropdown-header {
      padding: 0.75rem 1rem;
      background-color: #f8f9fa;
      color: #333;
      margin: -0.5rem -0.5rem 0.5rem -0.5rem;
      border-radius: 0.5rem 0.5rem 0 0;
      border-bottom: 1px solid #dee2e6;
    }
  </style>
</head>
<body class="d-flex flex-column min-vh-100">
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark sticky-top">
    <div class="container">
      <a class="navbar-brand fw-bold" href="<?= BASE_URL ?>/"><i class="bi bi-cup-hot-fill"></i> Lowland Coffee</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav ms-auto">
          <li class="nav-item"><a class="nav-link" href="<?= BASE_URL ?>/">Trang chủ</a></li>
          <li class="nav-item"><a class="nav-link" href="<?= BASE_URL ?>/?r=product/list">Thực đơn</a></li>
          <li class="nav-item"><a class="nav-link" href="<?= BASE_URL ?>/?r=post/list">Tin tức</a></li>
          <li class="nav-item"><a class="nav-link" href="<?= BASE_URL ?>/?r=page/about">Giới thiệu</a></li>
          <li class="nav-item"><a class="nav-link" href="<?= BASE_URL ?>/?r=faq/list">FAQ</a></li>
          <li class="nav-item"><a class="nav-link" href="<?= BASE_URL ?>/?r=site/contact">Liên hệ</a></li>
          
          <li class="nav-item">
            <a class="nav-link" href="<?= BASE_URL ?>/?r=cart/index">
              <i class="bi bi-cart3"></i> Giỏ hàng
              <?php $cartCount = count($_SESSION['cart'] ?? []); if ($cartCount > 0): ?>
                <span class="badge bg-danger"><?= $cartCount ?></span>
              <?php endif; ?>
            </a>
          </li>

          <?php if (!empty($currentUser)): ?>
            <?php if (($currentUser['role'] ?? 'guest') === 'admin'): ?>
              <li class="nav-item"><a class="nav-link text-warning" href="<?= BASE_URL ?>/?r=admin/index"><i class="bi bi-gear-fill"></i> Admin</a></li>
            <?php endif; ?>
            
            <li class="nav-item dropdown">
  <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" data-bs-toggle="dropdown" aria-expanded="false">
    <?php if (!empty($currentUser['avatar_path'])): ?>
      <img src="<?= BASE_URL . htmlspecialchars($currentUser['avatar_path'], ENT_QUOTES, 'UTF-8') ?>" 
           alt="Avatar" 
           class="rounded-circle me-2" 
           style="width: 32px; height: 32px; object-fit: cover;">
    <?php else: ?>
      <i class="bi bi-person-circle me-2" style="font-size: 1.2rem;"></i>
    <?php endif; ?>
    <span><?= htmlspecialchars($currentUser['full_name'] ?: $currentUser['email'], ENT_QUOTES, 'UTF-8') ?></span>
  </a>
  
  <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 animate slideIn" style="min-width: 200px;">
    <li class="dropdown-header" style="padding: 1rem; background-color: #fff; border-bottom: 1px solid #dee2e6; margin: 0;">
      <div class="d-flex align-items-center gap-3">
        <?php if (!empty($currentUser['avatar_path'])): ?>
          <img src="<?= BASE_URL . htmlspecialchars($currentUser['avatar_path'], ENT_QUOTES, 'UTF-8') ?>" 
               alt="Avatar" 
               class="rounded-circle" 
               style="width: 48px; height: 48px; object-fit: cover;">
        <?php else: ?>
          <i class="bi bi-person-circle" style="font-size: 2rem;"></i>
        <?php endif; ?>
                    <div>
                      <div class="fw-bold"><?= htmlspecialchars($currentUser['full_name'] ?: 'User', ENT_QUOTES, 'UTF-8') ?></div>
                      <small class="text-muted"><?= htmlspecialchars($currentUser['email'], ENT_QUOTES, 'UTF-8') ?></small>
                    </div>
                  </div>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <a class="dropdown-item d-flex align-items-center" href="<?= BASE_URL ?>/?r=user/profile">
                    <i class="bi bi-person me-2"></i> Tài khoản
                  </a>
                </li>
                <li><hr class="dropdown-divider"></li>
                <li>
                  <a class="dropdown-item d-flex align-items-center text-danger" href="<?= BASE_URL ?>/?r=auth/logout">
                    <i class="bi bi-box-arrow-right me-2"></i> Đăng xuất
                  </a>
                </li>
              </ul>
            </li>
          <?php else: ?>
            <li class="nav-item"><a class="nav-link" href="<?= BASE_URL ?>/?r=auth/register">Đăng ký</a></li>
            <li class="nav-item"><a class="nav-link btn btn-outline-light btn-sm ms-2" href="<?= BASE_URL ?>/?r=auth/login">Đăng nhập</a></li>
          <?php endif; ?>
        </ul>
      </div>
    </div>
  </nav>
  
  <main class="flex-grow-1">
    <?= $content ?? "" ?>
  </main>
  
  <footer class="bg-dark text-white mt-5 py-4">
    <div class="container">
      <div class="row">
        <div class="col-md-4 mb-3">
          <h5><i class="bi bi-cup-hot-fill"></i> Lowland Coffee</h5>
          <p class="text-white-50">Quán cafe ấm cúng giữa lòng Sài Gòn</p>
        </div>
        <div class="col-md-4 mb-3">
          <h6>Liên hệ</h6>
          <p class="text-white-50 small mb-1">
            <i class="bi bi-geo-alt"></i>
            <?= htmlspecialchars($contactSettings['address'] ?? '', ENT_QUOTES, 'UTF-8') ?>
          </p>
          <p class="text-white-50 small mb-1">
            <i class="bi bi-telephone"></i>
            <?= htmlspecialchars($contactSettings['phone'] ?? '', ENT_QUOTES, 'UTF-8') ?>
          </p>
          <p class="text-white-50 small">
            <i class="bi bi-envelope"></i>
            <?= htmlspecialchars($contactSettings['email'] ?? '', ENT_QUOTES, 'UTF-8') ?>
          </p>
        </div>
        <div class="col-md-4 mb-3">
          <h6>Giờ mở cửa</h6>
          <p class="text-white-50 small">
            <?= htmlspecialchars($contactSettings['opening_hours'] ?? '', ENT_QUOTES, 'UTF-8') ?>
          </p>
        </div>
      </div>
      <hr class="border-secondary">
      <div class="text-center text-white-50 small">
        © <?= date('Y') ?> Lowland Coffee. All rights reserved.
      </div>
    </div>
  </footer>

  <div id="chatbot-widget" class="chatbot-widget">
    <button id="chatbot-toggle" class="chatbot-toggle" type="button" aria-label="Mo tro ly">
      <i class="bi bi-chat-dots-fill"></i>
    </button>
    <div id="chatbot-panel" class="chatbot-panel d-none">
      <div class="chatbot-header">
        <strong>Tro ly dat nuoc</strong>
        <button id="chatbot-close" type="button" class="btn-close btn-close-white" aria-label="Dong"></button>
      </div>
      <div id="chatbot-messages" class="chatbot-messages"></div>
      <form id="chatbot-form" class="chatbot-form">
        <input id="chatbot-input" type="text" class="form-control" placeholder="Nhap cau hoi..." maxlength="500" required>
        <button class="btn btn-warning text-dark fw-bold" type="submit">Gui</button>
      </form>
    </div>
  </div>

  <style>
    .chatbot-widget {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 1100;
    }
    .chatbot-toggle {
      width: 56px;
      height: 56px;
      border: 0;
      border-radius: 50%;
      color: #fff;
      background: #5d4037;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.25);
    }
    .chatbot-panel {
      width: min(92vw, 360px);
      height: 480px;
      margin-top: 12px;
      background: #fff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
      display: flex;
      flex-direction: column;
    }
    .chatbot-header {
      padding: 12px 14px;
      color: #fff;
      background: #3e2723;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .chatbot-messages {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
      background: #f7f1ec;
    }
    .chatbot-row {
      margin-bottom: 8px;
      display: flex;
    }
    .chatbot-row.user {
      justify-content: flex-end;
    }
    .chatbot-bubble {
      max-width: 85%;
      padding: 8px 10px;
      border-radius: 10px;
      white-space: pre-wrap;
      font-size: 14px;
      line-height: 1.4;
    }
    .chatbot-row.user .chatbot-bubble {
      background: #5d4037;
      color: #fff;
    }
    .chatbot-row.bot .chatbot-bubble {
      background: #fff;
      border: 1px solid #ddd;
      color: #222;
    }
    .chatbot-form {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 8px;
      padding: 10px;
      border-top: 1px solid #eee;
      background: #fff;
    }
  </style>
  
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    (function () {
      var storageKey = 'lowland_chatbot_history_v1';
      var toggleBtn = document.getElementById('chatbot-toggle');
      var closeBtn = document.getElementById('chatbot-close');
      var panel = document.getElementById('chatbot-panel');
      var form = document.getElementById('chatbot-form');
      var input = document.getElementById('chatbot-input');
      var messages = document.getElementById('chatbot-messages');
      if (!toggleBtn || !panel || !form || !input || !messages) return;

      function loadHistory() {
        try {
          var raw = localStorage.getItem(storageKey);
          if (!raw) return [];
          var parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      }

      function saveHistory(history) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(history.slice(-40)));
        } catch (e) {}
      }

      function addMessage(role, text) {
        var row = document.createElement('div');
        row.className = 'chatbot-row ' + role;
        var bubble = document.createElement('div');
        bubble.className = 'chatbot-bubble';
        bubble.textContent = text;
        row.appendChild(bubble);
        messages.appendChild(row);
        messages.scrollTop = messages.scrollHeight;
      }

      function renderHistory() {
        messages.innerHTML = '';
        var history = loadHistory();
        if (history.length === 0) {
          addMessage('bot', 'Xin chao, minh la tro ly dat nuoc. Ban can tim mon nao?');
          saveHistory([{ role: 'bot', text: 'Xin chao, minh la tro ly dat nuoc. Ban can tim mon nao?' }]);
          return;
        }
        history.forEach(function (m) {
          addMessage(m.role === 'user' ? 'user' : 'bot', m.text || '');
        });
      }

      async function sendMessage(text) {
        var resp = await fetch('<?= BASE_URL ?>/?r=site/chatbot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text })
        });
        var data = await resp.json();
        if (!resp.ok || !data.ok || !data.data || !data.data.reply) {
          throw new Error((data && data.error) || 'Loi he thong');
        }
        return data.data.reply;
      }

      toggleBtn.addEventListener('click', function () {
        panel.classList.toggle('d-none');
        if (!panel.classList.contains('d-none')) {
          input.focus();
        }
      });

      if (closeBtn) {
        closeBtn.addEventListener('click', function () {
          panel.classList.add('d-none');
        });
      }

      form.addEventListener('submit', async function (event) {
        event.preventDefault();
        var text = input.value.trim();
        if (!text) return;
        input.value = '';

        var history = loadHistory();
        history.push({ role: 'user', text: text });
        saveHistory(history);
        addMessage('user', text);

        addMessage('bot', 'Dang xu ly...');
        var loadingNode = messages.lastChild;

        try {
          var reply = await sendMessage(text);
          if (loadingNode && loadingNode.parentNode) {
            loadingNode.parentNode.removeChild(loadingNode);
          }
          addMessage('bot', reply);
          history = loadHistory();
          history.push({ role: 'bot', text: reply });
          saveHistory(history);
        } catch (err) {
          if (loadingNode && loadingNode.parentNode) {
            loadingNode.parentNode.removeChild(loadingNode);
          }
          var fallback = 'He thong tam loi, vui long thu lai sau.';
          addMessage('bot', fallback);
          history = loadHistory();
          history.push({ role: 'bot', text: fallback });
          saveHistory(history);
        }
      });

      renderHistory();
    })();
  </script>
</body>
</html>
