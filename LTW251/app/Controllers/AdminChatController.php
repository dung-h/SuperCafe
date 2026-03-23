<?php
require_once __DIR__ . '/BaseController.php';

class AdminChatController extends BaseController {
    public function index() {
        $this->requireAdmin();
        return $this->renderAdmin('admin/chat', [], 'Hỗ trợ trực tuyến');
    }

    public function poll() {
        $this->requireAdmin();
        $response = $this->requestOpenClaw('/admin/handoff', 'GET');
        if (!$response['ok']) {
            return $this->jsonResponse(502, ['ok' => false, 'error' => (string)$response['error']]);
        }
        return $this->jsonResponse(200, $response['data']);
    }

    public function reply() {
        $this->requireAdmin();

        $data = $this->readJsonBody();
        $channel = trim((string)($data['channel'] ?? ''));
        $userId = trim((string)($data['userId'] ?? ''));
        $message = trim((string)($data['message'] ?? ''));
        $ui = isset($data['ui']) && is_array($data['ui']) ? $data['ui'] : null;

        if ($channel === '' || $userId === '' || $message === '') {
            return $this->jsonResponse(400, ['ok' => false, 'error' => 'Thiếu dữ liệu gửi tin nhắn.']);
        }
        if (mb_strlen($message) > 2000) {
            return $this->jsonResponse(400, ['ok' => false, 'error' => 'Tin nhắn quá dài (tối đa 2000 ký tự).']);
        }

        $payload = [
            'channel' => $channel,
            'userId' => $userId,
            'message' => $message,
        ];
        if ($ui) {
            $payload['ui'] = $ui;
        }

        $response = $this->requestOpenClaw('/admin/handoff/reply', 'POST', $payload);
        if (!$response['ok']) {
            return $this->jsonResponse(502, ['ok' => false, 'error' => (string)$response['error']]);
        }
        return $this->jsonResponse(200, $response['data']);
    }

    public function autoReply() {
        $this->requireAdmin();

        $data = $this->readJsonBody();
        $channel = trim((string)($data['channel'] ?? ''));
        $userId = trim((string)($data['userId'] ?? ''));
        $actionPayload = trim((string)($data['actionPayload'] ?? ''));
        $hintMessage = trim((string)($data['message'] ?? ''));

        if ($channel === '' || $userId === '' || $actionPayload === '') {
            return $this->jsonResponse(400, ['ok' => false, 'error' => 'Thiếu dữ liệu auto-reply.']);
        }

        $autoRequest = [
            'channel' => $channel,
            'userId' => $userId,
            'message' => $hintMessage !== '' ? $hintMessage : $actionPayload,
            'actionPayload' => $actionPayload,
            'adminBypassHandoff' => true,
            'correlationId' => 'admin-auto-' . substr(sha1(uniqid('', true)), 0, 16),
            'clientContext' => ['locale' => 'vi-VN', 'sourceMessageId' => 'admin-auto-action'],
        ];
        $autoResponse = $this->requestOpenClaw('/chat', 'POST', $autoRequest);
        if (!$autoResponse['ok']) {
            return $this->jsonResponse(502, ['ok' => false, 'error' => (string)$autoResponse['error']]);
        }

        $decoded = is_array($autoResponse['data'] ?? null) ? $autoResponse['data'] : [];
        $chatData = is_array($decoded['data'] ?? null) ? $decoded['data'] : [];
        $replyText = trim((string)($chatData['reply'] ?? ''));
        if ($replyText === '') {
            return $this->jsonResponse(502, ['ok' => false, 'error' => 'Không lấy được nội dung trả lời tự động.']);
        }

        $forwardPayload = [
            'channel' => $channel,
            'userId' => $userId,
            'message' => $replyText,
        ];
        if (isset($chatData['ui']) && is_array($chatData['ui'])) {
            $forwardPayload['ui'] = $chatData['ui'];
        }

        $forwardResponse = $this->requestOpenClaw('/admin/handoff/reply', 'POST', $forwardPayload);
        if (!$forwardResponse['ok']) {
            return $this->jsonResponse(502, ['ok' => false, 'error' => (string)$forwardResponse['error']]);
        }

        return $this->jsonResponse(200, [
            'ok' => true,
            'data' => [
                'reply' => $replyText,
                'ui' => isset($chatData['ui']) && is_array($chatData['ui']) ? $chatData['ui'] : null,
            ],
        ]);
    }

