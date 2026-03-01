<?php

class AdminPageController extends BaseController {
  public function list() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    $pages = $pdo->query('SELECT * FROM pages ORDER BY id')->fetchAll();
    $this->renderAdmin('admin/page_list', compact('pages'), 'Quản lý trang');
  }

  public function edit() {
    $this->requireAdmin();
    $pdo = DB::pdo();
    $slug = $_GET['slug'] ?? '';
    $error = null;
    $ok = null;

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) return '';

      if ($slug === 'about') {
        $pageTitle = trim($_POST['page_title'] ?? '');
        $pageContent = trim($_POST['page_content'] ?? '');
        $sections = $_POST['sections'] ?? [];

        if ($pageTitle === '') {
          $error = 'Tiêu đề trang không được để trống.';
        } else {
          $pdo->beginTransaction();
          try {
            $stmt = $pdo->prepare('UPDATE pages SET title=?, content=? WHERE slug=?');
            $stmt->execute([$pageTitle, $pageContent, $slug]);

            $stmt = $pdo->prepare('DELETE FROM page_sections WHERE page_slug=?');
            $stmt->execute([$slug]);

            $insertSection = $pdo->prepare('INSERT INTO page_sections(page_slug,section_type,title,content,image_path,position) VALUES(?,?,?,?,?,?)');
            
            foreach ($sections as $pos => $sec) {
              $sType = trim($sec['type'] ?? '');
              $sTitle = trim($sec['title'] ?? '');
              $sContent = trim($sec['content'] ?? '');
              $sImage = trim($sec['image'] ?? '');
              
              // Xử lý upload ảnh nếu có
              if (isset($_FILES['sections']['name'][$pos]['image_file']) && 
                  $_FILES['sections']['error'][$pos]['image_file'] === UPLOAD_ERR_OK) {
                
                $uploadDir = __DIR__ . '/../../public/uploads/pages/';
                $fileName = basename($_FILES['sections']['name'][$pos]['image_file']);
                $targetPath = $uploadDir . time() . '_' . $fileName;
                
                if (move_uploaded_file($_FILES['sections']['tmp_name'][$pos]['image_file'], $targetPath)) {
                  $sImage = '/uploads/pages/' . time() . '_' . $fileName;
                }
              }
              
              if ($sType && $sTitle) {
                $insertSection->execute([$slug, $sType, $sTitle, $sContent, $sImage, $pos]);
              }
            }

            $pdo->commit();
            $ok = 'Đã lưu thành công.';
          } catch (Exception $e) {
            $pdo->rollBack();
            $error = 'Lỗi: ' . $e->getMessage();
          }
        }
      } else {
        $title = trim($_POST['title'] ?? '');
        $content = trim($_POST['content'] ?? '');

        if ($title === '' || $content === '') {
          $error = 'Tiêu đề và nội dung không được để trống.';
        } else {
          $stmt = $pdo->prepare('UPDATE pages SET title=?, content=? WHERE slug=?');
          $stmt->execute([$title, $content, $slug]);
          $ok = 'Đã lưu thành công.';
        }
      }
    }

    $stmt = $pdo->prepare('SELECT * FROM pages WHERE slug=?');
    $stmt->execute([$slug]);
    $page = $stmt->fetch();

    if (!$page) {
      http_response_code(404);
      echo '404 Not Found';
      return;
    }

    $sections = [];
    if ($slug === 'about') {
      $stmt = $pdo->prepare('SELECT * FROM page_sections WHERE page_slug=? ORDER BY position ASC');
      $stmt->execute([$slug]);
      $sections = $stmt->fetchAll();
    }

    $csrf = $this->csrfToken();
    $this->renderAdmin('admin/page_edit', compact('page', 'sections', 'error', 'ok', 'csrf'), 'Sửa trang: ' . $page['title']);
  }

  public function editAbout() {
    $_GET['slug'] = 'about';
    return $this->edit();
  }
}


