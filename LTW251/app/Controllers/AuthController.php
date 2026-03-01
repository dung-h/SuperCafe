<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

// KHÔNG CẦN require PHPMailer nữa vì chúng ta dùng hàm mail() của PHP
// kết hợp với cấu hình sendmail.ini bạn đã làm cho MailHog.

class AuthController extends BaseController {

  // === 1. ĐĂNG KÝ (Giữ nguyên) ===
  public function register() {
    $error = null;
    $name = trim($_POST['name'] ?? '');
    $email = trim($_POST['email'] ?? '');
    $phone = trim($_POST['phone'] ?? '');

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) { return ''; }

      $password = $_POST['password'] ?? '';
      $password2 = $_POST['password_confirm'] ?? '';
      $errors = [];

      if ($name === '') { $errors[] = 'Vui lòng nhập họ tên.'; }
      if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = 'Email không hợp lệ.'; }
      if ($phone === '' || !preg_match('/^[0-9]{9,11}$/', $phone)) { $errors[] = 'Số điện thoại không hợp lệ.'; }
      if ($password === '' || strlen($password) < 6) { $errors[] = 'Mật khẩu phải từ 6 ký tự.'; }
      if ($password !== $password2) { $errors[] = 'Mật khẩu nhập lại không khớp.'; }

      if (empty($errors)) {
        $pdo = DB::pdo();
        $stmt = $pdo->prepare('SELECT id FROM users WHERE email=? OR phone=?');
        $stmt->execute([$email, $phone]);
        if ($stmt->fetch()) {
          $errors[] = 'Email hoặc số điện thoại đã được sử dụng.';
        } else {
          $hash = password_hash($password, PASSWORD_DEFAULT);
          $username = strstr($email, '@', true) ?: $email;
          $stmt = $pdo->prepare('INSERT INTO users (username,email,phone,password,full_name,role) VALUES (?,?,?,?,?,?)');
          $stmt->execute([$username, $email, $phone, $hash, $name, 'user']);
          $_SESSION['user_id'] = (int)$pdo->lastInsertId();
          $this->redirect('/');
          return;
        }
      }

      if (!empty($errors)) {
        $error = implode(' ', $errors);
      }
    }

    $csrf = $this->csrfToken();
    return $this->render('auth/register', compact('error', 'name', 'email', 'phone', 'csrf'), 'Đăng ký');
  }

  // === 2. ĐĂNG NHẬP (Giữ nguyên) ===
  public function login() {
    $error = null;
    $email = trim($_POST['email'] ?? '');

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) { return ''; }

      $password = $_POST['password'] ?? '';
      if ($email === '' || $password === '') {
        $error = 'Vui lòng nhập email và mật khẩu.';
      } else {
        $pdo = DB::pdo();
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email=?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        
        if (!$user || !password_verify($password, $user['password'])) {
          $error = 'Email hoặc mật khẩu không đúng.';
        } elseif (!empty($user['is_blocked'])) {
          $error = 'Tài khoản đã bị khóa.';
        } else {
          if ($user['email'] === 'admin@example.com' && ($user['role'] ?? 'user') !== 'admin') {
            $stmt = $pdo->prepare('UPDATE users SET role=? WHERE id=?');
            $stmt->execute(['admin', (int)$user['id']]);
            $user['role'] = 'admin';
          }
          $_SESSION['user_id'] = (int)$user['id'];
          $stmt = $pdo->prepare('UPDATE users SET last_login_at=NOW() WHERE id=?');
          $stmt->execute([$user['id']]);
          $this->redirect('/');
          return;
        }
      }
    }

    $csrf = $this->csrfToken();
    return $this->render('auth/login', compact('error', 'email', 'csrf'), 'Đăng nhập');
  }

  // === 3. ĐĂNG XUẤT (Giữ nguyên) ===
  public function logout() {
    $_SESSION = [];
    if (session_id() !== '') {
      session_destroy();
    }
    $this->redirect('/');
  }

  // === 4. QUÊN MẬT KHẨU (Xử lý Token) ===
  public function forgotPassword() {
    $error = $success = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $email = trim($_POST['email'] ?? '');
        $pdo = DB::pdo();

        // Kiểm tra email
        $stmt = $pdo->prepare("SELECT id, full_name FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if ($user) {
            // Tạo Token
            $token = bin2hex(random_bytes(32));
            $expiry = date('Y-m-d H:i:s', time() + 3600); // 1 giờ

            // Lưu Token
            $pdo->prepare("UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?")
                ->execute([$token, $expiry, $user['id']]);

            // Gửi Mail
            $link = BASE_URL . "/?r=auth/resetPassword&token=" . $token;
            
            // Gọi hàm gửi mail mới (Dùng hàm mail() cơ bản)
            if ($this->sendResetEmail($email, $user['full_name'], $link)) {
                $success = "Đã gửi email khôi phục. Vui lòng kiểm tra MailHog (http://localhost:8025).";
            } else {
                $error = "Lỗi gửi email. Kiểm tra xem MailHog đã bật chưa?";
            }
        } else {
            $error = "Email không tồn tại trong hệ thống.";
        }
    }

    return $this->render('auth/forgot_password', compact('error', 'success'), 'Quên mật khẩu');
  }

  // === 5. ĐẶT LẠI MẬT KHẨU TỪ EMAIL ===
  public function resetPassword() {
    $token = $_GET['token'] ?? '';
    $error = $success = null;
    $pdo = DB::pdo();

    // Check Token
    $stmt = $pdo->prepare("SELECT id FROM users WHERE reset_token = ? AND reset_expires > NOW()");
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        die("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.");
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $pass1 = $_POST['new_password'] ?? '';
        $pass2 = $_POST['confirm_password'] ?? '';

        if (strlen($pass1) < 6) {
            $error = "Mật khẩu phải từ 6 ký tự.";
        } elseif ($pass1 !== $pass2) {
            $error = "Mật khẩu nhập lại không khớp.";
        } else {
            // Đổi mật khẩu & Xóa token
            $hash = password_hash($pass1, PASSWORD_DEFAULT);
            $pdo->prepare("UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?")
                ->execute([$hash, $user['id']]);
            
            $success = "Đổi mật khẩu thành công!";
        }
    }

    return $this->render('auth/reset_password', compact('error', 'success', 'token'), 'Đặt lại mật khẩu');
  }

  // === 6. HÀM GỬI EMAIL (DÙNG mail() NATIVE - KHÔNG CẦN THƯ VIỆN) ===
  private function sendResetEmail($toEmail, $toName, $resetLink) {
    // Tiêu đề email
    $subject = 'Yêu cầu đặt lại mật khẩu - Lowland Coffee';

    // Headers để gửi mail HTML và UTF-8
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: Lowland Support <no-reply@lowlandcoffee.com>" . "\r\n";

    // Nội dung email
    $message = "
        <h3>Xin chào $toName,</h3>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu tại Lowland Coffee. Bấm vào link dưới đây để tiếp tục:</p>
        <p>
            <a href='$resetLink' style='background:#5D4037;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;'>
                Đặt lại mật khẩu
            </a>
        </p>
        <p>Hoặc copy link này vào trình duyệt:</p>
        <p>$resetLink</p>
        <p>Link này sẽ hết hạn sau 1 giờ.</p>
        <hr>
        <p><i>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</i></p>
    ";

    // Gửi mail (Hàm này sẽ tự động dùng cấu hình sendmail.ini để đẩy qua MailHog)
    return mail($toEmail, $subject, $message, $headers);
  }
}