    public function deleteMessage() {
        $this->requireAdmin();

        $data = $this->readJsonBody();
        $channel = trim((string)($data['channel'] ?? ''));
        $userId = trim((string)($data['userId'] ?? ''));
        $messageId = trim((string)($data['messageId'] ?? ''));

        if ($channel === '' || $userId === '' || $messageId === '') {
            return $this->jsonResponse(400, ['ok' => false, 'error' => 'Thiếu dữ liệu xóa tin nhắn.']);
        }

        $response = $this->requestOpenClaw('/admin/handoff/message/delete', 'POST', [
            'channel' => $channel,
            'userId' => $userId,
            'messageId' => $messageId,
        ]);
        if (!$response['ok']) {
            return $this->jsonResponse(502, ['ok' => false, 'error' => (string)$response['error']]);
        }

        return $this->jsonResponse(200, ['ok' => true]);
    }

    public function deleteSession() {
        $this->requireAdmin();

        $data = $this->readJsonBody();
        $channel = trim((string)($data['channel'] ?? ''));
        $userId = trim((string)($data['userId'] ?? ''));

        if ($channel === '' || $userId === '') {
            return $this->jsonResponse(400, ['ok' => false, 'error' => 'Thiếu phiên cần xóa.']);
        }

        $response = $this->requestOpenClaw('/admin/handoff/session/delete', 'POST', [
            'channel' => $channel,
            'userId' => $userId,
            'deleteContext' => true,
        ]);
        if (!$response['ok']) {
            return $this->jsonResponse(502, ['ok' => false, 'error' => (string)$response['error']]);
        }

        return $this->jsonResponse(200, ['ok' => true]);
    }

    public function endSession() {
        $this->requireAdmin();

        $data = $this->readJsonBody();
        $channel = trim((string)($data['channel'] ?? ''));
        $userId = trim((string)($data['userId'] ?? ''));

        if ($channel === '' || $userId === '') {
            return $this->jsonResponse(400, ['ok' => false, 'error' => 'Thiếu phiên cần kết thúc.']);
        }

        $response = $this->requestOpenClaw('/chat', 'POST', [
            'channel' => $channel,
            'userId' => $userId,
            'message' => 'tiếp tục với bot',
            'actionPayload' => 'ACTION_HANDOFF_RESUME',
            'correlationId' => 'admin-resume-' . substr(sha1(uniqid('', true)), 0, 16),
            'clientContext' => ['locale' => 'vi-VN', 'sourceMessageId' => 'admin-panel'],
        ]);
        if (!$response['ok']) {
            return $this->jsonResponse(502, ['ok' => false, 'error' => (string)$response['error']]);
        }

        return $this->jsonResponse(200, ['ok' => true]);
    }

    private function readJsonBody() {
        $raw = file_get_contents('php://input');
        if (!$raw) {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function requestOpenClaw($path, $method = 'GET', $payload = null) {
        $method = strtoupper((string)$method);
        $url = rtrim((string)OPENCLAW_URL, '/') . '/' . ltrim((string)$path, '/');

        if (!function_exists('curl_init')) {
            return ['ok' => false, 'error' => 'Máy chủ chưa bật cURL.'];
        }

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);

        $headers = ['Content-Type: application/json'];
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            $json = json_encode($payload ?: [], JSON_UNESCAPED_UNICODE);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            $headers[] = 'Content-Length: ' . strlen((string)$json);
        }
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

        $body = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false || $curlError !== '') {
            return ['ok' => false, 'error' => 'Không kết nối được OpenClaw: ' . $curlError];
        }

        $decoded = json_decode((string)$body, true);
        if (!is_array($decoded)) {
            return ['ok' => false, 'error' => 'OpenClaw trả dữ liệu không hợp lệ.'];
        }

        if ($statusCode >= 400 || empty($decoded['ok'])) {
            $message = trim((string)($decoded['error'] ?? 'OpenClaw trả lỗi.'));
            return ['ok' => false, 'error' => $message !== '' ? $message : 'OpenClaw trả lỗi.'];
        }

        return ['ok' => true, 'data' => $decoded];
    }

    private function jsonResponse($statusCode, $payload) {
        http_response_code((int)$statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE);
        exit;
    }
}
