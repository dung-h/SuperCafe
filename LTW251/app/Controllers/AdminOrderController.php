<?php

class adminOrderController extends BaseController {
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
    if (in_array($status, ['pending', 'processing', 'completed', 'cancelled'], true)) {
      $where[] = 'status = ?';
      $params[] = $status;
    }
    if ($q !== '') {
      $where[] = '(customer_name LIKE ? OR customer_email LIKE ?)';
      $like = '%' . $q . '%';
      $params[] = $like;
      $params[] = $like;
    }

    $whereSql = '';
    if (!empty($where)) {
      $whereSql = ' WHERE ' . implode(' AND ', $where);
    }

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM orders' . $whereSql);
    $stmt->execute($params);
    $total = (int)$stmt->fetchColumn();

    $limit = (int)$perPage;
    $off = (int)$offset;
    $sql = 'SELECT * FROM orders' . $whereSql . ' ORDER BY id DESC LIMIT ' . $limit . ' OFFSET ' . $off;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();
    $totalPages = $perPage > 0 ? (int)ceil($total / $perPage) : 1;

    $this->renderAdmin('admin/order_list', compact('orders', 'page', 'totalPages', 'status', 'q'), 'Quản lý đơn hàng');
  }

  public function detail() {
    $this->requireAdmin();
    $id = (int)($_GET['id'] ?? 0);

    $pdo = DB::pdo();
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id=?');
    $stmt->execute([$id]);
    $order = $stmt->fetch();

    if (!$order) {
      http_response_code(404);
      echo '404 Not Found';
      return;
    }

    $stmt = $pdo->prepare('
      SELECT oi.*, oi.quantity AS qty, p.name AS product_name 
      FROM order_items oi 
      LEFT JOIN products p ON oi.product_id = p.id 
      WHERE oi.order_id = ?
    ');
    $stmt->execute([$id]);
    $items = $stmt->fetchAll();

    $total = 0;
    foreach ($items as $item) {
      $total += $item['price'] * $item['qty'];
    }

    $this->renderAdmin('admin/order_detail', compact('order', 'items', 'total'), 'Chi tiết đơn hàng #' . $id);
  }

  public function updateStatus() {
    $this->requireAdmin();
    if (!$this->verifyCsrfFromPost()) {
      return;
    }

    $id = (int)($_POST['id'] ?? 0);
    $status = $_POST['status'] ?? '';

    if ($id > 0 && in_array($status, ['pending', 'processing', 'completed', 'cancelled'], true)) {
      $pdo = DB::pdo();
      $stmt = $pdo->prepare('UPDATE orders SET status=? WHERE id=?');
      $stmt->execute([$status, $id]);
    }

    $this->redirect('/?r=adminOrder/detail&id=' . $id);
  }
}

