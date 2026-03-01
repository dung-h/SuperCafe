<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class AdminFaqController extends BaseController {
  // /?r=adminFaq/list
  public function list() {
    $pdo = DB::pdo();
    $q = trim($_GET['q'] ?? '');
    $status = $_GET['status'] ?? '';
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 10;
    $offset = ($page - 1) * $perPage;

    $where = [];
    $params = [];
    if ($q !== '') {
      $where[] = '(question LIKE ? OR answer LIKE ?)';
      $like = "%$q%";
      $params[] = $like;
      $params[] = $like;
    }
    if ($status === 'public') {
      $where[] = 'is_public=1';
    } elseif ($status === 'hidden') {
      $where[] = 'is_public=0';
    }
    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $limit = (int)$perPage;
    $off = (int)$offset;
    $sql = "SELECT SQL_CALC_FOUND_ROWS * FROM faqs $whereSql ORDER BY position ASC, id DESC LIMIT $limit OFFSET $off";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();
    $total = (int)($pdo->query('SELECT FOUND_ROWS() AS t')->fetch()['t'] ?? 0);
    $totalPages = max(1, (int)ceil($total / $perPage));

    $csrf = $this->csrfToken();
    return $this->renderAdmin('admin/faq_list', compact('items','csrf','q','page','totalPages','status'), 'Admin FAQ');
  }

  // /?r=adminFaq/edit  hoac  /?r=adminFaq/edit&id=123
  public function edit() {
    $pdo = DB::pdo();
    $id = (int)($_GET['id'] ?? 0);
    $error = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) return '';

      $question = trim($_POST['question'] ?? '');
      $answer   = trim($_POST['answer'] ?? '');
      $position = (int)($_POST['position'] ?? 0);

      if ($question === '' || $answer === '') {
        $error = 'Cau hoi va Tra loi khong duoc de trong.';
      } else {
        if ($id > 0) {
          $stmt = $pdo->prepare('UPDATE faqs SET question=?, answer=?, position=? WHERE id=?');
          $stmt->execute([$question, $answer, $position, $id]);
        } else {
          $stmt = $pdo->prepare('INSERT INTO faqs(question,answer,position,is_public) VALUES(?,?,?,1)');
          $stmt->execute([$question, $answer, $position]);
        }
        return $this->redirect('/?r=adminFaq/list');
      }
    }

    $faq = null;
    if ($id > 0) {
      $stmt = $pdo->prepare('SELECT * FROM faqs WHERE id=?');
      $stmt->execute([$id]);
      $faq = $stmt->fetch();
    }
    $csrf = $this->csrfToken();
    return $this->renderAdmin('admin/faq_edit', compact('faq','error','csrf'), 'Admin - Sua FAQ');
  }

  // /?r=adminFaq/delete (POST)
  public function delete() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); return 'Method Not Allowed'; }
    if (!$this->verifyCsrfFromPost()) return '';

    $pdo = DB::pdo();
    $id = (int)($_POST['id'] ?? 0);
    if ($id > 0) {
      $stmt = $pdo->prepare('DELETE FROM faqs WHERE id=?');
      $stmt->execute([$id]);
    }
    return $this->redirect('/?r=adminFaq/list');
  }

  // /?r=adminFaq/reorder  (POST AJAX: body: ids[]=..&ids[]=..)
  public function reorder() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); return 'Method Not Allowed'; }
    if (!$this->verifyCsrfFromPost()) return '';

    $ids = $_POST['ids'] ?? [];
    if (!is_array($ids) || empty($ids)) { http_response_code(400); return 'Bad Request'; }

    $pdo = DB::pdo();
    $pdo->beginTransaction();
    try {
      $pos = 0;
      $stmt = $pdo->prepare('UPDATE faqs SET position=? WHERE id=?');
      foreach ($ids as $id) {
        $id = (int)$id;
        $stmt->execute([$pos++, $id]);
      }
      $pdo->commit();
      header('Content-Type: application/json');
      echo json_encode(['ok' => true]);
    } catch (Exception $e) {
      $pdo->rollBack();
      http_response_code(500);
      echo 'Error';
    }
    return '';
  }

  // /?r=adminFaq/toggle (POST, AJAX or normal)
  public function toggle() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); return 'Method Not Allowed'; }
    if (!$this->verifyCsrfFromPost()) return '';

    $id = (int)($_POST['id'] ?? 0);
    $current = isset($_POST['is_public']) ? (int)$_POST['is_public'] : null;
    if ($id <= 0 || $current === null) {
      http_response_code(400);
      return 'Bad Request';
    }

    $pdo = DB::pdo();
    $new = $current ? 0 : 1;
    $stmt = $pdo->prepare('UPDATE faqs SET is_public=? WHERE id=?');
    $stmt->execute([$new, $id]);

    // AJAX request
    if (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
      header('Content-Type: application/json');
      echo json_encode(['ok' => true, 'is_public' => $new]);
      return '';
    }

    return $this->redirect('/?r=adminFaq/list');
  }
}
