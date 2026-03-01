<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class UserController extends BaseController {
  
  // === TRANG HỒ SƠ CÁ NHÂN ===
  public function profile() {
    $user = $this->requireLogin();
    $error = null;
    $ok = null;

    // --- SỬA LỖI 1: Dùng đúng key 'full_name' ---
    $name = $user['full_name'] ?? ''; 
    $email = $user['email'];

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) {
        return '';
      }

      $name = trim($_POST['name'] ?? '');
      $email = trim($_POST['email'] ?? '');

      if ($name === '') {
        $error = 'Vui lòng nhập họ tên.';
      } elseif ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Email không hợp lệ.';
      } else {
        $pdo = DB::pdo();
        // Kiểm tra email trùng (trừ chính mình)
        if ($email !== $user['email']) {
          $stmt = $pdo->prepare('SELECT id FROM users WHERE email=? AND id<>?');
          $stmt->execute([$email, $user['id']]);
          if ($stmt->fetch()) {
            $error = 'Email đã được sử dụng.';
          }
        }

        // Xử lý Upload Avatar
        $avatarPath = $user['avatar_path'] ?? null;
        if (!$error && !empty($_FILES['avatar']['name'] ?? '')) {
          $file = $_FILES['avatar'];
          if ($file['error'] === UPLOAD_ERR_OK) {
            $maxSize = 4 * 1024 * 1024; // 4MB
            if ($file['size'] > $maxSize) {
              $error = 'Ảnh quá lớn (tối đa 4MB).';
            } else {
              $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
              $allowed = ['jpg','jpeg','png','gif','webp'];
              if (!in_array($ext, $allowed, true)) {
                $error = 'Chỉ cho phép ảnh jpg, jpeg, png, gif, webp.';
              } else {
                $uploadDir = __DIR__ . '/../../public/uploads/avatars';
                if (!is_dir($uploadDir)) {
                  mkdir($uploadDir, 0777, true);
                }
                $basename = 'u' . $user['id'] . '-' . date('Ymd-His') . '.' . $ext;
                $target = $uploadDir . DIRECTORY_SEPARATOR . $basename;
                
                if (move_uploaded_file($file['tmp_name'], $target)) {
                  $avatarPath = '/uploads/avatars/' . $basename;
                } else {
                  $error = 'Không thể lưu file ảnh.';
                }
              }
            }
          } elseif ($file['error'] !== UPLOAD_ERR_NO_FILE) {
            $error = 'Lỗi upload ảnh.';
          }
        }

        // Cập nhật DB
        if (!$error) {
          // --- SỬA LỖI 2: Tên cột trong SQL là full_name ---
          $stmt = $pdo->prepare('UPDATE users SET full_name=?, email=?, avatar_path=? WHERE id=?');
          $stmt->execute([$name, $email, $avatarPath, $user['id']]);
          
          // Cập nhật lại session user hiện tại
          $user['full_name'] = $name;
          $user['email'] = $email;
          $user['avatar_path'] = $avatarPath;
          $this->setCurrentUser($user);
          
          $ok = 'Đã lưu thông tin.';
        }
      }
    }

    $csrf = $this->csrfToken();
    return $this->render('user/profile', compact('user','name','email','error','ok','csrf'), 'Tài khoản');
  }

  // === ĐỔI MẬT KHẨU ===
  public function changePassword() {
    $user = $this->requireLogin();
    $error = null;
    $ok = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) {
        return '';
      }

      $current = $_POST['current_password'] ?? '';
      $password = $_POST['new_password'] ?? '';
      $password2 = $_POST['new_password_confirm'] ?? '';

      if ($current === '' || $password === '' || $password2 === '') {
        $error = 'Vui lòng nhập đầy đủ các trường.';
      } 
      elseif (!password_verify($current, $user['password'])) {
        $error = 'Mật khẩu hiện tại không đúng.';
      } elseif (strlen($password) < 6) {
        $error = 'Mật khẩu mới phải từ 6 ký tự.';
      } elseif ($password !== $password2) {
        $error = 'Mật khẩu mới nhập lại không khớp.';
      } else {
        $pdo = DB::pdo();
        $hash = password_hash($password, PASSWORD_DEFAULT);
        
        $stmt = $pdo->prepare('UPDATE users SET password=? WHERE id=?');
        $stmt->execute([$hash, $user['id']]);
        
        $ok = 'Đã đổi mật khẩu.';
        
        $user['password'] = $hash; 
        $this->setCurrentUser($user);
      }
    }

    $csrf = $this->csrfToken();
    return $this->render('user/change_password', compact('error','ok','csrf'), 'Đổi mật khẩu');
  }
}