
<?php
// Load Composer autoloader
require_once __DIR__ . '/../../vendor/autoload.php';

require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

// Import PHPMailer (để sẵn cho trường hợp cần dùng)
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

class AdminController extends BaseController {
  public function index() {
        $this->requireAdmin();
        $pdo = DB::pdo();
        $counts = [
          'products' => (int)$pdo->query('SELECT COUNT(*) c FROM products')->fetch()['c'],
          'posts' => (int)$pdo->query('SELECT COUNT(*) c FROM posts')->fetch()['c'],
          'contacts' => (int)$pdo->query('SELECT COUNT(*) c FROM contacts')->fetch()['c'],
          'faq_questions' => (int)$pdo->query('SELECT COUNT(*) c FROM faq_questions WHERE is_resolved=0')->fetch()['c'],
        ];
        return $this->renderAdmin('admin/dashboard', compact('counts'), 'Bảng điều khiển Admin');
    }
    
    public function contacts() {
        $this->requireAdmin();
        $pdo = DB::pdo();
    
        // === XỬ LÝ HÀNH ĐỘNG ===
        $action = $_GET['action'] ?? '';
        $id = (int)($_GET['id'] ?? 0);
    
        if ($action === 'delete' && $id) {
            $pdo->prepare("DELETE FROM contacts WHERE id = ?")->execute([$id]);
            $this->redirect('?r=admin/contacts'); // Sửa đường dẫn redirect
        }
    
        if ($action === 'resolve' && $id) {
            $pdo->prepare("UPDATE contacts SET is_resolved = 1, replied_at = NOW() WHERE id = ?")
                ->execute([$id]);
            $this->redirect('?r=admin/contacts'); // Sửa đường dẫn redirect
        }
    
        if ($action === 'reply' && $id) {
            return $this->replyContact($id); 
        }
    
        // === LỌC & TÌM KIẾM ===
        $status = $_GET['status'] ?? 'all';
        $q = trim($_GET['q'] ?? '');
        $where = [];
        $params = [];
    
        if ($status === 'new') $where[] = 'is_resolved = 0';
        if ($status === 'resolved') $where[] = 'is_resolved = 1';
        if ($q !== '') {
            $where[] = '(name LIKE ? OR email LIKE ?)';
            $like = "%$q%";
            $params[] = $like; $params[] = $like;
        }
    
        $sql = "SELECT * FROM contacts";
        if ($where) $sql .= " WHERE " . implode(' AND ', $where);
        $sql .= " ORDER BY id DESC LIMIT 100";
    
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();
    
        return $this->renderAdmin('admin/contacts', compact('items', 'status', 'q'), 'Quản lý liên hệ');
    }

    // === HÀM REPLY CẬP NHẬT ===
    private function replyContact($id) {
        $pdo = DB::pdo();
        $stmt = $pdo->prepare("SELECT * FROM contacts WHERE id = ?");
        $stmt->execute([$id]);
        $contact = $stmt->fetch();

        if (!$contact) {
            die("Liên hệ không tồn tại");
        }

        $success = $error = '';

        // Phần check email (giữ nguyên nếu muốn, hoặc bỏ qua vì MailHog nhận tất cả)
        if (isset($_POST['check_email'])) {
             // ... logic check dns cũ ...
        }

        if (isset($_POST['send_reply'])) {
            $reply = trim($_POST['reply_message'] ?? '');
            $note  = trim($_POST['admin_note'] ?? '');
            
            if ($reply === '') {
                $error = "Vui lòng nhập nội dung phản hồi.";
            } else {
                // --- THAY THẾ PHPMAILER BẰNG HÀM MAIL() CƠ BẢN ---
                
                $to = $contact['email'];
                $subject = "Lowland Coffee – Phản hồi liên hệ #$id";
                
                // Header bắt buộc để gửi HTML và Tiếng Việt
                $headers = "MIME-Version: 1.0" . "\r\n";
                $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
                $headers .= "From: Lowland Coffee <admin@lowlandcoffee.com>" . "\r\n";

                $message = "
                    <h2>Xin chào {$contact['name']},</h2>
                    <p>Cảm ơn bạn đã liên hệ Lowland Coffee!</p>
                    <p>Dưới đây là phản hồi từ chúng tôi:</p>
                    <div style='background:#f5f0e6;padding:15px;border-left:4px solid #6d4c41;'>
                        " . nl2br(htmlspecialchars($reply)) . "
                    </div>
                    <p>Trân trọng,<br><strong>Đội ngũ Lowland Coffee</strong></p>
                ";

                // Gửi mail (Hàm này sẽ gọi sendmail.exe -> đẩy qua MailHog)
                if (mail($to, $subject, $message, $headers)) {
                    // Update Database
                    $pdo->prepare("
                        UPDATE contacts 
                        SET is_resolved = 1, 
                            replied_at = NOW(), 
                            admin_note = ?, 
                            reply_content = ? 
                        WHERE id = ?
                    ")->execute([$note, $reply, $id]);

                    $success = "Đã gửi mail thành công! (Kiểm tra tại http://localhost:8025)";
                    
                    // Cập nhật view
                    $contact['is_resolved'] = 1;
                    $contact['replied_at'] = date('Y-m-d H:i:s');
                    $contact['reply_content'] = $reply;
                    $contact['admin_note'] = $note;
                } else {
                    $error = "Gửi thất bại. Hãy kiểm tra xem MailHog đã bật chưa?";
                }
            }
        }

        return $this->renderAdmin('admin/contact_reply', compact('contact', 'success', 'error'), "Phản hồi #{$id}");
    }

  public function contactInfo() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    $error = null;
    $success = null;

    $stmt = $pdo->query('SELECT * FROM contact_settings ORDER BY id LIMIT 1');
    $info = $stmt->fetch();

    if (!$info) {
      $pdo->exec("INSERT INTO contact_settings (id, address, phone, email, opening_hours)
                  VALUES (1,
                    '123 Nguyễn Huệ, Q.1, TP.HCM',
                    '028 3822 1234',
                    'info@lowlandcoffee.com',
                    'Thứ 2 - Chủ nhật: 7:00 - 22:00')");
      $stmt = $pdo->query('SELECT * FROM contact_settings ORDER BY id LIMIT 1');
      $info = $stmt->fetch();
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) {
        return;
      }

      $address = trim($_POST['address'] ?? '');
      $phone = trim($_POST['phone'] ?? '');
      $email = trim($_POST['email'] ?? '');
      $opening = trim($_POST['opening_hours'] ?? '');

      if ($address === '' || $phone === '' || $email === '' || $opening === '') {
        $error = 'Vui lòng nhập đầy đủ địa chỉ, điện thoại, email và giờ mở cửa.';
      } else {
        $stmt = $pdo->prepare('UPDATE contact_settings SET address=?, phone=?, email=?, opening_hours=? WHERE id=?');
        $stmt->execute([$address, $phone, $email, $opening, (int)$info['id']]);
        $success = 'Cập nhật thông tin liên hệ thành công.';
        $info['address'] = $address;
        $info['phone'] = $phone;
        $info['email'] = $email;
        $info['opening_hours'] = $opening;
      }
    }

    return $this->renderAdmin('admin/contact_info', compact('info', 'error', 'success'), 'Cấu hình thông tin liên hệ');
  }
}
