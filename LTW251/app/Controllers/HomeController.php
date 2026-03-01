<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class HomeController extends BaseController {
  public function index() {
    $pdo = DB::pdo();
    $posts = $pdo->query('SELECT id,title,excerpt,created_at,image FROM posts ORDER BY id DESC LIMIT 5')->fetchAll();
    $products = $pdo->query('SELECT id,name,slug,price,short_desc,image FROM products ORDER BY id DESC LIMIT 6')->fetchAll();
    foreach ($products as &$p) {
      $imgProd = (string)($p['image'] ?? '');
      if ($imgProd === '' || strpos($imgProd, '/uploads/') !== 0 && strpos($imgProd, '/assets/') !== 0) {
        $imgProd = '/assets/images/noimage.svg';
      }
      $p['image'] = $imgProd;
    }
    unset($p);

    foreach ($posts as &$p) {
      $imgPost = (string)($p['image'] ?? '');
      if ($imgPost === '' || strpos($imgPost, '/uploads/') !== 0 && strpos($imgPost, '/assets/') !== 0) {
        $imgPost = '/assets/images/noimage.svg';
      }
      $p['image'] = $imgPost;
    }
    unset($p);
    return $this->render('home/index', compact('posts', 'products'), 'Trang chủ');
  }
}
