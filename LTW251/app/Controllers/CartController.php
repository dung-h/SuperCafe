<?php

class CartController extends BaseController {
  
  public function index() {
    $cart = $_SESSION['cart'] ?? [];
    $pdo = DB::pdo();
    $items = [];
    $total = 0;
    
    if (!empty($cart)) {
      $ids = array_keys($cart);
      $placeholders = implode(',', array_fill(0, count($ids), '?'));
      $stmt = $pdo->prepare("SELECT id, name, price, image FROM products WHERE id IN ($placeholders)");
      $stmt->execute($ids);
      $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
      
      foreach ($products as $p) {
        $qty = $cart[$p['id']];
        $items[] = [
          'id' => $p['id'],
          'name' => $p['name'],
          'price' => $p['price'],
          'image_path' => $p['image_path'] ?? null,
          'qty' => $qty,
          'subtotal' => $p['price'] * $qty
        ];
        $total += $p['price'] * $qty;
      }
    }
    
    $this->render('cart/index', compact('items', 'total'), 'Giỏ hàng');
  }
  
  public function add() {
    $id = (int)($_POST['id'] ?? 0);
    $qty = max(1, (int)($_POST['qty'] ?? 1));
    
    if ($id > 0) {
      if (!isset($_SESSION['cart'])) {
        $_SESSION['cart'] = [];
      }
      
      if (isset($_SESSION['cart'][$id])) {
        $_SESSION['cart'][$id] += $qty;
      } else {
        $_SESSION['cart'][$id] = $qty;
      }
    }
    
    $this->redirect('/?r=cart/index');
  }
  
  public function remove() {
    $id = (int)($_GET['id'] ?? 0);
    
    if ($id > 0 && isset($_SESSION['cart'][$id])) {
      unset($_SESSION['cart'][$id]);
    }
    
    $this->redirect('/?r=cart/index');
  }
  
  public function checkout() {
    $cart = $_SESSION['cart'] ?? [];
    
    if (empty($cart)) {
      $this->redirect('/?r=cart/index');
      return;
    }
    
    $error = null;
    
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      if (!$this->verifyCsrfFromPost()) return;
      
      $name = trim($_POST['name'] ?? '');
      $email = trim($_POST['email'] ?? '');
      $phone = trim($_POST['phone'] ?? '');
      $address = trim($_POST['address'] ?? '');
      
      if ($name === '' || $email === '' || $phone === '' || $address === '') {
        $error = 'Vui lòng nhập đầy đủ thông tin nhận hàng.';
      } else {
        $pdo = DB::pdo();
        $pdo->beginTransaction();
        
        try {
          $ids = array_keys($cart);
          $placeholders = implode(',', array_fill(0, count($ids), '?'));
          $stmt = $pdo->prepare("SELECT id, price FROM products WHERE id IN ($placeholders)");
          $stmt->execute($ids);
          $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
          
          $total = 0;
          foreach ($products as $p) {
            $qty = $cart[$p['id']];
            $total += $p['price'] * $qty;
          }
          
          $userId = $_SESSION['user_id'] ?? null;
          $stmt = $pdo->prepare('INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, customer_address, total_amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
          $stmt->execute([$userId, $name, $email, $phone, $address, $total, 'pending']);
          $orderId = $pdo->lastInsertId();
          
          $stmt = $pdo->prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
          foreach ($products as $p) {
            $qty = $cart[$p['id']];
            $stmt->execute([$orderId, $p['id'], $qty, $p['price']]);
          }
          
          $pdo->commit();
          unset($_SESSION['cart']);
          
          $this->redirect('/?r=cart/success');
          return;
        } catch (Exception $e) {
          $pdo->rollBack();
          $error = 'Đặt hàng thất bại, vui lòng thử lại.';
        }
      }
    }
    
    $pdo = DB::pdo();
    $ids = array_keys($cart);
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT id, name, price FROM products WHERE id IN ($placeholders)");
    $stmt->execute($ids);
    $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $items = [];
    $total = 0;
    foreach ($products as $p) {
      $qty = $cart[$p['id']];
      $items[] = [
        'id' => $p['id'],
        'name' => $p['name'],
        'price' => $p['price'],
        'qty' => $qty,
        'subtotal' => $p['price'] * $qty
      ];
      $total += $p['price'] * $qty;
    }
    
    $this->render('cart/checkout', compact('items', 'total', 'error'), 'Thanh toán');
  }
  
  public function success() {
    $this->render('cart/success', [], 'Đặt hàng thành công');
  }
}

