<?php

class adminProductController extends BaseController {
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
      $where[] = 'name LIKE ?';
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

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM products' . $whereSql);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $sql = 'SELECT * FROM products' . $whereSql . ' ORDER BY id DESC LIMIT ' . $limit . ' OFFSET ' . $off;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $products = $stmt->fetchAll();
    foreach ($products as &$p) {
      $img = (string)($p['image'] ?? '');
      if ($img === '' || strpos($img, '/uploads/') !== 0) {
        $img = '/assets/images/noimage.svg';
      }
      $p['image'] = $img;
    }
    unset($p);

    $totalPages = $perPage > 0 ? (int)ceil($total / $perPage) : 1;

    $this->renderAdmin('admin/product_list', compact('products', 'search', 'has_image', 'page', 'totalPages'), 'Quản lý sản phẩm');
  }

  public function edit() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    $id = (int)($_GET['id'] ?? 0);
    $error = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) {
        return;
      }

      $name = trim($_POST['name'] ?? '');
      $price = (float)($_POST['price'] ?? 0);
      $short_desc = trim($_POST['short_desc'] ?? '');
      $description = trim($_POST['description'] ?? '');

      if ($name === '' || $price < 0) {
        $error = 'Tên sản phẩm không được để trống và giá không âm.';
      } else {
        $slug = $this->makeSlug($name);
        $imagePath = null;

        if (!empty($_FILES['image']) && is_array($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
          $tmp = $_FILES['image']['tmp_name'];
          $original = $_FILES['image']['name'] ?? '';
          $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
          $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
          if (in_array($ext, $allowed, true)) {
            $uploadDir = __DIR__ . '/../../public/uploads/products';
            if (!is_dir($uploadDir)) {
              mkdir($uploadDir, 0777, true);
            }
            $fileName = uniqid('p_', true) . '.' . $ext;
            $dest = $uploadDir . DIRECTORY_SEPARATOR . $fileName;
            if (move_uploaded_file($tmp, $dest)) {
              $imagePath = '/uploads/products/' . $fileName;
            }
          }
        }

        if ($id > 0) {
          if ($imagePath) {
            $stmt = $pdo->prepare('UPDATE products SET name=?, slug=?, price=?, short_desc=?, description=?, image=? WHERE id=?');
            $stmt->execute([$name, $slug, $price, $short_desc, $description, $imagePath, $id]);
          } else {
            $stmt = $pdo->prepare('UPDATE products SET name=?, slug=?, price=?, short_desc=?, description=? WHERE id=?');
            $stmt->execute([$name, $slug, $price, $short_desc, $description, $id]);
          }
        } else {
          if (!$imagePath) {
            $imagePath = '/assets/images/noimage.svg';
          }
          $stmt = $pdo->prepare('INSERT INTO products (name, slug, price, short_desc, description, image) VALUES (?,?,?,?,?,?)');
          $stmt->execute([$name, $slug, $price, $short_desc, $description, $imagePath]);
        }

        $this->redirect('/?r=adminProduct/list');
        return;
      }
    }

    $product = null;
    if ($id > 0) {
      $stmt = $pdo->prepare('SELECT * FROM products WHERE id=?');
      $stmt->execute([$id]);
      $product = $stmt->fetch();
      if (!$product) {
        http_response_code(404);
        echo '404 Not Found';
        return;
      }
    }

    $this->renderAdmin('admin/product_edit', compact('product', 'error'), $id > 0 ? 'Sửa sản phẩm' : 'Thêm sản phẩm');
  }

  public function delete() {
    $this->requireAdmin();
    if (!$this->verifyCsrfFromGet()) {
      return;
    }

    $id = (int)($_GET['id'] ?? 0);
    if ($id > 0) {
      $pdo = DB::pdo();
      $stmt = $pdo->prepare('DELETE FROM products WHERE id=?');
      $stmt->execute([$id]);
    }

    $this->redirect('/?r=adminProduct/list');
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
      $ascii = 'san-pham';
    }
    return $ascii;
  }
}

