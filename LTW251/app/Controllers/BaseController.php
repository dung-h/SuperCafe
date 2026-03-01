<?php
require_once __DIR__ . '/../Models/DB.php';

abstract class BaseController {
  private $cachedUser = null;

  protected function render($view, $params = [], $title = 'Site') {
    $currentUser = $this->currentUser();
    $pdo = DB::pdo();
    $stmt = $pdo->query('SELECT * FROM contact_settings ORDER BY id LIMIT 1');
    $contactSettings = $stmt->fetch();
    if (!$contactSettings) {
      $contactSettings = [
        'address' => '123 Nguyễn Huệ, Q.1, TP.HCM',
        'phone' => '028 3822 1234',
        'email' => 'info@lowlandcoffee.com',
        'opening_hours' => 'Thứ 2 - Chủ nhật: 7:00 - 22:00'
      ];
    }
    $layoutTitle = $title;
    extract($params);
    $title = $layoutTitle;
    ob_start();
    require __DIR__ . '/../Views/' . $view . '.php';
    $content = ob_get_clean();
    require __DIR__ . '/../Views/layouts/base.php';
  }

  protected function renderAdmin($view, $params = [], $title = 'Admin') {
    $layoutTitle = $title;
    extract($params);
    $title = $layoutTitle;
    ob_start();
    require __DIR__ . '/../Views/' . $view . '.php';
    $content = ob_get_clean();
    require __DIR__ . '/../Views/layouts/admin.php';
  }

  protected function redirect($path) {
        // 1. Đảm bảo BASE_URL có giá trị (Fallback nếu config lỗi)
        $baseUrl = defined('BASE_URL') ? BASE_URL : '/LTW251/public';
        
        // 2. Xóa dấu / ở cuối BASE_URL (nếu lỡ tay thêm)
        $baseUrl = rtrim($baseUrl, '/');

        // 3. Xóa dấu / ở đầu đường dẫn đích (QUAN TRỌNG)
        // Ví dụ: inputs '/?r=admin' sẽ thành '?r=admin'
        $path = ltrim($path, '/');

        // 4. Xóa buffer cũ để tránh lỗi header
        if (ob_get_length()) ob_clean();

        // 5. Chuyển hướng
        // Kết quả: http://localhost/LTW251/public/?r=admin
        header("Location: " . $baseUrl . '/' . $path);
        exit;
    }

  protected function currentUser() {
    if ($this->cachedUser === false) {
      return null;
    }
    if ($this->cachedUser !== null) {
      return $this->cachedUser;
    }
    if (empty($_SESSION['user_id'])) {
      $this->cachedUser = false;
      return null;
    }
    $pdo = DB::pdo();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id=?');
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch();
    if (!$user) {
      $this->cachedUser = false;
      return null;
    }
    $this->cachedUser = $user;
    return $user;
  }

  protected function requireLogin() {
    $user = $this->currentUser();
    if (!$user) {
      $this->redirect('/?r=auth/login');
    }
    return $user;
  }

  protected function requireAdmin() {
    $user = $this->requireLogin();
    if (($user['role'] ?? 'guest') !== 'admin') {
      http_response_code(403);
      echo 'Forbidden';
      exit;
    }
    return $user;
  }

  protected function setCurrentUser($user) {
    $this->cachedUser = $user;
  }

  /* ===== CSRF helpers ===== */
  protected function csrfToken(): string {
    if (empty($_SESSION['csrf'])) {
      $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
  }

  protected function verifyCsrfFromPost(): bool {
    $ok = isset($_POST['_csrf']) && isset($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $_POST['_csrf']);
    if (!$ok) { http_response_code(400); echo "CSRF token không hợp lệ."; }
    return $ok;
  }

  protected function verifyCsrfFromGet(): bool {
    $ok = isset($_GET['_csrf']) && isset($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $_GET['_csrf']);
    if (!$ok) { http_response_code(400); echo "CSRF token không hợp lệ."; }
    return $ok;
  }
}
