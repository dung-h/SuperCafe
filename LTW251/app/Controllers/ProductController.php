<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class ProductController extends BaseController {
  public function list() {
    $q = trim($_GET['q'] ?? '');
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = 8;
    $offset = ($page - 1) * $perPage;
    $pdo = DB::pdo();

    if ($q !== '') {
      $stmt = $pdo->prepare(
        'SELECT SQL_CALC_FOUND_ROWS id,name,slug,price,short_desc,image
         FROM products
         WHERE name LIKE ? OR short_desc LIKE ?
         ORDER BY id DESC
         LIMIT ' . (int)$perPage . ' OFFSET ' . (int)$offset
      );
      $like = "%$q%";
      $stmt->execute([$like, $like]);
    } else {
      $stmt = $pdo->prepare(
        'SELECT SQL_CALC_FOUND_ROWS id,name,slug,price,short_desc,image
         FROM products
         ORDER BY id DESC
         LIMIT ' . (int)$perPage . ' OFFSET ' . (int)$offset
      );
      $stmt->execute([]);
    }

    $items = $stmt->fetchAll();
    foreach ($items as &$p) {
      $img = (string)($p['image'] ?? '');
      if ($img === '' || strpos($img, '/uploads/') !== 0 && strpos($img, '/assets/') !== 0) {
        $img = '/assets/images/noimage.svg';
      }
      $p['image'] = $img;
    }
    unset($p);

    $total = $pdo->query('SELECT FOUND_ROWS() AS t')->fetch()['t'] ?? 0;
    $totalPages = max(1, (int)ceil($total / $perPage));
    return $this->render('product/list', compact('items', 'q', 'page', 'totalPages'), 'Sản phẩm');
  }

  public function detail() {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) { http_response_code(404); return 'Not found'; }

    $pdo = DB::pdo();
    $stmt = $pdo->prepare('SELECT * FROM products WHERE id=?');
    $stmt->execute([$id]);
    $p = $stmt->fetch();
    if (!$p) { http_response_code(404); return 'Not found'; }
    $img = (string)($p['image'] ?? '');
    if ($img === '' || strpos($img, '/uploads/') !== 0 && strpos($img, '/assets/') !== 0) {
        $img = '/assets/images/noimage.svg';
      }
    $p['image'] = $img;

    return $this->render('product/detail', compact('p'), $p['name']);
  }
}
