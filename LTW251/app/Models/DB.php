<?php
class DB {
  private static $pdo = null;
  private static $initialized = false;

  public static function pdo() {
    if (self::$pdo === null) {
      require_once __DIR__ . '/../../config/config.php';
      $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
      self::$pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
      ]);

      self::ensureBotSchema();

      if (defined('APP_DEBUG') && APP_DEBUG) {
        self::ensurePagesTable();
      }

      self::$initialized = true;
    }
    return self::$pdo;
  }

  private static function ensurePagesTable() {
    // Tự tạo bảng pages (nếu chưa có) và seed trang about trong môi trường dev
    $sql = "
      CREATE TABLE IF NOT EXISTS pages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        slug VARCHAR(191) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        content MEDIUMTEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ";
    self::$pdo->exec($sql);

    $seedSql = "
      INSERT IGNORE INTO pages (slug, title, content)
      VALUES (
        'about',
        'Giới thiệu',
        'Lowland Coffee là quán cà phê ấm cúng giữa lòng Sài Gòn, được sinh ra từ tình yêu với những hạt cà phê rang xay tại chỗ và mong muốn tạo nên một không gian chậm, nơi ai cũng có thể tạm gác lại nhịp sống vội vã.'
      );
    ";
    self::$pdo->exec($seedSql);
  }

  private static function ensureBotSchema() {
    if (!self::tableExists('products')) {
      return;
    }

    if (!self::columnExists('products', 'sku')) {
      self::$pdo->exec("ALTER TABLE products ADD COLUMN sku VARCHAR(64) NULL AFTER slug");
    }

    if (!self::columnExists('products', 'stock_qty')) {
      self::$pdo->exec("ALTER TABLE products ADD COLUMN stock_qty INT NOT NULL DEFAULT 999 AFTER price");
    }

    self::$pdo->exec("UPDATE products SET sku = CONCAT('WEB-P', id) WHERE sku IS NULL OR sku = ''");
    self::$pdo->exec("UPDATE products SET stock_qty = 999 WHERE stock_qty IS NULL OR stock_qty < 0");

    if (!self::indexExists('products', 'uk_products_sku')) {
      self::$pdo->exec("ALTER TABLE products ADD UNIQUE KEY uk_products_sku (sku)");
    }

    self::$pdo->exec("
      CREATE TABLE IF NOT EXISTS bot_orders (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        order_code VARCHAR(32) NOT NULL UNIQUE,
        order_id INT NULL,
        chat_user_id VARCHAR(100) NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(20) NOT NULL,
        customer_address VARCHAR(255) NOT NULL,
        items_json MEDIUMTEXT NOT NULL,
        subtotal_vnd INT NOT NULL,
        shipping_vnd INT NOT NULL DEFAULT 0,
        total_vnd INT NOT NULL,
        payment_method ENUM('bank_transfer','cod') NOT NULL DEFAULT 'bank_transfer',
        payment_ref VARCHAR(191) NULL,
        note TEXT NULL,
        status ENUM('new','awaiting_payment','payment_review','paid','shipping','completed','cancelled') NOT NULL DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_bot_orders_chat_user_id (chat_user_id),
        INDEX idx_bot_orders_order_id (order_id),
        CONSTRAINT fk_bot_orders_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    ");
  }

  private static function tableExists($table) {
    $stmt = self::$pdo->prepare("SHOW TABLES LIKE ?");
    $stmt->execute([$table]);
    return (bool)$stmt->fetchColumn();
  }

  private static function columnExists($table, $column) {
    $stmt = self::$pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
    $stmt->execute([$column]);
    return (bool)$stmt->fetchColumn();
  }

  private static function indexExists($table, $indexName) {
    $stmt = self::$pdo->prepare("SHOW INDEX FROM `$table` WHERE Key_name = ?");
    $stmt->execute([$indexName]);
    return (bool)$stmt->fetch();
  }

  // =========================================================
  // COMMENTS
  // =========================================================
  
  public static function getCommentsByPostId($postId) {
    $stmt = self::pdo()->prepare(
      "SELECT c.*, u.full_name, u.avatar_path 
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ? AND c.is_approved = 1
       ORDER BY c.created_at DESC"
    );
    $stmt->execute([$postId]);
    return $stmt->fetchAll();
  }

  public static function addComment($data) {
    $stmt = self::pdo()->prepare(
      "INSERT INTO comments (post_id, user_id, author_name, content, is_approved) 
       VALUES (?, ?, ?, ?, 1)"
    );
    return $stmt->execute([
      $data['post_id'],
      $data['user_id'],
      $data['author_name'],
      $data['content']
    ]);
  }

  public static function getAllComments() {
    $stmt = self::pdo()->prepare(
      "SELECT c.id, c.content, c.author_name, c.created_at, p.title as post_title, u.username 
       FROM comments c
       JOIN posts p ON c.post_id = p.id
       LEFT JOIN users u ON c.user_id = u.id
       ORDER BY c.created_at DESC"
    );
    $stmt->execute();
    return $stmt->fetchAll();
  }

  public static function deleteComment($id) {
    $stmt = self::pdo()->prepare("DELETE FROM comments WHERE id = ?");
    return $stmt->execute([$id]);
  }
}
