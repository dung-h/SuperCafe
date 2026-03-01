<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class PageController extends BaseController {
  // /?r=page/about
  public function about() {
    $pdo = DB::pdo();
    $stmt = $pdo->prepare('SELECT title, content, updated_at FROM pages WHERE slug=?');
    $stmt->execute(['about']);
    $page = $stmt->fetch();
    if (!$page) { http_response_code(404); return 'Không có trang Giới thiệu'; }
    
    // Load sections
    $stmt = $pdo->prepare('SELECT * FROM page_sections WHERE page_slug=? AND is_active=1 ORDER BY position ASC');
    $stmt->execute(['about']);
    $sections = $stmt->fetchAll();
    
    return $this->render('page/about', compact('page', 'sections'), $page['title']);
  }
}
