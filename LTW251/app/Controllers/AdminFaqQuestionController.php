<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class AdminFaqQuestionController extends BaseController {
  
  public function list() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    
    $status = $_GET['status'] ?? 'all';
    $q = trim($_GET['q'] ?? '');
    
    $where = [];
    $params = [];
    
    if ($status === 'new') {
      $where[] = 'is_resolved = 0';
    } elseif ($status === 'resolved') {
      $where[] = 'is_resolved = 1';
    }
    
    if ($q !== '') {
      $where[] = '(name LIKE ? OR email LIKE ? OR question LIKE ?)';
      $like = '%' . $q . '%';
      $params[] = $like;
      $params[] = $like;
      $params[] = $like;
    }
    
    $sql = 'SELECT * FROM faq_questions';
    if (!empty($where)) {
      $sql .= ' WHERE ' . implode(' AND ', $where);
    }
    $sql .= ' ORDER BY is_resolved ASC, id DESC LIMIT 100';
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();
    
    $csrf = $this->csrfToken();
    return $this->renderAdmin('admin/faq_question_list', compact('items', 'status', 'q', 'csrf'), 'Quản lý câu hỏi FAQ');
  }
  
  public function resolve() {
    $this->requireAdmin();
    
    if (($_GET['action'] ?? '') === 'resolve' && isset($_GET['id'])) {
      $pdo = DB::pdo();
      $stmt = $pdo->prepare('UPDATE faq_questions SET is_resolved=1 WHERE id=?');
      $stmt->execute([(int)$_GET['id']]);
    }
    
    $this->redirect('/?r=adminFaqQuestion/list');
  }
  
  public function delete() {
    $this->requireAdmin();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) return;
      
      $id = (int)($_POST['id'] ?? 0);
      $pdo = DB::pdo();
      $stmt = $pdo->prepare('DELETE FROM faq_questions WHERE id=?');
      $stmt->execute([$id]);
    }
    
    $this->redirect('/?r=adminFaqQuestion/list');
  }
}
