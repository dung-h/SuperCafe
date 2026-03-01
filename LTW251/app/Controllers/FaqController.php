<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class FaqController extends BaseController {
  public function list() {
    $q = trim($_GET['q'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 10;
    $offset = ($page - 1) * $perPage;

    $pdo = DB::pdo();
    $message = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      $name = trim($_POST['name'] ?? '');
      $email = trim($_POST['email'] ?? '');
      $question = trim($_POST['question'] ?? '');

      if ($name && filter_var($email, FILTER_VALIDATE_EMAIL) && $question) {
        $stmt = $pdo->prepare('INSERT INTO faq_questions(name,email,question) VALUES(?,?,?)');
        $stmt->execute([$name, $email, $question]);
        $message = 'Câu hỏi của bạn đã được gửi. Chúng tôi sẽ phản hồi qua email trong thời gian sớm nhất.';
      } else {
        $message = 'Vui lòng điền đầy đủ họ tên, email hợp lệ và nội dung câu hỏi.';
      }
    }

    if ($q !== '') {
      $stmt = $pdo->prepare(
        'SELECT SQL_CALC_FOUND_ROWS * FROM faqs
         WHERE is_public=1 AND (question LIKE ? OR answer LIKE ?)
         ORDER BY position ASC, id DESC
         LIMIT ' . (int)$perPage . ' OFFSET ' . (int)$offset
      );
      $like = "%$q%";
      $stmt->execute([$like, $like]);
    } else {
      $stmt = $pdo->prepare(
        'SELECT SQL_CALC_FOUND_ROWS * FROM faqs
         WHERE is_public=1
         ORDER BY position ASC, id DESC
         LIMIT ' . (int)$perPage . ' OFFSET ' . (int)$offset
      );
      $stmt->execute([]);
    }

    $items = $stmt->fetchAll();
    $total = (int)($pdo->query('SELECT FOUND_ROWS() AS t')->fetch()['t'] ?? 0);
    $totalPages = max(1, (int)ceil($total / $perPage));

    return $this->render(
      'faq/list',
      compact('items', 'q', 'page', 'totalPages', 'message'),
      'Hỏi đáp (FAQ)'
    );
  }
}

