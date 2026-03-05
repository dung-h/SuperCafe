<?php
require_once __DIR__ . '/BaseController.php';

class MessengerController extends BaseController {
  public function webhook() {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
      return $this->verifyWebhook();
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      return $this->handleWebhookEvent();
    }
    return $this->plainResponse(405, 'Method Not Allowed');
  }

  private function verifyWebhook() {
    $mode = $this->queryValue(['hub.mode', 'hub_mode']);
    $token = $this->queryValue(['hub.verify_token', 'hub_verify_token']);
    $challenge = $this->queryValue(['hub.challenge', 'hub_challenge']);

    if ($mode === 'subscribe' && $token !== '' && hash_equals((string)MESSENGER_VERIFY_TOKEN, $token)) {
      error_log('[messenger] verify success ua=' . $this->requestUserAgent());
      return $this->plainResponse(200, $challenge !== '' ? $challenge : 'OK');
    }

    if ($mode !== '' || $token !== '' || $challenge !== '') {
      error_log('[messenger] verify failed mode=' . $mode . ' ua=' . $this->requestUserAgent());
    }
    return $this->plainResponse(403, 'Forbidden');
  }

  private function handleWebhookEvent() {
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
      return $this->jsonResponse(400, ['ok' => false, 'error' => 'Empty payload']);
    }

    $signature = $this->headerValue('x-hub-signature-256');
    if (!$this->verifySignature($raw)) {
      error_log(
        '[messenger] invalid signature ip=' . $this->requestIp() .
        ' ua=' . $this->requestUserAgent() .
        ' hasSig=' . ($signature !== '' ? '1' : '0')
      );
      return $this->jsonResponse(403, ['ok' => false, 'error' => 'Invalid signature']);
    }

    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
      return $this->jsonResponse(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }

    if (($payload['object'] ?? '') !== 'page') {
      error_log('[messenger] ignored non-page object ua=' . $this->requestUserAgent());
      return $this->jsonResponse(200, ['ok' => true, 'ignored' => true]);
    }

    $entries = is_array($payload['entry'] ?? null) ? $payload['entry'] : [];
    $processed = 0;
    $ignored = 0;
    $duplicates = 0;
    $sendFailed = 0;

    foreach ($entries as $entry) {
      $events = is_array($entry['messaging'] ?? null) ? $entry['messaging'] : [];
      foreach ($events as $event) {
        $senderId = (string)($event['sender']['id'] ?? '');
        if ($senderId === '') {
          $ignored++;
          continue;
        }

        $rateLimit = $this->isSenderRateLimited($senderId);
        if (!empty($rateLimit['limited'])) {
          $ignored++;
          error_log('[messenger] sender rate limited sender=' . $senderId . ' retryAfter=' . (string)($rateLimit['retryAfterSec'] ?? 0));
          continue;
        }

        if (!empty($event['message']['is_echo'])) {
          $ignored++;
          continue;
        }

        $eventId = $this->resolveEventId($event, $senderId);
        if ($eventId !== '' && $this->isDuplicateEvent($eventId)) {
          $duplicates++;
          continue;
        }

        $incoming = $this->extractIncomingMessage($event);
        $messageText = trim((string)($incoming['messageText'] ?? ''));
        $actionPayload = trim((string)($incoming['actionPayload'] ?? ''));
        if ($messageText === '' && $actionPayload === '') {
          $ignored++;
          continue;
        }
        if ($messageText === '' && $actionPayload !== '') {
          $messageText = $actionPayload;
        }

        // Async UX: Push to Redis Message Queue instead of blocking the webhook
        try {
            $redis = new \Predis\Client([
                'scheme' => 'tcp',
                'host'   => REDIS_HOST,
                'port'   => REDIS_PORT,
            ]);
            $job = [
                'senderId' => $senderId,
                'messageText' => $messageText,
                'actionPayload' => $actionPayload,
                'sourceMessageId' => $eventId !== '' ? $eventId : ('msg-' . substr(sha1($senderId . '|' . (string)($event['timestamp'] ?? '')), 0, 12)),
            ];
            $redis->rpush('messenger_webhook_jobs', json_encode($job));
            $processed++;
        } catch (\Exception $e) {
            error_log('[messenger] redis push error: ' . $e->getMessage());
            $sendFailed++;
        }
      }
    }

    if ($sendFailed > 0) {
      error_log('[messenger] reply send failed for ' . (string)$sendFailed . ' event(s)');
    }

    error_log(
      '[messenger] webhook processed ip=' . $this->requestIp() .
      ' ua=' . $this->requestUserAgent() .
      ' entries=' . (string)count($entries) .
      ' processed=' . (string)$processed .
      ' ignored=' . (string)$ignored .
      ' duplicates=' . (string)$duplicates .
      ' sendFailed=' . (string)$sendFailed
    );

    return $this->jsonResponse(200, [
      'ok' => true,
      'processed' => $processed,
      'ignored' => $ignored,
      'duplicates' => $duplicates,
      'sendFailed' => $sendFailed
    ]);
  }

  private function verifySignature($rawBody) {
    $appSecret = (string)MESSENGER_APP_SECRET;
    if ($appSecret === '') {
      // In development, allow unsigned payloads for local testing only.
      return defined('APP_DEBUG') ? (bool)APP_DEBUG : false;
    }

    $header = $this->headerValue('x-hub-signature-256');
    if ($header === '' || strpos($header, 'sha256=') !== 0) {
      return false;
    }

    $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $appSecret);
    return hash_equals($expected, $header);
  }

  private function extractIncomingMessage($event) {
    $actionPayload = '';
    $quickPayload = trim((string)($event['message']['quick_reply']['payload'] ?? ''));
    if ($quickPayload !== '') {
      $actionPayload = $quickPayload;
    }

    $messageText = trim((string)($event['message']['text'] ?? ''));
    $postbackPayload = trim((string)($event['postback']['payload'] ?? ''));
    if ($postbackPayload !== '') {
      $actionPayload = $postbackPayload;
    }

    $postbackTitle = trim((string)($event['postback']['title'] ?? ''));
    if ($messageText === '' && $postbackTitle !== '') {
      $messageText = $postbackTitle;
    }

    return [
      'messageText' => $messageText,
      'actionPayload' => $actionPayload,
    ];
  }

  private function resolveEventId($event, $senderId) {
    $mid = trim((string)($event['message']['mid'] ?? ''));
    if ($mid !== '') {
      return $mid;
    }

    $timestamp = trim((string)($event['timestamp'] ?? ''));
    if ($timestamp === '') {
      return '';
    }

    $recipientId = trim((string)($event['recipient']['id'] ?? ''));
    return sha1($senderId . '|' . $recipientId . '|' . $timestamp . '|' . json_encode($event));
  }

  private function isDuplicateEvent($eventId) {
    if ($eventId === '') {
      return false;
    }

    try {
      $pdo = DB::pdo();
      if (random_int(1, 100) === 1) {
        $this->cleanupOldWebhookEvents($pdo);
      }

      $stmt = $pdo->prepare('INSERT INTO messenger_webhook_events (event_id) VALUES (?)');
      $stmt->execute([$eventId]);
      return false;
    } catch (PDOException $e) {
      $message = strtolower((string)$e->getMessage());
      $code = (string)$e->getCode();
      if ($code === '23000' || strpos($message, '1062') !== false || strpos($message, 'duplicate') !== false) {
        return true;
      }
      error_log('[messenger] dedupe insert failed: ' . (string)$e->getMessage());
      return false;
    } catch (Throwable $e) {
      error_log('[messenger] dedupe exception: ' . (string)$e->getMessage());
      return false;
    }
  }

  private function cleanupOldWebhookEvents($pdo) {
    try {
      $pdo->exec("DELETE FROM messenger_webhook_events WHERE created_at < (NOW() - INTERVAL 2 DAY)");
    } catch (Throwable $e) {
      error_log('[messenger] dedupe cleanup failed: ' . (string)$e->getMessage());
    }
  }

  private function isSenderRateLimited($senderId) {
    $windowSec = max(1, (int)MESSENGER_WEBHOOK_RATE_LIMIT_WINDOW_SEC);
    $maxRequests = max(1, (int)MESSENGER_WEBHOOK_RATE_LIMIT_MAX);
    $key = 'messenger:webhook:rl:' . sha1((string)$senderId);

    try {
      $redis = new \Predis\Client([
        'scheme' => 'tcp',
        'host' => REDIS_HOST,
        'port' => REDIS_PORT,
        'read_write_timeout' => 1,
      ]);
      $count = (int)$redis->incr($key);
      if ($count === 1) {
        $redis->expire($key, $windowSec);
      }

      if ($count <= $maxRequests) {
        return ['limited' => false, 'retryAfterSec' => 0];
      }

      $ttl = (int)$redis->ttl($key);
      return ['limited' => true, 'retryAfterSec' => max(1, $ttl)];
    } catch (\Throwable $e) {
      error_log('[messenger] rate limiter unavailable: ' . $e->getMessage());
      return ['limited' => false, 'retryAfterSec' => 0];
    }
  }

  private function askOpenClaw($senderId, $message) {
    $request = [
      'userId' => 'messenger-' . $senderId,
      'message' => $message,
      'channel' => 'messenger',
      'correlationId' => 'msgr-' . substr(sha1(uniqid('', true)), 0, 16),
    ];

    $result = $this->postJson(OPENCLAW_URL . '/chat', $request, OPENCLAW_TIMEOUT_MS);
    if (!$result['ok']) {
      error_log('[messenger] openclaw call failed: status=' . (string)($result['status'] ?? 0) . ' error=' . (string)($result['error'] ?? 'unknown'));
      return 'Hệ thống tạm bận, vui lòng thử lại sau.';
    }

    $decoded = $result['data'];
    if (!is_array($decoded) || empty($decoded['ok']) || !is_array($decoded['data'] ?? null)) {
      error_log('[messenger] openclaw returned invalid payload');
      return 'Hệ thống tạm bận, vui lòng thử lại sau.';
    }

    $reply = trim((string)($decoded['data']['reply'] ?? ''));
    return $reply;
  }

  private function sendMessengerText($recipientId, $text) {
    $pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
    if ($pageToken === '') {
      return false;
    }

    $url = 'https://graph.facebook.com/' . rawurlencode((string)MESSENGER_GRAPH_VERSION) . '/me/messages?access_token=' . rawurlencode($pageToken);
    $payload = [
      'messaging_type' => 'RESPONSE',
      'recipient' => ['id' => $recipientId],
      'message' => ['text' => $text],
    ];

    $result = $this->postJson($url, $payload, 20000);
    if (!$result['ok']) {
      $errorMessage = '';
      if (is_array($result['data']) && isset($result['data']['error']['message'])) {
        $errorMessage = (string)$result['data']['error']['message'];
      } else {
        $errorMessage = (string)($result['error'] ?? 'unknown_error');
      }
      error_log('[messenger] send api failed: status=' . (string)($result['status'] ?? 0) . ' error=' . $errorMessage);
      return false;
    }
    return true;
  }

  private function sendMessengerAction($recipientId, $action) {
    $pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
    if ($pageToken === '') {
      return false;
    }

    $url = 'https://graph.facebook.com/' . rawurlencode((string)MESSENGER_GRAPH_VERSION) . '/me/messages?access_token=' . rawurlencode($pageToken);
    $payload = [
      'recipient' => ['id' => $recipientId],
      'sender_action' => $action,
    ];

    $result = $this->postJson($url, $payload, 5000); // short timeout for UX
    if (!$result['ok']) {
      error_log('[messenger] send action failed: ' . (string)($result['error'] ?? 'unknown'));
      return false;
    }
    return true;
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
    $statusCode = $this->extractHttpStatus($http_response_header ?? []);
    if ($response === false && function_exists('curl_init')) {
      $ch = curl_init($url);
      curl_setopt($ch, CURLOPT_POST, true);
      curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
      curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
      curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
      curl_setopt($ch, CURLOPT_TIMEOUT, max(1, (int)ceil($timeoutMs / 1000)));
      $response = curl_exec($ch);
      $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
      curl_close($ch);
    }

    if ($response === false) {
      return ['ok' => false, 'status' => $statusCode, 'error' => 'request_failed'];
    }

    $decoded = json_decode($response, true);
    $okStatus = $statusCode >= 200 && $statusCode < 300;
    if (!is_array($decoded)) {
      return ['ok' => $okStatus, 'status' => $statusCode, 'data' => []];
    }
    return ['ok' => $okStatus, 'status' => $statusCode, 'data' => $decoded];
  }

  private function extractHttpStatus($headers) {
    if (!is_array($headers)) {
      return 0;
    }
    foreach ($headers as $line) {
      if (preg_match('/^HTTP\/\S+\s+(\d{3})/', (string)$line, $matches)) {
        return (int)$matches[1];
      }
    }
    return 0;
  }

  private function queryValue($keys) {
    foreach ($keys as $key) {
      if (isset($_GET[$key])) {
        return trim((string)$_GET[$key]);
      }
    }
    return '';
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

  private function requestIp() {
    $ip = trim((string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    if ($ip !== '') {
      $parts = explode(',', $ip);
      return trim((string)$parts[0]);
    }
    return trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
  }

  private function requestUserAgent() {
    return trim((string)($_SERVER['HTTP_USER_AGENT'] ?? '-'));
  }

  private function plainResponse($statusCode, $text) {
    http_response_code((int)$statusCode);
    header('Content-Type: text/plain; charset=utf-8');
    echo (string)$text;
    return '';
  }

  private function jsonResponse($statusCode, $payload) {
    http_response_code((int)$statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    return '';
  }
}
