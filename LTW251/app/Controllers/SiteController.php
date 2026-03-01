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

  public function chatbot() {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
      return $this->jsonResponse(405, ['ok' => false, 'error' => 'Method Not Allowed']);
    }

    $payload = $this->readJsonBody();
    $message = trim((string)($payload['message'] ?? ''));
    if ($message === '') {
      return $this->jsonResponse(400, ['ok' => false, 'error' => 'message is required']);
    }

    $currentUser = $this->currentUser();
    $userId = !empty($currentUser['id'])
      ? ('web-user-' . (string)$currentUser['id'])
      : ('web-guest-' . session_id());

    $profile = [
      'name' => !empty($currentUser['full_name']) ? (string)$currentUser['full_name'] : null,
      'phone' => !empty($currentUser['phone']) ? (string)$currentUser['phone'] : null,
      'address' => null
    ];

    $request = [
      'userId' => $userId,
      'message' => $message,
      'channel' => 'web',
      'correlationId' => 'web-' . substr(sha1(uniqid('', true)), 0, 16),
      'profile' => $profile
    ];

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

  private function jsonResponse($statusCode, $payload) {
    http_response_code((int)$statusCode);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    return '';
  }
}
