<?php
require_once __DIR__ . '/BaseController.php';

class AdminUserController extends BaseController {
  
  // === DANH SÁCH NGƯỜI DÙNG ===
  public function list() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    
    // Lấy tham số filter
    $q = trim($_GET['q'] ?? '');
    $role = trim($_GET['role'] ?? '');
    $status = trim($_GET['status'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 10;
    $offset = ($page - 1) * $perPage;

    // Xây dựng câu truy vấn
    $whereParts = [];
    $params = [];
    if ($q !== '') {
      $like = '%' . $q . '%';
      $whereParts[] = '(full_name LIKE ? OR email LIKE ?)';
      $params[] = $like;
      $params[] = $like;
    }
    if ($role !== '') {
      $whereParts[] = 'role = ?';
      $params[] = $role;
    }
    if ($status === 'active') {
      $whereParts[] = 'is_blocked = 0';
    } elseif ($status === 'blocked') {
      $whereParts[] = 'is_blocked = 1';
    }

    $where = '';
    if (!empty($whereParts)) {
      $where = 'WHERE ' . implode(' AND ', $whereParts);
    }

    // Thực thi truy vấn phân trang
    $limit = (int)$perPage;
    $off = (int)$offset;
    $sql = "SELECT SQL_CALC_FOUND_ROWS * FROM users $where ORDER BY id DESC LIMIT $limit OFFSET $off";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();
    
    // Tính tổng số trang
    $total = (int)($pdo->query('SELECT FOUND_ROWS() AS t')->fetch()['t'] ?? 0);
    $totalPages = max(1, (int)ceil($total / $perPage));

    $csrf = $this->csrfToken();
    
    // Render View (Lưu ý: đường dẫn view là admin/user/list)
    return $this->renderAdmin('admin/users', compact('items','q','role','status','page','totalPages','csrf'), 'Quản lý người dùng');
  }

  // === (MỚI) CHỈNH SỬA / XEM CHI TIẾT NGƯỜI DÙNG ===
  public function edit() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    $id = (int)($_GET['id'] ?? 0);
    $error = $success = '';

    // 1. Lấy thông tin user hiện tại
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$id]);
    $user = $stmt->fetch();

    if (!$user) {
        $this->redirect('?r=adminUser/list');
    }

    // 2. Xử lý khi bấm Lưu thay đổi
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $fullName = trim($_POST['full_name'] ?? '');
        $phone    = trim($_POST['phone'] ?? '');
        $role     = $_POST['role'] ?? 'user';
        $isBlocked = (int)($_POST['is_blocked'] ?? 0);

        // Validate dữ liệu
        if ($fullName === '') {
            $error = "Họ tên không được để trống.";
        } 
        // Bảo mật: Không cho phép Admin tự khóa chính mình hoặc đổi vai trò của Admin gốc
        elseif ($user['email'] === 'admin@example.com' && ($role !== 'admin' || $isBlocked == 1)) {
            $error = "Không thể khóa hoặc hạ quyền tài khoản Admin mặc định.";
        }
        else {
            // Update vào Database
            $sql = "UPDATE users SET full_name = ?, phone = ?, role = ?, is_blocked = ? WHERE id = ?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([$fullName, $phone, $role, $isBlocked, $id]);
            
            $success = "Cập nhật thông tin thành công!";
            
            // Cập nhật lại biến $user để hiển thị thông tin mới nhất ra view
            $user['full_name'] = $fullName;
            $user['phone'] = $phone;
            $user['role'] = $role;
            $user['is_blocked'] = $isBlocked;
        }
    }

    // Render View Edit
    return $this->renderAdmin('admin/users', compact('user', 'error', 'success'), 'Chi tiết người dùng');
  }

  // === KHÓA NHANH (TOGGLE BLOCK) ===
  public function toggleBlock() {
    $this->requireAdmin();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
      http_response_code(405); echo 'Method Not Allowed'; return '';
    }
    if (!$this->verifyCsrfFromPost()) { return ''; }

    $id = (int)($_POST['id'] ?? 0);
    
    // Bảo vệ admin gốc
    $pdo = DB::pdo();
    $chk = $pdo->prepare("SELECT email FROM users WHERE id=?");
    $chk->execute([$id]);
    $u = $chk->fetch();
    if ($u && $u['email'] === 'admin@example.com') {
        // Không làm gì cả nếu là admin gốc
        $this->redirect('?r=adminUser/list'); 
        return;
    }

    if ($id > 0) {
      $stmt = $pdo->prepare('UPDATE users SET is_blocked = 1 - is_blocked WHERE id=?');
      $stmt->execute([$id]);
    }
    $this->redirect('?r=adminUser/list');
  }

  // === RESET MẬT KHẨU ===
  public function resetPassword() {
    $this->requireAdmin();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
      http_response_code(405); echo 'Method Not Allowed'; return '';
    }
    if (!$this->verifyCsrfFromPost()) { return ''; }

    $id = (int)($_POST['id'] ?? 0);
    
    // Bảo vệ admin gốc (không cho reset password admin qua nút nhanh)
    $pdo = DB::pdo();
    $chk = $pdo->prepare("SELECT email FROM users WHERE id=?");
    $chk->execute([$id]);
    $u = $chk->fetch();
    
    if (!$u || $u['email'] === 'admin@example.com') {
         $this->redirect('?r=adminUser/list');
         return;
    }

    // Tạo mật khẩu ngẫu nhiên 8 ký tự
    $newPass = bin2hex(random_bytes(4)); 
    $hash = password_hash($newPass, PASSWORD_DEFAULT);
    
    $stmt = $pdo->prepare('UPDATE users SET password=? WHERE id=?');
    $stmt->execute([$hash, $id]);

    // Hiển thị view thông báo mật khẩu mới
    return $this->renderAdmin('admin/user_reset_password', compact('user','newPass'), 'Admin - Reset mật khẩu');
  }
}