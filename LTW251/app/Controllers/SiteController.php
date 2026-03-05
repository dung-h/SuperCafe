<?php
require_once __DIR__ . '/BaseController.php';
require_once __DIR__ . '/../Models/DB.php';

class SiteController extends BaseController {
  public function contact() {
    $message = null;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      $name = trim($_POST['name'] ?? '');
      $email = trim($_POST['email'] ?? '');
      $msg = trim($_POST['message'] ?? '');
      if ($name && filter_var($email, FILTER_VALIDATE_EMAIL) && $msg) {
        $pdo = DB::pdo();
        $stmt = $pdo->prepare('INSERT INTO contacts(name,email,message) VALUES(?,?,?)');
        $stmt->execute([$name, $email, $msg]);
        $message = 'Da gui lien he!';
      } else {
        $message = 'Vui long dien day du thong tin hop le.';
      }
    }
    return $this->render('site/contact', compact('message'), 'Lien he');
  }

  public function orderReview() {
    $itemsRaw = trim((string)($_GET['items'] ?? ''));
    $postedItemsRaw = trim((string)($_POST['items'] ?? ''));
    if ($postedItemsRaw !== '') {
      $itemsRaw = $postedItemsRaw;
    }
    $requestedItems = $this->parseOrderReviewItems($itemsRaw);

    $channelHint = strtolower(trim((string)($_REQUEST['ch'] ?? '')));
    $uidHint = trim((string)($_REQUEST['uid'] ?? ''));
    $extToken = trim((string)($_REQUEST['ext'] ?? ''));
    $recipientHints = $this->parseOrderReviewRecipientHints($_REQUEST);
    $identity = $this->resolveOrderReviewIdentity($channelHint, $uidHint, $extToken);

    if (!is_array($identity)) {
      $identity = $this->restoreOrderReviewIdentity();
    }
    if (!is_array($identity) && !empty($requestedItems)) {
      $identity = $this->inferIdentityFromItems($requestedItems);
    }
    if (is_array($identity)) {
      $this->rememberOrderReviewIdentity($identity);
      if ($channelHint === '') {
        $channelHint = (string)$identity['channel'];
      }
      if ($uidHint === '') {
        $uidHint = (string)$identity['nativeUserId'];
      }
    }

    $snapshot = null;
    if (is_array($identity)) {
      $snapshot = $this->loadDialogueSnapshot((string)$identity['channel'], (string)$identity['userId']);
    }

    if (empty($requestedItems)) {
      $requestedItems = $this->itemsFromDialogueSnapshot($snapshot);
      if (!empty($requestedItems)) {
        $itemsRaw = implode(',', array_map(function ($item) {
          return (string)$item['sku'] . ':' . (string)$item['qty'];
        }, $requestedItems));
      }
    }

    $productsBySku = [];
    if (!empty($requestedItems)) {
      $pdo = DB::pdo();
      $skus = array_map(function ($item) {
        return $item['sku'];
      }, $requestedItems);
      $placeholders = implode(',', array_fill(0, count($skus), '?'));

      $stmt = $pdo->prepare("
        SELECT p.sku, p.name, p.price, p.image, p.short_desc, p.description, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.sku IN ($placeholders)
      ");
      $stmt->execute($skus);
      $rows = $stmt->fetchAll();
      foreach ($rows as $row) {
        $sku = strtoupper(trim((string)($row['sku'] ?? '')));
        if ($sku === '') {
          continue;
        }
        $productsBySku[$sku] = $row;
      }
    }

    $reviewItems = [];
    $missingSkus = [];
    $subtotalVnd = 0;

    foreach ($requestedItems as $item) {
      $sku = $item['sku'];
      $qty = (int)$item['qty'];
      $product = $productsBySku[$sku] ?? null;
      if (!$product) {
        $missingSkus[] = $sku;
        continue;
      }

      $unitPrice = (int)round((float)($product['price'] ?? 0));
      $lineTotal = $unitPrice * $qty;
      $subtotalVnd += $lineTotal;
      $description = trim((string)($product['short_desc'] ?? ''));
      if ($description === '') {
        $description = trim((string)($product['description'] ?? ''));
      }

      $reviewItems[] = [
        'sku' => $sku,
        'qty' => $qty,
        'name' => trim((string)($product['name'] ?? '')),
        'category' => trim((string)($product['category_name'] ?? '')),
        'image' => trim((string)($product['image'] ?? '')),
        'description' => $description,
        'unitPriceVnd' => $unitPrice,
        'lineTotalVnd' => $lineTotal,
      ];
    }

    $recipient = $this->recipientFromDialogueSnapshot($snapshot);
    $recipient = $this->mergeRecipientWithHints($recipient, $recipientHints);
    $editForm = [
      'name' => (string)$recipient['name'],
      'phone' => (string)$recipient['phone'],
      'address' => (string)$recipient['address'],
      'paymentMethod' => (string)$recipient['paymentMethod'],
    ];
    $editResult = null;
    $confirmResult = null;
    $postAction = (string)($_POST['action'] ?? '');
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $postAction === 'update_recipient') {
      $editForm = [
        'name' => trim((string)($_POST['recipient_name'] ?? '')),
        'phone' => trim((string)($_POST['recipient_phone'] ?? '')),
        'address' => trim((string)($_POST['recipient_address'] ?? '')),
        'paymentMethod' => trim((string)($_POST['recipient_payment'] ?? '')),
      ];
      $editResult = $this->updateRecipientFromReview($identity, $editForm);
      if (!empty($editResult['ok']) && is_array($identity)) {
        $snapshot = $this->loadDialogueSnapshot((string)$identity['channel'], (string)$identity['userId']);
        $recipient = $this->mergeRecipientWithHints($this->recipientFromDialogueSnapshot($snapshot), $recipientHints);
        $editForm = [
          'name' => (string)$recipient['name'],
          'phone' => (string)$recipient['phone'],
          'address' => (string)$recipient['address'],
          'paymentMethod' => (string)$recipient['paymentMethod'],
        ];
      }
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $postAction === 'confirm') {
      $confirmResult = $this->confirmOrderFromReview($identity, $recipient);
      if (!empty($confirmResult['ok']) && is_array($identity)) {
        $snapshot = $this->loadDialogueSnapshot((string)$identity['channel'], (string)$identity['userId']);
        $recipient = $this->mergeRecipientWithHints($this->recipientFromDialogueSnapshot($snapshot), $recipientHints);
      }
    }

    $hasInput = $itemsRaw !== '';
    $canConfirm = !empty($reviewItems) && empty($recipient['missingFields']) && is_array($identity);
    $identityView = is_array($identity)
      ? [
          'channel' => (string)$identity['channel'],
          'nativeUserIdMasked' => $this->maskUserId((string)$identity['nativeUserId']),
          'source' => (string)($identity['source'] ?? 'direct'),
        ]
      : null;

    return $this->render(
      'site/order_review',
      compact(
        'hasInput',
        'itemsRaw',
        'reviewItems',
        'missingSkus',
        'subtotalVnd',
        'recipient',
        'editForm',
        'editResult',
        'confirmResult',
        'canConfirm',
        'identityView',
        'channelHint',
        'uidHint',
        'extToken'
      ),
      'Kiem tra don hang',
    );
  }

  public function chatbot() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
      return $this->jsonResponse(405, ['ok' => false, 'error' => 'Method Not Allowed']);
    }

    $payload = $this->readJsonBody();
    $message = trim((string)($payload['message'] ?? ''));
    $actionPayload = trim((string)($payload['actionPayload'] ?? ''));
    $externalSessionToken = trim((string)($payload['externalSessionToken'] ?? ''));
    if ($message === '' && $actionPayload === '') {
      return $this->jsonResponse(400, ['ok' => false, 'error' => 'message or actionPayload is required']);
    }

    $currentUser = $this->currentUser();
    $profile = [
      'name' => !empty($currentUser['full_name']) ? (string)$currentUser['full_name'] : '',
      'phone' => !empty($currentUser['phone']) ? (string)$currentUser['phone'] : '',
      'address' => ''
    ];
    $userId = !empty($currentUser['id'])
      ? ('web-user-' . (string)$currentUser['id'])
      : ('web-guest-' . session_id());

    $externalIdentity = $this->verifyExternalSessionToken($externalSessionToken);
    if (is_array($externalIdentity) && !empty($externalIdentity['uid']) && empty($currentUser['id'])) {
      $userId = 'web-tg-' . (string)$externalIdentity['uid'];
      if ($profile['name'] === '' && !empty($externalIdentity['name'])) {
        $profile['name'] = (string)$externalIdentity['name'];
      }
    }

    $request = [
      'userId' => $userId,
      'message' => $message,
      'channel' => 'web',
      'correlationId' => 'web-' . substr(sha1(uniqid('', true)), 0, 16),
      'clientContext' => [
        'locale' => 'vi-VN'
      ],
      'profile' => $profile
    ];
    if ($actionPayload !== '') {
      $request['actionPayload'] = $actionPayload;
    }

    $result = $this->postJson(OPENCLAW_URL . '/chat', $request, OPENCLAW_TIMEOUT_MS);
    if (!$result['ok']) {
      return $this->jsonResponse(502, ['ok' => false, 'error' => $result['error']]);
    }

    $data = $result['data'];
    if (!is_array($data) || empty($data['ok'])) {
      return $this->jsonResponse(502, ['ok' => false, 'error' => 'Invalid response from openclaw']);
    }

    return $this->jsonResponse(200, $data);
  }

  private function readJsonBody() {
    $raw = file_get_contents('php://input');
    if (!$raw) {
      return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
  }

  private function postJson($url, $body, $timeoutMs) {
    $json = json_encode($body, JSON_UNESCAPED_UNICODE);
    $headers = [
      'Content-Type: application/json',
      'Content-Length: ' . strlen((string)$json)
    ];
    $context = stream_context_create([
      'http' => [
        'method' => 'POST',
        'header' => implode("\r\n", $headers),
        'content' => $json,
        'timeout' => max(1, (int)ceil($timeoutMs / 1000))
      ]
    ]);

    $response = @file_get_contents($url, false, $context);
    if ($response === false && function_exists('curl_init')) {
      $ch = curl_init($url);
      curl_setopt($ch, CURLOPT_POST, true);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
      curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
      curl_setopt($ch, CURLOPT_TIMEOUT, max(1, (int)ceil($timeoutMs / 1000)));
      $response = curl_exec($ch);
      curl_close($ch);
    }
    if ($response === false) {
      return ['ok' => false, 'error' => 'Unable to reach openclaw'];
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
      return ['ok' => false, 'error' => 'Invalid JSON from openclaw'];
    }

    return ['ok' => true, 'data' => $decoded];
  }

  private function verifyExternalSessionToken($token) {
    $raw = trim((string)$token);
    $secret = trim((string)EXTERNAL_SESSION_SECRET);
    if ($raw === '' || $secret === '') {
      return null;
    }

    $parts = explode('.', $raw, 2);
    if (count($parts) !== 2) {
      return null;
    }

    $payloadEncoded = trim((string)$parts[0]);
    $sigProvided = trim((string)$parts[1]);
    if ($payloadEncoded === '' || $sigProvided === '') {
      return null;
    }

    $sigExpected = rtrim(strtr(base64_encode(hash_hmac('sha256', $payloadEncoded, $secret, true)), '+/', '-_'), '=');
    if (!hash_equals($sigExpected, $sigProvided)) {
      return null;
    }

    $payloadBase64 = strtr($payloadEncoded, '-_', '+/');
    $mod = strlen($payloadBase64) % 4;
    if ($mod > 0) {
      $payloadBase64 .= str_repeat('=', 4 - $mod);
    }
    $payloadJson = base64_decode($payloadBase64, true);
    if ($payloadJson === false || $payloadJson === '') {
      return null;
    }

    $payload = json_decode($payloadJson, true);
    if (!is_array($payload)) {
      return null;
    }

    $source = trim((string)($payload['src'] ?? ''));
    $uid = trim((string)($payload['uid'] ?? ''));
    $exp = (int)($payload['exp'] ?? 0);
    $now = time();

    if ($source !== 'telegram' || $uid === '' || $exp <= $now) {
      return null;
    }

    return [
      'src' => 'telegram',
      'uid' => $uid,
      'name' => trim((string)($payload['name'] ?? '')),
      'username' => trim((string)($payload['username'] ?? '')),
      'exp' => $exp,
    ];
  }

  private function parseOrderReviewItems($raw) {
    $source = strtoupper(trim((string)$raw));
    if ($source === '') {
      return [];
    }

    $chunks = explode(',', $source);
    $acc = [];
    foreach ($chunks as $chunk) {
      if (count($acc) >= 20) {
        break;
      }
      $part = trim((string)$chunk);
      if (!preg_match('/^([A-Z0-9_-]{2,40}):([1-9][0-9]{0,2})$/', $part, $m)) {
        continue;
      }
      $sku = $m[1];
      $qty = (int)$m[2];
      if (!isset($acc[$sku])) {
        $acc[$sku] = 0;
      }
      $acc[$sku] += $qty;
      if ($acc[$sku] > 999) {
        $acc[$sku] = 999;
      }
    }

    $out = [];
    foreach ($acc as $sku => $qty) {
      $out[] = ['sku' => $sku, 'qty' => $qty];
    }
    return $out;
  }

  private function resolveOrderReviewIdentity($channelHint, $uidHint, $extToken) {
    $channel = in_array($channelHint, ['messenger', 'telegram', 'web'], true) ? $channelHint : '';
    $uid = trim((string)$uidHint);

    if ($channel === 'messenger' && $uid !== '' && preg_match('/^[0-9]{4,32}$/', $uid)) {
      return [
        'channel' => 'messenger',
        'userId' => 'messenger-' . $uid,
        'nativeUserId' => $uid,
        'source' => 'direct',
      ];
    }

    if ($channel === 'telegram' && $uid !== '' && preg_match('/^[0-9]{3,32}$/', $uid)) {
      return [
        'channel' => 'telegram',
        'userId' => $uid,
        'nativeUserId' => $uid,
        'source' => 'direct',
      ];
    }

    if ($channel === 'web') {
      $currentUser = $this->currentUser();
      if (!empty($currentUser['id'])) {
        $native = (string)$currentUser['id'];
        return [
          'channel' => 'web',
          'userId' => 'web-user-' . $native,
          'nativeUserId' => $native,
          'source' => 'direct',
        ];
      }

      $externalIdentity = $this->verifyExternalSessionToken($extToken);
      if (is_array($externalIdentity) && !empty($externalIdentity['uid'])) {
        $native = (string)$externalIdentity['uid'];
        return [
          'channel' => 'web',
          'userId' => 'web-tg-' . $native,
          'nativeUserId' => $native,
          'source' => 'direct',
        ];
      }

      if (session_id() !== '') {
        return [
          'channel' => 'web',
          'userId' => 'web-guest-' . session_id(),
          'nativeUserId' => session_id(),
          'source' => 'direct',
        ];
      }
    }

    return null;
  }

  private function rememberOrderReviewIdentity($identity) {
    if (!is_array($identity)) {
      return;
    }
    $_SESSION['order_review_identity'] = [
      'channel' => (string)($identity['channel'] ?? ''),
      'userId' => (string)($identity['userId'] ?? ''),
      'nativeUserId' => (string)($identity['nativeUserId'] ?? ''),
      'savedAt' => time(),
    ];
  }

  private function restoreOrderReviewIdentity() {
    $raw = $_SESSION['order_review_identity'] ?? null;
    if (!is_array($raw)) {
      return null;
    }
    $savedAt = (int)($raw['savedAt'] ?? 0);
    if ($savedAt <= 0 || (time() - $savedAt) > 24 * 3600) {
      return null;
    }
    $channel = trim((string)($raw['channel'] ?? ''));
    $userId = trim((string)($raw['userId'] ?? ''));
    $native = trim((string)($raw['nativeUserId'] ?? ''));
    if ($channel === '' || $userId === '' || $native === '') {
      return null;
    }
    return [
      'channel' => $channel,
      'userId' => $userId,
      'nativeUserId' => $native,
      'source' => 'restored',
    ];
  }

  private function inferIdentityFromItems($requestedItems) {
    if (!is_array($requestedItems) || empty($requestedItems)) {
      return null;
    }

    try {
      $pdo = DB::pdo();
      $stmt = $pdo->prepare("
        SELECT channel, user_id, context_json, updated_at
        FROM chat_dialogue_sessions
        WHERE expires_at > NOW()
          AND updated_at > (NOW() - INTERVAL 24 HOUR)
          AND state IN ('ORDER_COLLECT_NAME','ORDER_COLLECT_PHONE','ORDER_COLLECT_ADDRESS','ORDER_COLLECT_PAYMENT','ORDER_CONFIRM')
        ORDER BY updated_at DESC
        LIMIT 120
      ");
      $stmt->execute();
      $rows = $stmt->fetchAll();
    } catch (Throwable $e) {
      error_log('[orderReview] inferIdentityFromItems query failed: ' . (string)$e->getMessage());
      return null;
    }

    $target = $this->itemsToAssocMap($requestedItems);
    if (empty($target)) {
      return null;
    }

    $matched = [];
    foreach ($rows as $row) {
      $channel = trim((string)($row['channel'] ?? ''));
      $userId = trim((string)($row['user_id'] ?? ''));
      if ($channel === '' || $userId === '') {
        continue;
      }

      $context = json_decode((string)($row['context_json'] ?? ''), true);
      if (!is_array($context)) {
        continue;
      }
      $order = is_array($context['order'] ?? null) ? $context['order'] : [];
      $items = is_array($order['items'] ?? null) ? $order['items'] : [];
      $sessionItems = [];
      foreach ($items as $item) {
        $sku = strtoupper(trim((string)($item['sku'] ?? '')));
        $qty = (int)($item['qty'] ?? 0);
        if ($sku === '' || $qty <= 0) {
          continue;
        }
        $sessionItems[] = ['sku' => $sku, 'qty' => $qty];
      }
      $map = $this->itemsToAssocMap($sessionItems);
      if ($map !== $target) {
        continue;
      }

      $nativeUserId = $this->nativeUserIdFromComposite($channel, $userId);
      if ($nativeUserId === '') {
        continue;
      }

      $filled = 0;
      if (trim((string)($order['name'] ?? '')) !== '') $filled++;
      if (trim((string)($order['phone'] ?? '')) !== '') $filled++;
      if (trim((string)($order['address'] ?? '')) !== '') $filled++;
      if (trim((string)($order['paymentMethod'] ?? '')) !== '') $filled++;
      $updatedTs = strtotime((string)($row['updated_at'] ?? '')) ?: 0;

      $matched[] = [
        'channel' => $channel,
        'userId' => $userId,
        'nativeUserId' => $nativeUserId,
        'filled' => $filled,
        'updatedTs' => $updatedTs,
      ];
    }

    if (count($matched) === 0) {
      return null;
    }

    usort($matched, function ($a, $b) {
      $filledCmp = (int)($b['filled'] ?? 0) <=> (int)($a['filled'] ?? 0);
      if ($filledCmp !== 0) {
        return $filledCmp;
      }
      return (int)($b['updatedTs'] ?? 0) <=> (int)($a['updatedTs'] ?? 0);
    });

    $candidate = $matched[0];
    // Avoid ambiguous auto-bind when top 2 candidates are too close in confidence.
    if (count($matched) > 1) {
      $second = $matched[1];
      $sameFilled = (int)($second['filled'] ?? 0) === (int)($candidate['filled'] ?? 0);
      $timeGap = abs((int)($candidate['updatedTs'] ?? 0) - (int)($second['updatedTs'] ?? 0));
      if ($sameFilled && $timeGap <= 45) {
        return null;
      }
    }

    $candidate['source'] = 'inferred';
    unset($candidate['filled'], $candidate['updatedTs']);
    return $candidate;
  }

  private function itemsToAssocMap($items) {
    if (!is_array($items)) {
      return [];
    }
    $map = [];
    foreach ($items as $item) {
      $sku = strtoupper(trim((string)($item['sku'] ?? '')));
      $qty = (int)($item['qty'] ?? 0);
      if ($sku === '' || $qty <= 0) {
        continue;
      }
      $map[$sku] = $qty;
    }
    ksort($map);
    return $map;
  }

  private function nativeUserIdFromComposite($channel, $userId) {
    $ch = trim((string)$channel);
    $uid = trim((string)$userId);
    if ($ch === 'messenger' && strpos($uid, 'messenger-') === 0) {
      return substr($uid, strlen('messenger-'));
    }
    if ($ch === 'telegram') {
      return $uid;
    }
    if ($ch === 'web') {
      if (strpos($uid, 'web-user-') === 0) {
        return substr($uid, strlen('web-user-'));
      }
      if (strpos($uid, 'web-tg-') === 0) {
        return substr($uid, strlen('web-tg-'));
      }
      if (strpos($uid, 'web-guest-') === 0) {
        return substr($uid, strlen('web-guest-'));
      }
    }
    return '';
  }

  private function loadDialogueSnapshot($channel, $userId) {
    if ($channel === '' || $userId === '') {
      return null;
    }
    try {
      $pdo = DB::pdo();
      $stmt = $pdo->prepare("
        SELECT state, context_json, updated_at, expires_at
        FROM chat_dialogue_sessions
        WHERE channel = ? AND user_id = ?
        LIMIT 1
      ");
      $stmt->execute([$channel, $userId]);
      $row = $stmt->fetch();
      if (!$row) {
        return null;
      }

      $context = json_decode((string)($row['context_json'] ?? ''), true);
      if (!is_array($context)) {
        $context = [];
      }

      return [
        'state' => trim((string)($row['state'] ?? '')),
        'context' => $context,
        'updatedAt' => trim((string)($row['updated_at'] ?? '')),
        'expiresAt' => trim((string)($row['expires_at'] ?? '')),
      ];
    } catch (Throwable $e) {
      error_log('[orderReview] loadDialogueSnapshot failed: ' . (string)$e->getMessage());
      return null;
    }
  }

  private function itemsFromDialogueSnapshot($snapshot) {
    if (!is_array($snapshot) || !is_array($snapshot['context'] ?? null)) {
      return [];
    }
    $order = is_array($snapshot['context']['order'] ?? null) ? $snapshot['context']['order'] : [];
    $rawItems = is_array($order['items'] ?? null) ? $order['items'] : [];
    $acc = [];
    foreach ($rawItems as $item) {
      $sku = strtoupper(trim((string)($item['sku'] ?? '')));
      $qty = (int)($item['qty'] ?? 0);
      if ($sku === '' || $qty <= 0) {
        continue;
      }
      if (!isset($acc[$sku])) {
        $acc[$sku] = 0;
      }
      $acc[$sku] += $qty;
      if ($acc[$sku] > 999) {
        $acc[$sku] = 999;
      }
    }
    $out = [];
    foreach ($acc as $sku => $qty) {
      $out[] = ['sku' => $sku, 'qty' => $qty];
    }
    return $out;
  }

  private function recipientFromDialogueSnapshot($snapshot) {
    $data = [
      'name' => '',
      'phone' => '',
      'address' => '',
      'paymentMethod' => '',
      'state' => '',
      'missingFields' => [],
      'updatedAt' => '',
    ];

    if (!is_array($snapshot) || !is_array($snapshot['context'] ?? null)) {
      $data['missingFields'] = ['name', 'phone', 'address', 'paymentMethod'];
      return $data;
    }

    $data['state'] = trim((string)($snapshot['state'] ?? ''));
    $data['updatedAt'] = trim((string)($snapshot['updatedAt'] ?? ''));
    $order = is_array($snapshot['context']['order'] ?? null) ? $snapshot['context']['order'] : [];
    $data['name'] = trim((string)($order['name'] ?? ''));
    $data['phone'] = trim((string)($order['phone'] ?? ''));
    $data['address'] = trim((string)($order['address'] ?? ''));
    $data['paymentMethod'] = trim((string)($order['paymentMethod'] ?? ''));

    $missing = [];
    if ($data['name'] === '') $missing[] = 'name';
    if ($data['phone'] === '') $missing[] = 'phone';
    if ($data['address'] === '') $missing[] = 'address';
    if ($data['paymentMethod'] === '') $missing[] = 'paymentMethod';
    $data['missingFields'] = $missing;

    return $data;
  }

  private function parseOrderReviewRecipientHints($source) {
    if (!is_array($source)) {
      return ['name' => '', 'phone' => '', 'address' => '', 'paymentMethod' => ''];
    }

    $name = trim((string)($source['rn'] ?? ''));
    $phone = preg_replace('/\D+/', '', (string)($source['rp'] ?? ''));
    $address = trim((string)($source['ra'] ?? ''));
    $payment = strtolower(trim((string)($source['rm'] ?? '')));

    return [
      'name' => mb_substr($name, 0, 120),
      'phone' => substr((string)$phone, 0, 15),
      'address' => mb_substr($address, 0, 400),
      'paymentMethod' => in_array($payment, ['bank_transfer', 'cod'], true) ? $payment : '',
    ];
  }

  private function mergeRecipientWithHints($recipient, $hints) {
    $base = is_array($recipient) ? $recipient : [];
    $hintData = is_array($hints) ? $hints : [];

    $name = trim((string)($base['name'] ?? ''));
    $phone = trim((string)($base['phone'] ?? ''));
    $address = trim((string)($base['address'] ?? ''));
    $payment = trim((string)($base['paymentMethod'] ?? ''));

    if ($name === '' && !empty($hintData['name'])) {
      $name = trim((string)$hintData['name']);
    }
    if ($phone === '' && !empty($hintData['phone'])) {
      $phone = trim((string)$hintData['phone']);
    }
    if ($address === '' && !empty($hintData['address'])) {
      $address = trim((string)$hintData['address']);
    }
    if ($payment === '' && !empty($hintData['paymentMethod'])) {
      $payment = trim((string)$hintData['paymentMethod']);
    }

    $missing = [];
    if ($name === '') $missing[] = 'name';
    if ($phone === '') $missing[] = 'phone';
    if ($address === '') $missing[] = 'address';
    if ($payment === '') $missing[] = 'paymentMethod';

    $base['name'] = $name;
    $base['phone'] = $phone;
    $base['address'] = $address;
    $base['paymentMethod'] = $payment;
    $base['missingFields'] = $missing;

    return $base;
  }

  private function updateRecipientFromReview($identity, $fields) {
    if (!is_array($identity)) {
      return ['ok' => false, 'message' => 'Không xác định được phiên bot để lưu thông tin. Hãy mở lại link review từ nút trong bot mới nhất.'];
    }

    $name = trim((string)($fields['name'] ?? ''));
    $phone = trim((string)($fields['phone'] ?? ''));
    $address = trim((string)($fields['address'] ?? ''));
    $payment = trim((string)($fields['paymentMethod'] ?? ''));

    if ($name === '' && $phone === '' && $address === '' && $payment === '') {
      return ['ok' => false, 'message' => 'Bạn nhập ít nhất 1 trường để cập nhật.'];
    }

    $errors = [];
    $updated = [];
    if ($name !== '') {
      $result = $this->pushActionToOpenClaw($identity, 'ACTION_ORDER_SET_NAME:' . $name, 'Cập nhật tên người nhận');
      if ($this->actionStillMissing($result, 'name')) {
        $errors[] = $result['reply'] !== '' ? $result['reply'] : 'Tên người nhận chưa hợp lệ.';
      } elseif (!empty($result['ok'])) {
        $updated[] = 'tên';
      }
    }

    if ($phone !== '') {
      $result = $this->pushActionToOpenClaw($identity, 'ACTION_ORDER_SET_PHONE:' . $phone, 'Cập nhật số điện thoại');
      if ($this->actionStillMissing($result, 'phone')) {
        $errors[] = $result['reply'] !== '' ? $result['reply'] : 'Số điện thoại chưa hợp lệ.';
      } elseif (!empty($result['ok'])) {
        $updated[] = 'số điện thoại';
      }
    }

    if ($address !== '') {
      $result = $this->pushActionToOpenClaw($identity, 'ACTION_ORDER_SET_ADDRESS:' . $address, 'Cập nhật địa chỉ giao hàng');
      if ($this->actionStillMissing($result, 'address')) {
        $errors[] = $result['reply'] !== '' ? $result['reply'] : 'Địa chỉ chưa hợp lệ.';
      } elseif (!empty($result['ok'])) {
        $updated[] = 'địa chỉ';
      }
    }

    if ($payment !== '') {
      $normalizedPayment = strtolower($payment);
      if (!in_array($normalizedPayment, ['bank_transfer', 'cod'], true)) {
        $errors[] = 'Phương thức thanh toán chỉ nhận bank_transfer hoặc cod.';
      } else {
        $result = $this->pushActionToOpenClaw($identity, 'ACTION_ORDER_SET_PAYMENT:' . $normalizedPayment, 'Cập nhật thanh toán');
        if ($this->actionStillMissing($result, 'paymentMethod')) {
          $errors[] = $result['reply'] !== '' ? $result['reply'] : 'Phương thức thanh toán chưa hợp lệ.';
        } elseif (!empty($result['ok'])) {
          $updated[] = 'thanh toán';
        }
      }
    }

    if (!empty($errors)) {
      return ['ok' => false, 'message' => implode(' ', $errors)];
    }

    if (empty($updated)) {
      return ['ok' => false, 'message' => 'Không có trường nào được cập nhật.'];
    }

    return ['ok' => true, 'message' => 'Đã lưu: ' . implode(', ', $updated) . ' vào phiên bot.'];
  }

  private function pushActionToOpenClaw($identity, $actionPayload, $message) {
    if (!is_array($identity)) {
      return ['ok' => false, 'reply' => ''];
    }

    $request = [
      'userId' => (string)$identity['userId'],
      'message' => trim((string)$message),
      'actionPayload' => trim((string)$actionPayload),
      'channel' => (string)$identity['channel'],
      'correlationId' => 'review-upd-' . substr(sha1(uniqid('', true)), 0, 16),
      'clientContext' => [
        'locale' => 'vi-VN',
        'sourceMessageId' => 'web-review-update',
      ],
    ];

    $result = $this->postJson(OPENCLAW_URL . '/chat', $request, OPENCLAW_TIMEOUT_MS);
    if (!$result['ok']) {
      return ['ok' => false, 'reply' => 'Không gọi được OpenClaw.'];
    }

    $decoded = $result['data'];
    if (!is_array($decoded) || empty($decoded['ok']) || !is_array($decoded['data'] ?? null)) {
      return ['ok' => false, 'reply' => 'OpenClaw trả về dữ liệu không hợp lệ.'];
    }

    $data = (array)$decoded['data'];
    $reply = trim((string)($data['reply'] ?? ''));
    $state = is_array($data['state'] ?? null) ? $data['state'] : [];
    $missing = is_array($state['missingFields'] ?? null) ? $state['missingFields'] : [];

    return [
      'ok' => true,
      'reply' => $reply,
      'missingFields' => $missing,
    ];
  }

  private function actionStillMissing($result, $fieldName) {
    if (!is_array($result) || empty($result['ok'])) {
      return true;
    }
    $missing = is_array($result['missingFields'] ?? null) ? $result['missingFields'] : [];
    return in_array((string)$fieldName, $missing, true);
  }

  private function syncRecipientToDialogue($identity, $recipient) {
    if (!is_array($identity) || !is_array($recipient)) {
      return ['ok' => false, 'message' => 'Thiếu dữ liệu phiên bot để đồng bộ.'];
    }

    $errors = [];
    $name = trim((string)($recipient['name'] ?? ''));
    $phone = trim((string)($recipient['phone'] ?? ''));
    $address = trim((string)($recipient['address'] ?? ''));
    $payment = trim((string)($recipient['paymentMethod'] ?? ''));

    if ($name !== '') {
      $result = $this->pushActionToOpenClaw($identity, 'ACTION_ORDER_SET_NAME:' . $name, 'Đồng bộ tên người nhận trước khi xác nhận');
      if ($this->actionStillMissing($result, 'name')) {
        $errors[] = $result['reply'] !== '' ? $result['reply'] : 'Tên người nhận chưa hợp lệ.';
      }
    }

    if ($phone !== '') {
      $result = $this->pushActionToOpenClaw($identity, 'ACTION_ORDER_SET_PHONE:' . $phone, 'Đồng bộ số điện thoại trước khi xác nhận');
      if ($this->actionStillMissing($result, 'phone')) {
        $errors[] = $result['reply'] !== '' ? $result['reply'] : 'Số điện thoại chưa hợp lệ.';
      }
    }

    if ($address !== '') {
      $result = $this->pushActionToOpenClaw($identity, 'ACTION_ORDER_SET_ADDRESS:' . $address, 'Đồng bộ địa chỉ trước khi xác nhận');
      if ($this->actionStillMissing($result, 'address')) {
        $errors[] = $result['reply'] !== '' ? $result['reply'] : 'Địa chỉ giao hàng chưa hợp lệ.';
      }
    }

    if ($payment !== '') {
      $paymentNormalized = strtolower($payment);
      if (!in_array($paymentNormalized, ['bank_transfer', 'cod'], true)) {
        $errors[] = 'Phương thức thanh toán chưa hợp lệ.';
      } else {
        $result = $this->pushActionToOpenClaw($identity, 'ACTION_ORDER_SET_PAYMENT:' . $paymentNormalized, 'Đồng bộ phương thức thanh toán trước khi xác nhận');
        if ($this->actionStillMissing($result, 'paymentMethod')) {
          $errors[] = $result['reply'] !== '' ? $result['reply'] : 'Phương thức thanh toán chưa hợp lệ.';
        }
      }
    }

    if (!empty($errors)) {
      return ['ok' => false, 'message' => implode(' ', $errors)];
    }

    return ['ok' => true];
  }

  private function confirmOrderFromReview($identity, $recipient) {
    if (!is_array($identity)) {
      return ['ok' => false, 'message' => 'Không xác định được phiên bot để đồng bộ xác nhận đơn.'];
    }

    if (is_array($recipient) && !empty($recipient['missingFields'])) {
      return ['ok' => false, 'message' => 'Phiên bot còn thiếu thông tin nhận hàng, chưa thể xác nhận đơn ngay trên web.'];
    }

    $syncResult = $this->syncRecipientToDialogue($identity, is_array($recipient) ? $recipient : []);
    if (empty($syncResult['ok'])) {
      return ['ok' => false, 'message' => trim((string)($syncResult['message'] ?? 'Đồng bộ thông tin nhận hàng thất bại.'))];
    }

    $request = [
      'userId' => (string)$identity['userId'],
      'message' => 'Xác nhận đặt đơn từ trang web review',
      'actionPayload' => 'ACTION_ORDER_CONFIRM',
      'channel' => (string)$identity['channel'],
      'correlationId' => 'review-' . substr(sha1(uniqid('', true)), 0, 16),
      'clientContext' => [
        'locale' => 'vi-VN',
        'sourceMessageId' => 'web-review',
      ],
    ];
    if (!empty($recipient['name']) || !empty($recipient['phone']) || !empty($recipient['address'])) {
      $request['profile'] = [
        'name' => trim((string)($recipient['name'] ?? '')),
        'phone' => trim((string)($recipient['phone'] ?? '')),
        'address' => trim((string)($recipient['address'] ?? '')),
      ];
    }

    $result = $this->postJson(OPENCLAW_URL . '/chat', $request, OPENCLAW_TIMEOUT_MS);
    if (!$result['ok']) {
      return ['ok' => false, 'message' => 'Không thể kết nối OpenClaw để xác nhận đơn.'];
    }

    $decoded = $result['data'];
    if (!is_array($decoded) || empty($decoded['ok']) || !is_array($decoded['data'] ?? null)) {
      return ['ok' => false, 'message' => 'OpenClaw trả về dữ liệu không hợp lệ.'];
    }

    $reply = trim((string)($decoded['data']['reply'] ?? ''));
    if ($reply === '') {
      $reply = 'Đã gửi yêu cầu xác nhận đơn.';
    }

    if ((string)$identity['channel'] === 'messenger' && (string)$identity['nativeUserId'] !== '') {
      $this->sendMessengerText((string)$identity['nativeUserId'], $reply);
    }

    return ['ok' => true, 'message' => $reply];
  }

  private function sendMessengerText($recipientId, $text) {
    $recipient = trim((string)$recipientId);
    $message = trim((string)$text);
    if ($recipient === '' || $message === '' || (string)MESSENGER_PAGE_ACCESS_TOKEN === '') {
      return false;
    }

    $url = 'https://graph.facebook.com/' . rawurlencode((string)MESSENGER_GRAPH_VERSION) . '/me/messages?access_token=' . rawurlencode((string)MESSENGER_PAGE_ACCESS_TOKEN);
    $payload = [
      'messaging_type' => 'RESPONSE',
      'recipient' => ['id' => $recipient],
      'message' => ['text' => $message],
    ];
    $response = $this->postJson($url, $payload, 15000);
    return !empty($response['ok']);
  }

  private function maskUserId($userId) {
    $raw = trim((string)$userId);
    if ($raw === '') {
      return '';
    }
    if (strlen($raw) <= 6) {
      return str_repeat('*', max(1, strlen($raw) - 2)) . substr($raw, -2);
    }
    return substr($raw, 0, 3) . str_repeat('*', max(3, strlen($raw) - 5)) . substr($raw, -2);
  }

  private function jsonResponse($statusCode, $payload) {
    http_response_code((int)$statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    return '';
  }
}
