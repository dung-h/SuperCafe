<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class BotBridgeController extends BaseController {
  public function catalogList() {
    if (!$this->requireBridgeApiKey()) {
      return '';
    }

    $payload = $this->readJsonBody();
    $query = trim((string)($payload['query'] ?? ''));
    $category = strtolower(trim((string)($payload['category'] ?? '')));
    $page = max(1, (int)($payload['page'] ?? 1));
    $limit = max(1, min(50, (int)($payload['limit'] ?? 12)));
    $offset = ($page - 1) * $limit;

    $pdo = DB::pdo();
    $where = [];
    $params = [];

    if ($query !== '') {
      $where[] = '(p.sku LIKE ? OR p.name LIKE ? OR p.short_desc LIKE ? OR p.description LIKE ?)';
      $like = '%' . $query . '%';
      $params[] = $like;
      $params[] = $like;
      $params[] = $like;
      $params[] = $like;
    }

    $categorySql = $this->categoryFilterSql($category);
    if ($categorySql['clause'] !== '') {
      $where[] = $categorySql['clause'];
      foreach ($categorySql['params'] as $value) {
        $params[] = $value;
      }
    }

    $whereSql = empty($where) ? '' : ('WHERE ' . implode(' AND ', $where));

    $countSql = "
      SELECT COUNT(*) AS c
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      $whereSql
    ";
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($params);
    $total = (int)($stmtCount->fetch()['c'] ?? 0);

    $sql = "
      SELECT p.id, p.sku, p.name, p.price, p.stock_qty, p.short_desc, p.description, p.image, c.slug AS category_slug, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      $whereSql
      ORDER BY p.id DESC
      LIMIT " . (int)$limit . " OFFSET " . (int)$offset;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $items = [];
    foreach ($rows as $row) {
      $items[] = $this->mapProductRow($row);
    }

    $this->jsonResponse(200, [
      'ok' => true,
      'data' => [
        'items' => $items,
        'page' => $page,
        'limit' => $limit,
        'total' => $total
      ]
    ]);
    return '';
  }

  public function catalogGet() {
    if (!$this->requireBridgeApiKey()) {
      return '';
    }

    $payload = $this->readJsonBody();
    $skuOrId = trim((string)($payload['sku_or_id'] ?? ''));
    if ($skuOrId === '') {
      $this->jsonResponse(400, ['ok' => false, 'error' => 'sku_or_id is required']);
      return '';
    }

    $pdo = DB::pdo();
    $sql = "
      SELECT p.id, p.sku, p.name, p.price, p.stock_qty, p.short_desc, p.description, p.image, c.slug AS category_slug, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.sku = ? OR p.id = ?
      LIMIT 1
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$skuOrId, (int)$skuOrId]);
    $row = $stmt->fetch();

    $this->jsonResponse(200, [
      'ok' => true,
      'data' => $row ? $this->mapProductRow($row) : null
    ]);
    return '';
  }

  public function orderCreate() {
    if (!$this->requireBridgeApiKey()) {
      return '';
    }

    $payload = $this->readJsonBody();
    $customer = is_array($payload['customer'] ?? null) ? $payload['customer'] : [];
    $itemsInput = is_array($payload['items'] ?? null) ? $payload['items'] : [];
    $paymentMethod = strtolower(trim((string)($payload['payment_method'] ?? 'bank_transfer')));
    $note = trim((string)($payload['note'] ?? ''));
    $rawIdempotencyKey = trim((string)($payload['idempotency_key'] ?? ''));

    $customerTelegramId = trim((string)($customer['telegramId'] ?? ''));
    $customerName = trim((string)($customer['name'] ?? ''));
    $customerPhone = trim((string)($customer['phone'] ?? ''));
    $customerAddress = trim((string)($customer['address'] ?? ''));

    if ($customerTelegramId === '' || $customerName === '' || $customerPhone === '' || $customerAddress === '') {
      $this->jsonResponse(400, ['ok' => false, 'error' => 'Invalid customer payload']);
      return '';
    }

    if ($paymentMethod !== 'cod') {
      $paymentMethod = 'bank_transfer';
    }

    $idempotencyKey = $this->sanitizeIdempotencyKey($rawIdempotencyKey);
    if ($rawIdempotencyKey !== '' && $idempotencyKey === '') {
      $this->jsonResponse(400, ['ok' => false, 'error' => 'Invalid idempotency_key']);
      return '';
    }

    $requestHash = $idempotencyKey !== ''
      ? $this->buildOrderRequestHash($customerTelegramId, $customerName, $customerPhone, $customerAddress, $itemsInput, $paymentMethod, $note)
      : '';

    if (empty($itemsInput)) {
      $this->jsonResponse(400, ['ok' => false, 'error' => 'Order must contain at least one item']);
      return '';
    }

    $deliveryEstimate = $this->estimateDeliveryByAddress($customerAddress);

    $pdo = DB::pdo();
    try {
      $pdo->beginTransaction();

      if ($idempotencyKey !== '') {
        $stmt = $pdo->prepare("SELECT idempotency_key, request_hash, order_code FROM bot_order_idempotency WHERE idempotency_key = ? LIMIT 1 FOR UPDATE");
        $stmt->execute([$idempotencyKey]);
        $locked = $stmt->fetch();

        if ($locked) {
          $existingHash = trim((string)($locked['request_hash'] ?? ''));
          if ($existingHash !== '' && !hash_equals($existingHash, $requestHash)) {
            $pdo->rollBack();
            $this->jsonResponse(409, ['ok' => false, 'error' => 'Idempotency key conflict']);
            return '';
          }

          $existingOrderCode = strtoupper(trim((string)($locked['order_code'] ?? '')));
          if ($existingOrderCode !== '') {
            $existingOrder = $this->getBotOrderByCode($pdo, $existingOrderCode);
            $pdo->commit();
            $this->jsonResponse(200, ['ok' => true, 'data' => $existingOrder]);
            return '';
          }
        } else {
          $stmt = $pdo->prepare("
            INSERT INTO bot_order_idempotency (idempotency_key, chat_user_id, request_hash, order_code, response_json)
            VALUES (?, ?, ?, NULL, NULL)
          ");
          $stmt->execute([$idempotencyKey, $customerTelegramId, $requestHash]);
        }
      }

      $orderCode = $this->nextOrderCode($pdo);
      $subtotal = 0;
      $shipping = (int)$deliveryEstimate['shippingVnd'];
      $items = [];

      $selectProduct = $pdo->prepare("SELECT id, sku, name, price, stock_qty FROM products WHERE sku = ? LIMIT 1 FOR UPDATE");
      $updateStock = $pdo->prepare("UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?");
      $insertOrderItem = $pdo->prepare("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");

      foreach ($itemsInput as $item) {
        $sku = strtoupper(trim((string)($item['sku'] ?? '')));
        $qty = (int)($item['qty'] ?? 0);
        if ($sku === '' || $qty <= 0) {
          throw new Exception('Invalid item payload');
        }

        $selectProduct->execute([$sku]);
        $product = $selectProduct->fetch();
        if (!$product) {
          throw new Exception('Product not found: ' . $sku);
        }

        $stockQty = (int)$product['stock_qty'];
        if ($stockQty < $qty) {
          throw new Exception('Insufficient stock for ' . $sku);
        }

        $unitPrice = (int)round((float)$product['price']);
        $subtotal += ($unitPrice * $qty);
        $items[] = [
          'sku' => $product['sku'],
          'qty' => $qty,
          'unitPriceVnd' => $unitPrice,
          'productName' => $product['name']
        ];

        $updateStock->execute([$qty, (int)$product['id']]);
      }

      $total = $subtotal + $shipping;
      $webStatus = $paymentMethod === 'bank_transfer' ? 'pending' : 'pending';
      $botStatus = $paymentMethod === 'bank_transfer' ? 'awaiting_payment' : 'new';

      $email = $this->safeBotEmail($customerTelegramId);
      $stmtOrder = $pdo->prepare("
        INSERT INTO orders (user_id, customer_name, customer_email, customer_phone, customer_address, total_amount, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      ");
      $stmtOrder->execute([null, $customerName, $email, $customerPhone, $customerAddress, $total, $webStatus]);
      $orderId = (int)$pdo->lastInsertId();

      foreach ($items as $item) {
        $stmtProduct = $pdo->prepare("SELECT id FROM products WHERE sku = ? LIMIT 1");
        $stmtProduct->execute([$item['sku']]);
        $productRow = $stmtProduct->fetch();
        if (!$productRow) {
          throw new Exception('Product not found while saving order_items');
        }
        $insertOrderItem->execute([$orderId, (int)$productRow['id'], (int)$item['qty'], (int)$item['unitPriceVnd']]);
      }

      $stmtBotOrder = $pdo->prepare("
        INSERT INTO bot_orders (
          order_code, order_id, chat_user_id, customer_name, customer_phone, customer_address,
          items_json, subtotal_vnd, shipping_vnd, total_vnd, payment_method, payment_ref, note, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
      ");
      $stmtBotOrder->execute([
        $orderCode,
        $orderId,
        $customerTelegramId,
        $customerName,
        $customerPhone,
        $customerAddress,
        json_encode($items, JSON_UNESCAPED_UNICODE),
        $subtotal,
        $shipping,
        $total,
        $paymentMethod,
        ($note !== '' ? $note : null),
        $botStatus
      ]);

      if ($idempotencyKey !== '') {
        $orderForReplay = $this->getBotOrderByCode($pdo, $orderCode);
        $stmt = $pdo->prepare("
          UPDATE bot_order_idempotency
          SET order_code = ?, response_json = ?, updated_at = NOW()
          WHERE idempotency_key = ?
        ");
        $stmt->execute([
          $orderCode,
          $orderForReplay ? json_encode($orderForReplay, JSON_UNESCAPED_UNICODE) : null,
          $idempotencyKey,
        ]);
      }

      $pdo->commit();

      $order = $this->getBotOrderByCode($pdo, $orderCode);
      $this->jsonResponse(200, ['ok' => true, 'data' => $order]);
      return '';
    } catch (Exception $e) {
      if ($pdo->inTransaction()) {
        $pdo->rollBack();
      }
      $this->jsonResponse(400, ['ok' => false, 'error' => $e->getMessage()]);
      return '';
    }
  }

  public function orderGet() {
    if (!$this->requireBridgeApiKey()) {
      return '';
    }

    $payload = $this->readJsonBody();
    $orderCode = strtoupper(trim((string)($payload['order_code'] ?? '')));
    if ($orderCode === '') {
      $this->jsonResponse(400, ['ok' => false, 'error' => 'order_code is required']);
      return '';
    }

    $pdo = DB::pdo();
    $data = $this->getBotOrderByCode($pdo, $orderCode);
    $this->jsonResponse(200, ['ok' => true, 'data' => $data]);
    return '';
  }

  public function faqAnswer() {
    if (!$this->requireBridgeApiKey()) {
      return '';
    }

    $payload = $this->readJsonBody();
    $question = trim((string)($payload['question'] ?? ''));
    $productSku = strtoupper(trim((string)($payload['product_sku'] ?? '')));
    if ($question === '') {
      $this->jsonResponse(400, ['ok' => false, 'error' => 'question is required']);
      return '';
    }

    $pdo = DB::pdo();
    $normalizedQuestion = $this->normalizeText($question);
    $contactAnswer = $this->resolveContactAnswer($pdo, $normalizedQuestion);
    if ($contactAnswer) {
      $this->jsonResponse(200, [
        'ok' => true,
        'data' => $contactAnswer
      ]);
      return '';
    }

    if ($productSku !== '') {
      $stmt = $pdo->prepare("SELECT name, short_desc, description FROM products WHERE sku = ? LIMIT 1");
      $stmt->execute([$productSku]);
      $product = $stmt->fetch();
      if ($product) {
        $answer = trim((string)($product['description'] ?? ''));
        if ($answer === '') {
          $answer = trim((string)($product['short_desc'] ?? ''));
        }
        if ($answer !== '') {
          $this->jsonResponse(200, [
            'ok' => true,
            'data' => [
              'answer' => $answer,
              'sourceQuestion' => 'Thong tin san pham ' . $product['name']
            ]
          ]);
          return '';
        }
      }
    }

    $faq = null;
    $stmtFaq = $pdo->prepare("SELECT question, answer FROM faqs WHERE is_public = 1 AND (question LIKE ? OR answer LIKE ?) ORDER BY position ASC, id DESC LIMIT 1");
    $like = '%' . $question . '%';
    $stmtFaq->execute([$like, $like]);
    $faq = $stmtFaq->fetch();

    if (!$faq) {
      $faq = $this->findBestFaqByKeyword($pdo, $normalizedQuestion);
    }

    if ($faq) {
      $this->jsonResponse(200, [
        'ok' => true,
        'data' => [
          'answer' => $faq['answer'],
          'sourceQuestion' => $faq['question']
        ]
      ]);
      return '';
    }

    $this->jsonResponse(200, ['ok' => true, 'data' => null]);
    return '';
  }

  private function resolveContactAnswer($pdo, $normalizedQuestion) {
    if ($normalizedQuestion === '') {
      return null;
    }

    $stmt = $pdo->prepare("SELECT address, phone, email, opening_hours FROM contact_settings WHERE id = 1 LIMIT 1");
    $stmt->execute();
    $contact = $stmt->fetch();
    if (!$contact) {
      return null;
    }

    $address = trim((string)($contact['address'] ?? ''));
    $phone = trim((string)($contact['phone'] ?? ''));
    $email = trim((string)($contact['email'] ?? ''));
    $hours = trim((string)($contact['opening_hours'] ?? ''));

    if ($this->containsAnyTerm($normalizedQuestion, ['gio mo cua', 'mo cua', 'dong cua', 'thoi gian mo cua', 'opening hour'])) {
      return [
        'answer' => $hours !== '' ? ('Giờ mở cửa hiện tại: ' . $hours . '.') : 'Hiện chưa có thông tin giờ mở cửa cụ thể.',
        'sourceQuestion' => 'Thong tin gio mo cua cua quan'
      ];
    }

    if ($this->containsAnyTerm($normalizedQuestion, ['dia chi', 'o dau', 'vi tri', 'duong nao'])) {
      return [
        'answer' => $address !== '' ? ('Địa chỉ quán: ' . $address . '.') : 'Hiện chưa có thông tin địa chỉ.',
        'sourceQuestion' => 'Thong tin dia chi cua quan'
      ];
    }

    if ($this->containsAnyTerm($normalizedQuestion, ['so dien thoai', 'sdt', 'hotline', 'phone'])) {
      return [
        'answer' => $phone !== '' ? ('Số điện thoại liên hệ: ' . $phone . '.') : 'Hiện chưa có số điện thoại liên hệ.',
        'sourceQuestion' => 'Thong tin so dien thoai cua quan'
      ];
    }

    if ($this->containsAnyTerm($normalizedQuestion, ['email'])) {
      return [
        'answer' => $email !== '' ? ('Email liên hệ: ' . $email . '.') : 'Hiện chưa có email liên hệ.',
        'sourceQuestion' => 'Thong tin email cua quan'
      ];
    }

    if ($this->containsAnyTerm($normalizedQuestion, ['lien he', 'contact', 'hotline'])) {
      return [
        'answer' => 'Thông tin liên hệ của quán:' .
          ($address !== '' ? ("\n- Địa chỉ: " . $address) : '') .
          ($phone !== '' ? ("\n- Điện thoại: " . $phone) : '') .
          ($email !== '' ? ("\n- Email: " . $email) : '') .
          ($hours !== '' ? ("\n- Giờ mở cửa: " . $hours) : ''),
        'sourceQuestion' => 'Thong tin lien he cua quan'
      ];
    }

    return null;
  }

  private function findBestFaqByKeyword($pdo, $normalizedQuestion) {
    $tokens = $this->extractMeaningfulTokens($normalizedQuestion);
    if (empty($tokens)) {
      return null;
    }

    $stmt = $pdo->prepare("SELECT question, answer FROM faqs WHERE is_public = 1 ORDER BY position ASC, id DESC LIMIT 250");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    if (!is_array($rows) || empty($rows)) {
      return null;
    }

    $bestScore = 0;
    $bestRow = null;
    foreach ($rows as $row) {
      $questionNorm = $this->normalizeText((string)($row['question'] ?? ''));
      $answerNorm = $this->normalizeText((string)($row['answer'] ?? ''));
      $haystack = $questionNorm . ' ' . $answerNorm;
      $score = 0;
      foreach ($tokens as $token) {
        if ($token === '') {
          continue;
        }
        if (preg_match('/(?:^|\s)' . preg_quote($token, '/') . '(?:$|\s)/', $questionNorm)) {
          $score += 3;
          continue;
        }
        if (preg_match('/(?:^|\s)' . preg_quote($token, '/') . '(?:$|\s)/', $answerNorm)) {
          $score += 2;
          continue;
        }
        if (strpos($haystack, $token) !== false) {
          $score += 1;
        }
      }

      if ($score > $bestScore) {
        $bestScore = $score;
        $bestRow = $row;
      }
    }

    return $bestScore > 0 ? $bestRow : null;
  }

  private function normalizeText($text) {
    $lower = mb_strtolower((string)$text, 'UTF-8');
    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $lower);
    $normalized = $ascii !== false ? strtolower((string)$ascii) : strtolower((string)$lower);
    $normalized = preg_replace('/[^a-z0-9\\s]/', ' ', $normalized);
    $normalized = preg_replace('/\\s+/', ' ', trim((string)$normalized));
    return $normalized;
  }

  private function containsAnyTerm($source, $terms) {
    foreach ($terms as $term) {
      $termNorm = $this->normalizeText((string)$term);
      if ($termNorm !== '' && strpos((string)$source, $termNorm) !== false) {
        return true;
      }
    }
    return false;
  }

  private function extractMeaningfulTokens($normalizedQuestion) {
    $stopWords = [
      'la', 'co', 'cho', 'minh', 'toi', 'shop', 'quan', 'bot', 'va', 'voi', 'nhu', 'the', 'nao',
      'gi', 'khong', 'duoc', 'khach', 'nhe', 'nha', 'oi', 'a', 'e', 'em', 'anh', 'chi',
      'mot', 'hai', 'ba', 'bon', 'tu', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi'
    ];
    $stopSet = array_flip($stopWords);
    $parts = preg_split('/\\s+/', (string)$normalizedQuestion);
    if (!is_array($parts)) {
      return [];
    }
    $tokens = [];
    foreach ($parts as $part) {
      $token = trim((string)$part);
      if ($token === '' || strlen($token) < 3) {
        continue;
      }
      if (isset($stopSet[$token])) {
        continue;
      }
      $tokens[] = $token;
    }
    return array_values(array_unique($tokens));
  }

  private function readJsonBody() {
    $raw = file_get_contents('php://input');
    if (!$raw) {
      return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
  }

  private function jsonResponse($statusCode, $payload) {
    http_response_code((int)$statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
  }

  private function requireBridgeApiKey() {
    $incoming = $this->headerValue('x-api-key');
    if (!$incoming || $incoming !== BOT_BRIDGE_API_KEY) {
      $this->jsonResponse(401, ['ok' => false, 'error' => 'Unauthorized API key']);
      return false;
    }
    return true;
  }

  private function headerValue($name) {
    $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    if (!empty($_SERVER[$serverKey])) {
      return trim((string)$_SERVER[$serverKey]);
    }
    if (function_exists('getallheaders')) {
      $headers = getallheaders();
      foreach ($headers as $key => $value) {
        if (strtolower($key) === strtolower($name)) {
          return trim((string)$value);
        }
      }
    }
    return '';
  }

  private function mapProductRow($row) {
    $description = trim((string)($row['description'] ?? ''));
    if ($description === '') {
      $description = trim((string)($row['short_desc'] ?? ''));
    }

    return [
      'id' => (string)$row['id'],
      'sku' => (string)$row['sku'],
      'name' => (string)$row['name'],
      'category' => $this->toBotCategory((string)($row['category_slug'] ?? ''), (string)($row['category_name'] ?? ''), (string)$row['name']),
      'imageUrl' => (string)($row['image'] ?? ''),
      'priceVnd' => (int)round((float)$row['price']),
      'stockQty' => max(0, (int)$row['stock_qty']),
      'description' => $description
    ];
  }

  private function toBotCategory($slug, $name, $productName) {
    $text = strtolower($slug . ' ' . $name . ' ' . $productName);
    if (strpos($text, 'ca-phe') !== false || strpos($text, 'coffee') !== false) {
      return 'coffee';
    }
    if (strpos($text, 'tra-sua') !== false || strpos($text, 'milk') !== false) {
      return 'milk_tea';
    }
    if (strpos($text, 'tra-trai-cay') !== false || strpos($text, 'tra') !== false) {
      return 'fruit_tea';
    }
    if (strpos($text, 'nuoc-ep') !== false || strpos($text, 'juice') !== false) {
      return 'juice';
    }
    return 'other';
  }

  private function categoryFilterSql($category) {
    if ($category === '') {
      return ['clause' => '', 'params' => []];
    }

    if ($category === 'coffee') {
      return ['clause' => '(c.slug = ? OR c.name LIKE ?)', 'params' => ['ca-phe', '%Cà phê%']];
    }
    if ($category === 'milk_tea') {
      return ['clause' => '(c.slug = ? OR c.name LIKE ?)', 'params' => ['tra-sua', '%Trà sữa%']];
    }
    if ($category === 'fruit_tea') {
      return ['clause' => '(c.slug = ? OR c.name LIKE ?)', 'params' => ['tra-trai-cay', '%Trà%']];
    }
    if ($category === 'juice') {
      return ['clause' => '(c.slug = ? OR c.name LIKE ?)', 'params' => ['nuoc-ep', '%Nước ép%']];
    }
    if ($category === 'other') {
      return ['clause' => '(c.slug IS NULL OR c.slug NOT IN (?, ?, ?, ?))', 'params' => ['ca-phe', 'tra-sua', 'tra-trai-cay', 'nuoc-ep']];
    }
    return ['clause' => '', 'params' => []];
  }

  private function nextOrderCode($pdo) {
    $datePart = date('Ymd');
    $prefix = 'ORD-' . $datePart . '-';
    $stmt = $pdo->prepare('SELECT COUNT(*) AS c FROM bot_orders WHERE order_code LIKE ?');
    $stmt->execute([$prefix . '%']);
    $count = (int)($stmt->fetch()['c'] ?? 0);
    return $prefix . str_pad((string)($count + 1), 4, '0', STR_PAD_LEFT);
  }

  private function safeBotEmail($chatUserId) {
    // Bot order flow currently does not collect customer email.
    // Keep this blank instead of generating synthetic guest emails.
    return '';
  }

  private function sanitizeIdempotencyKey($value) {
    $normalized = trim((string)$value);
    if ($normalized === '') {
      return '';
    }
    if (strlen($normalized) > 96) {
      return '';
    }
    if (!preg_match('/^[A-Za-z0-9:_\\-\\.]+$/', $normalized)) {
      return '';
    }
    return $normalized;
  }

  private function buildOrderRequestHash($customerTelegramId, $customerName, $customerPhone, $customerAddress, $itemsInput, $paymentMethod, $note) {
    $normalizedItems = [];
    foreach ((array)$itemsInput as $item) {
      $sku = strtoupper(trim((string)($item['sku'] ?? '')));
      $qty = (int)($item['qty'] ?? 0);
      if ($sku === '' || $qty <= 0) {
        continue;
      }
      $normalizedItems[] = [
        'sku' => $sku,
        'qty' => $qty
      ];
    }
    usort($normalizedItems, function ($a, $b) {
      if ($a['sku'] === $b['sku']) {
        return $a['qty'] <=> $b['qty'];
      }
      return strcmp((string)$a['sku'], (string)$b['sku']);
    });

    $payload = [
      'customerTelegramId' => trim((string)$customerTelegramId),
      'name' => trim((string)$customerName),
      'phone' => trim((string)$customerPhone),
      'address' => trim((string)$customerAddress),
      'paymentMethod' => trim((string)$paymentMethod),
      'note' => trim((string)$note),
      'items' => $normalizedItems
    ];
    return hash('sha256', json_encode($payload, JSON_UNESCAPED_UNICODE));
  }

  private function getBotOrderByCode($pdo, $orderCode) {
    $stmt = $pdo->prepare("SELECT * FROM bot_orders WHERE order_code = ? LIMIT 1");
    $stmt->execute([$orderCode]);
    $row = $stmt->fetch();
    if (!$row) {
      return null;
    }

    $items = json_decode((string)$row['items_json'], true);
    if (!is_array($items)) {
      $items = [];
    }
    $deliveryEstimate = $this->estimateDeliveryByAddress((string)$row['customer_address']);

    return [
      'id' => (string)$row['id'],
      'orderCode' => (string)$row['order_code'],
      'customerTelegramId' => (string)$row['chat_user_id'],
      'customerName' => (string)$row['customer_name'],
      'customerPhone' => (string)$row['customer_phone'],
      'customerAddress' => (string)$row['customer_address'],
      'items' => $items,
      'subtotalVnd' => (int)$row['subtotal_vnd'],
      'shippingVnd' => (int)$row['shipping_vnd'],
      'estimatedDeliveryMinutes' => (int)$deliveryEstimate['estimatedDeliveryMinutes'],
      'deliveryDistanceKm' => $deliveryEstimate['deliveryDistanceKm'],
      'totalVnd' => (int)$row['total_vnd'],
      'paymentMethod' => (string)$row['payment_method'],
      'paymentRef' => $row['payment_ref'],
      'note' => $row['note'],
      'status' => (string)$row['status'],
      'stockReleased' => false,
      'createdAt' => (string)$row['created_at'],
      'updatedAt' => (string)$row['updated_at']
    ];
  }

  private function estimateDeliveryByAddress($address) {
    $addressText = trim((string)$address);
    $fallbackShipping = max(0, (int)BOT_DEFAULT_SHIPPING_VND);
    $fallbackEta = max(10, (int)BOT_DELIVERY_FALLBACK_ETA_MINUTES);

    $coords = $this->extractLatLngFromText($addressText);
    if (!$coords) {
      return [
        'shippingVnd' => $fallbackShipping,
        'estimatedDeliveryMinutes' => $fallbackEta,
        'deliveryDistanceKm' => null
      ];
    }

    $distanceKm = $this->haversineKm((float)BOT_SHOP_LAT, (float)BOT_SHOP_LNG, (float)$coords['lat'], (float)$coords['lng']);
    $roundedDistance = round($distanceKm, 2);
    $nearFee = max(10000, (int)round($fallbackShipping * 0.5));
    $standardFee = max(15000, (int)round($fallbackShipping * 0.83));
    $farBase = max(35000, $fallbackShipping);

    if ($distanceKm <= 2) {
      $shipping = $nearFee;
    } elseif ($distanceKm <= 5) {
      $shipping = $standardFee;
    } else {
      $shipping = $farBase + ((int)ceil($distanceKm - 5) * 3000);
    }

    $baseEta = max(5, (int)BOT_DELIVERY_BASE_ETA_MINUTES);
    $perKmEta = max(1, (int)BOT_DELIVERY_PER_KM_ETA_MINUTES);
    $eta = min(120, $baseEta + (int)ceil($distanceKm * $perKmEta));
    if ($eta < $baseEta) {
      $eta = $baseEta;
    }

    return [
      'shippingVnd' => (int)$shipping,
      'estimatedDeliveryMinutes' => (int)$eta,
      'deliveryDistanceKm' => $roundedDistance
    ];
  }

  private function extractLatLngFromText($input) {
    $value = trim((string)$input);
    if ($value === '') {
      return null;
    }

    $decoded = rawurldecode($value);
    $sources = [$value, $decoded];

    foreach ($sources as $source) {
      if (preg_match('/@\\s*(-?\\d{1,2}(?:\\.\\d+)?)\\s*,\\s*(-?\\d{1,3}(?:\\.\\d+)?)/', $source, $matches)) {
        $point = $this->parseLatLngMatch($matches[1], $matches[2]);
        if ($point) {
          return $point;
        }
      }

      if (preg_match('/[?&](?:q|query|ll)=\\s*(-?\\d{1,2}(?:\\.\\d+)?)\\s*,\\s*(-?\\d{1,3}(?:\\.\\d+)?)/i', $source, $matches)) {
        $point = $this->parseLatLngMatch($matches[1], $matches[2]);
        if ($point) {
          return $point;
        }
      }

      if (preg_match('/!3d\\s*(-?\\d{1,2}(?:\\.\\d+)?)!4d\\s*(-?\\d{1,3}(?:\\.\\d+)?)/i', $source, $matches)) {
        $point = $this->parseLatLngMatch($matches[1], $matches[2]);
        if ($point) {
          return $point;
        }
      }

      if (preg_match('/geo:\\s*(-?\\d{1,2}(?:\\.\\d+)?)\\s*,\\s*(-?\\d{1,3}(?:\\.\\d+)?)/i', $source, $matches)) {
        $point = $this->parseLatLngMatch($matches[1], $matches[2]);
        if ($point) {
          return $point;
        }
      }
    }

    return null;
  }

  private function parseLatLngMatch($latRaw, $lngRaw) {
    $lat = (float)$latRaw;
    $lng = (float)$lngRaw;
    if (!is_finite($lat) || !is_finite($lng)) {
      return null;
    }
    if ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
      return null;
    }
    return ['lat' => $lat, 'lng' => $lng];
  }

  private function haversineKm($lat1, $lng1, $lat2, $lng2) {
    $earthRadiusKm = 6371.0;
    $toRad = function ($deg) {
      return $deg * M_PI / 180.0;
    };

    $dLat = $toRad($lat2 - $lat1);
    $dLng = $toRad($lng2 - $lng1);
    $a = sin($dLat / 2) * sin($dLat / 2)
      + cos($toRad($lat1)) * cos($toRad($lat2)) * sin($dLng / 2) * sin($dLng / 2);
    $c = 2 * atan2(sqrt($a), sqrt(1 - $a));
    return $earthRadiusKm * $c;
  }
}
