<?php

class AdminCommentController extends BaseController {
  public function list() {
    $this->requireAdmin();
    $pdo = DB::pdo();

    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 20;
    $offset = ($page - 1) * $perPage;

    $status = $_GET['status'] ?? 'all';
    $q = trim($_GET['q'] ?? '');
    $where = [];
    $params = [];
    if ($status === 'approved') {
      $where[] = 'c.is_approved = 1';
    } elseif ($status === 'pending') {
      $where[] = 'c.is_approved = 0';
    }
    if ($q !== '') {
      $where[] = '(p.title LIKE ? OR c.author_name LIKE ? OR c.content LIKE ?)';
      $like = '%' . $q . '%';
      $params[] = $like;
      $params[] = $like;
      $params[] = $like;
    }

    $whereSql = '';
    if (!empty($where)) {
      $whereSql = ' WHERE ' . implode(' AND ', $where);
    }

    $sqlCount = 'SELECT COUNT(*) FROM comments c LEFT JOIN posts p ON c.post_id = p.id' . $whereSql;
    $stmt = $pdo->prepare($sqlCount);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $limit = (int)$perPage;
    $off = (int)$offset;
    $sql = '
      SELECT c.id,
             c.post_id,
             c.user_id,
             c.author_name,
             c.content,
             c.is_approved,
             c.created_at,
             p.title AS post_title
      FROM comments c
      LEFT JOIN posts p ON c.post_id = p.id' . $whereSql . '
      ORDER BY c.id DESC
      LIMIT ' . $limit . ' OFFSET ' . $off;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $comments = $stmt->fetchAll();
    $totalPages = $perPage > 0 ? (int)ceil($total / $perPage) : 1;

    $this->renderAdmin('admin/comment_list', compact('comments', 'page', 'totalPages', 'status', 'q'), 'Quản lý bình luận');
  }

  public function toggleApprove() {
    $this->requireAdmin();
    if (!$this->verifyCsrfFromGet()) {
      return;
    }

    $id = (int)($_GET['id'] ?? 0);
    if ($id > 0) {
      $pdo = DB::pdo();
      $stmt = $pdo->prepare('UPDATE comments SET is_approved = 1 - is_approved WHERE id=?');
      $stmt->execute([$id]);
    }

    $this->redirect('/?r=admincomment/list');
  }

  public function delete() {
    $this->requireAdmin();
    if (!$this->verifyCsrfFromGet()) {
      return;
    }

    $id = (int)($_GET['id'] ?? 0);
    if ($id > 0) {
      $pdo = DB::pdo();
      $stmt = $pdo->prepare('DELETE FROM comments WHERE id=?');
      $stmt->execute([$id]);
    }

    $this->redirect('/?r=admincomment/list');
  }
}

