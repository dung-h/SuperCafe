<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class PostController extends BaseController {
  public function list() {
    $q = trim($_GET['q'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 5;
    $offset = ($page - 1) * $perPage;
    $pdo = DB::pdo();

    if ($q !== '') {
      $stmt = $pdo->prepare(
        'SELECT SQL_CALC_FOUND_ROWS id,title,slug,excerpt,author,image,created_at
         FROM posts
         WHERE title LIKE ? OR excerpt LIKE ?
         ORDER BY id DESC
         LIMIT ' . (int)$perPage . ' OFFSET ' . (int)$offset
      );
      $like = "%$q%";
      $stmt->execute([$like, $like]);
    } else {
      $stmt = $pdo->prepare(
        'SELECT SQL_CALC_FOUND_ROWS id,title,slug,excerpt,author,image,created_at
         FROM posts
         ORDER BY id DESC
         LIMIT ' . (int)$perPage . ' OFFSET ' . (int)$offset
      );
      $stmt->execute([]);
    }

    $items = $stmt->fetchAll();
    foreach ($items as &$post) {
      $img = (string)($post['image'] ?? '');
      if ($img === '' || strpos($img, 'http') === 0) {
        $post['image'] = '/assets/images/noimage.svg';
      }
      if (empty($post['author'])) {
        $post['author'] = 'Lowland Team';
      }
    }
    unset($post);

    $total = $pdo->query('SELECT FOUND_ROWS() AS t')->fetch()['t'] ?? 0;
    $totalPages = max(1, (int)ceil($total / $perPage));
    return $this->render('post/list', compact('items', 'q', 'page', 'totalPages'), 'Bài viết');
  }

  public function detail() {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) { http_response_code(404); return 'Not found'; }

    $pdo = DB::pdo();
    $stmt = $pdo->prepare('SELECT * FROM posts WHERE id=?');
    $stmt->execute([$id]);
    $post = $stmt->fetch();
    if (!$post) { http_response_code(404); return 'Not found'; }

    $img = (string)($post['image'] ?? '');
    if ($img === '' || strpos($img, 'http') === 0) {
      $post['image'] = '/assets/images/noimage.svg';
    }
    if (empty($post['author'])) {
        $post['author'] = 'Lowland Team';
    }

    $comments = DB::getCommentsByPostId($post['id']);

    return $this->render('post/detail', compact('post', 'comments'), $post['title']);
  }

  public function addComment() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
      http_response_code(405);
      echo 'Method Not Allowed';
      return;
    }

    // Verify CSRF token
    if (!$this->verifyCsrfFromPost()) {
      return;
    }

    $postId = (int)($_POST['post_id'] ?? 0);
    $content = trim($_POST['content'] ?? '');

    if ($postId <= 0 || empty($content)) {
      // Redirect back with an error message (optional)
      header('Location: /?r=post/detail&id=' . $postId);
      exit;
    }
    
    // For logged in user
    $userId = $_SESSION['user_id'] ?? null;
    $authorName = $userId ? null : ($_POST['author_name'] ?? 'Anonymous');
    if (empty($authorName)) {
        $authorName = 'Anonymous';
    }

    $data = [
      'post_id' => $postId,
      'user_id' => $userId,
      'author_name' => $authorName,
      'content' => $content,
    ];

    DB::addComment($data);

    header('Location: /?r=post/detail&id=' . $postId . '#comments');
    exit;
  }
}
