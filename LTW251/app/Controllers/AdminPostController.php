<?php

class AdminPostController extends BaseController {
  public function list() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    $search = trim($_GET['search'] ?? '');
    $has_image = $_GET['has_image'] ?? '';
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 20;
    $offset = ($page - 1) * $perPage;
    $limit = (int)$perPage;
    $off = (int)$offset;

    $where = [];
    $params = [];
    if ($search !== '') {
      $where[] = '(title LIKE ? OR content LIKE ?)';
      $params[] = '%' . $search . '%';
      $params[] = '%' . $search . '%';
    }
    if ($has_image === '1') {
      $where[] = "image <> '' AND image <> '/assets/images/noimage.svg'";
    } elseif ($has_image === '0') {
      $where[] = "image = '' OR image = '/assets/images/noimage.svg'";
    }

    $whereSql = '';
    if (!empty($where)) {
      $whereSql = ' WHERE ' . implode(' AND ', $where);
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM posts' . $whereSql);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $sql = 'SELECT * FROM posts' . $whereSql . ' ORDER BY id DESC LIMIT ' . $limit . ' OFFSET ' . $off;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $posts = $stmt->fetchAll();
    $totalPages = $perPage > 0 ? (int)ceil($total / $perPage) : 1;

    $this->renderAdmin('admin/post_list', compact('posts', 'search', 'has_image', 'page', 'totalPages'), 'Quản lý bài viết');
  }

  public function edit() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    $id = (int)($_GET['id'] ?? 0);
    $error = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) return;

      $title = trim($_POST['title'] ?? '');
      $excerpt = trim($_POST['excerpt'] ?? '');
      $content = trim($_POST['content'] ?? '');

      if ($title === '') {
        $error = 'Tiêu đề không được để trống';
      } else {
        $slug = $this->makeSlug($title);
        $imagePath = null;

        if (!empty($_FILES['image']) && is_array($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
          $tmp = $_FILES['image']['tmp_name'];
          $original = $_FILES['image']['name'] ?? '';
          $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
          $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
          if (in_array($ext, $allowed, true)) {
            $uploadDir = __DIR__ . '/../../public/uploads/posts';
            if (!is_dir($uploadDir)) {
              mkdir($uploadDir, 0777, true);
            }
            $fileName = uniqid('post_', true) . '.' . $ext;
            $dest = $uploadDir . DIRECTORY_SEPARATOR . $fileName;
            if (move_uploaded_file($tmp, $dest)) {
              $imagePath = '/uploads/posts/' . $fileName;
            }
          }
        }

        if ($id > 0) {
          if ($imagePath) {
            $stmt = $pdo->prepare('UPDATE posts SET title=?, slug=?, excerpt=?, content=?, image=? WHERE id=?');
            $stmt->execute([$title, $slug, $excerpt, $content, $imagePath, $id]);
          } else {
            $stmt = $pdo->prepare('UPDATE posts SET title=?, slug=?, excerpt=?, content=? WHERE id=?');
            $stmt->execute([$title, $slug, $excerpt, $content, $id]);
          }
        } else {
          if (!$imagePath) {
            $imagePath = '/assets/images/noimage.svg';
          }
          $stmt = $pdo->prepare('INSERT INTO posts (title, slug, excerpt, content, image) VALUES (?,?,?,?,?)');
          $stmt->execute([$title, $slug, $excerpt, $content, $imagePath]);
        }

        $this->redirect('/?r=adminpost/list');
        return;
      }
    }

    $post = null;
    if ($id > 0) {
      $stmt = $pdo->prepare('SELECT * FROM posts WHERE id=?');
      $stmt->execute([$id]);
      $post = $stmt->fetch();
      if (!$post) {
        http_response_code(404);
        echo '404 Not Found';
        return;
      }
    }

    $this->renderAdmin('admin/post_edit', compact('post', 'error'), $id > 0 ? 'Sửa bài viết' : 'Thêm bài viết');
  }

  public function delete() {
    $this->requireAdmin();
    if (!$this->verifyCsrfFromGet()) return;

    $id = (int)($_GET['id'] ?? 0);
    if ($id > 0) {
      $pdo = DB::pdo();
      $stmt = $pdo->prepare('DELETE FROM posts WHERE id=?');
      $stmt->execute([$id]);
    }

    $this->redirect('/?r=adminpost/list');
  }

  private function makeSlug($str) {
    $str = mb_strtolower($str, 'UTF-8');
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $str);
    if ($ascii === false) {
      $ascii = $str;
    }
    $ascii = preg_replace('/[^a-z0-9\s-]/', '', $ascii);
    $ascii = preg_replace('/[\s-]+/', '-', $ascii);
    $ascii = trim($ascii, '-');
    if ($ascii === '') {
      $ascii = 'bai-viet';
    }
    return $ascii;
  }
}

