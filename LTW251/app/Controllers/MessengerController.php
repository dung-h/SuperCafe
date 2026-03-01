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
      return $this->plainResponse(200, $challenge !== '' ? $challenge : 'OK');
    }

    return $this->plainResponse(403, 'Forbidden');
  }

  private function handleWebhookEvent() {
    $raw = file_get_contents('php://input') ?: '';
    if ($raw === '') {
      return $this->jsonResponse(400, ['ok' => false, 'error' => 'Empty payload']);
    }

    if (!$this->verifySignature($raw)) {
      return $this->jsonResponse(403, ['ok' => false, 'error' => 'Invalid signature']);
    }

    $payload = json_decode($raw, true);
    if (!is_array($payload)) {
      return $this->jsonResponse(400, ['ok' => false, 'error' => 'Invalid JSON']);
    }

    if (($payload['object'] ?? '') !== 'page') {
      return $this->jsonResponse(200, ['ok' => true, 'ignored' => true]);
    }

    $entries = is_array($payload['entry'] ?? null) ? $payload['entry'] : [];
    foreach ($entries as $entry) {
      $events = is_array($entry['messaging'] ?? null) ? $entry['messaging'] : [];
      foreach ($events as $event) {
        $senderId = (string)($event['sender']['id'] ?? '');
        if ($senderId === '') {
          continue;
        }

        $messageText = trim((string)($event['message']['text'] ?? ''));
        if ($messageText === '') {
          continue;
        }

        $reply = $this->askOpenClaw($senderId, $messageText);
        if ($reply !== '') {
          $this->sendMessengerText($senderId, $reply);
        }
      }
    }

    return $this->jsonResponse(200, ['ok' => true]);
  }

  private function verifySignature($rawBody) {
    $appSecret = (string)MESSENGER_APP_SECRET;
    if ($appSecret === '') {
      // Dev fallback: allow unsigned payloads if app secret is not configured yet.
      return true;
    }

    $header = $this->headerValue('x-hub-signature-256');
    if ($header === '' || strpos($header, 'sha256=') !== 0) {
      return false;
    }

    $expected = 'sha256=' . hash_hmac('sha256', $rawBody, $appSecret);
    return hash_equals($expected, $header);
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
      return 'He thong tam ban, vui long thu lai sau.';
    }

    $decoded = $result['data'];
    if (!is_array($decoded) || empty($decoded['ok']) || !is_array($decoded['data'] ?? null)) {
      return 'He thong tam ban, vui long thu lai sau.';
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
    return $result['ok'];
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
      return ['ok' => false, 'error' => 'request_failed'];
    }

    $decoded = json_decode($response, true);
    if (!is_array($decoded)) {
      return ['ok' => true, 'data' => []];
    }
    return ['ok' => true, 'data' => $decoded];
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

