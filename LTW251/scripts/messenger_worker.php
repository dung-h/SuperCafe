<?php
// scripts/messenger_worker.php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../vendor/autoload.php';

function worker_log(string $message): void {
    $line = '[' . date('Y-m-d H:i:s') . '] [worker] ' . $message . PHP_EOL;
    file_put_contents('php://stderr', $line);
}

worker_log('Starting Messenger Worker');

class MessengerWorker {
    private $redis;

    public function __construct() {
        $this->redis = new \Predis\Client([
            'scheme' => 'tcp',
            'host'   => REDIS_HOST,
            'port'   => REDIS_PORT,
            'read_write_timeout' => 0,
        ]);
        worker_log('Connected Redis host=' . REDIS_HOST . ' port=' . (string)REDIS_PORT);
        $this->maybeBootstrapMessengerProfile();
    }

    public function run() {
        while (true) {
            try {
                // BLPOP blocks until a job is available
                $job = $this->redis->blpop(['messenger_webhook_jobs'], 5);
                if (!is_array($job) || empty($job[1])) {
                    continue;
                }

                $payload = json_decode((string)$job[1], true);
                if (!is_array($payload)) {
                    worker_log('Skip invalid queue payload');
                    continue;
                }

                try {
                    $this->process($payload);
                } catch (\Throwable $e) {
                    worker_log('Process error: ' . $e->getMessage());
                }
            } catch (\Exception $e) {
                worker_log('Loop error: ' . $e->getMessage());
                sleep(2);
            }
        }
    }

    private function process($payload) {
        $senderId = $payload['senderId'] ?? '';
        $messageText = $payload['messageText'] ?? '';
        $actionPayload = $payload['actionPayload'] ?? '';
        $sourceMessageId = trim((string)($payload['sourceMessageId'] ?? ''));
        $actionPayload = $this->normalizeIncomingActionPayload((string)$actionPayload, (string)$messageText);

        if ($senderId === '' || ($messageText === '' && $actionPayload === '')) {
            worker_log('Skip payload missing senderId/messageText/actionPayload');
            return;
        }
        if ($messageText === '' && $actionPayload !== '') {
            $messageText = $actionPayload;
        }

        worker_log(
            'Processing sender=' . $senderId .
            ' text="' . mb_substr($messageText, 0, 80) . '"' .
            ($actionPayload !== '' ? ' action=' . $actionPayload : '') .
            ($sourceMessageId !== '' ? ' source=' . $sourceMessageId : '')
        );

        if ($this->maybeSendFirstContactWelcome((string)$senderId, (string)$messageText, (string)$actionPayload)) {
            return;
        }

        // 1. Send Typing Action
        $this->sendMessengerAction($senderId, 'typing_on');

        // 2. Ask OpenClaw
        $response = $this->askOpenClaw($senderId, $messageText, $actionPayload, $sourceMessageId);
        $replyText = trim((string)($response['reply'] ?? ''));
        $ui = is_array($response['ui'] ?? null) ? $response['ui'] : null;
        $suggestions = $this->normalizeSuggestions($ui['suggestions'] ?? null);
        $reviewUrl = $this->extractOrderReviewUrl((string)$senderId, $suggestions);

        worker_log('OpenClaw reply="' . mb_substr($replyText, 0, 120) . '"');

        // 3. Send Reply
        if ($replyText !== '') {
            if ($ui && $ui['type'] === 'menu' && !empty($ui['items'])) {
                // Send text first without suggestions
                $this->sendMessengerText($senderId, $replyText);
                // Then send carousel with suggestions
                $menuSent = $this->sendMessengerMenu($senderId, $ui['items'], $suggestions);
                if (!$menuSent) {
                    $fallbackText = $this->buildMenuFallbackText($ui['items']);
                    if ($fallbackText !== '') {
                        $this->sendMessengerText($senderId, $fallbackText, $suggestions);
                    }
                }
                if ($reviewUrl !== '') {
                    $this->sendMessengerWebReviewButton($senderId, $reviewUrl);
                }
                return;
            }

            $this->sendMessengerText($senderId, $replyText, $suggestions);
            if ($reviewUrl !== '') {
                $this->sendMessengerWebReviewButton($senderId, $reviewUrl);
            }
            return;
        }

        worker_log('Skip sending because reply text is empty');
    }

    private function askOpenClaw($senderId, $message, $actionPayload = '', $sourceMessageId = '') {
        $request = [
            'userId' => 'messenger-' . $senderId,
            'message' => $message,
            'channel' => 'messenger',
            'correlationId' => 'msgr-worker-' . substr(sha1(uniqid('', true)), 0, 16),
            'clientContext' => [
                'locale' => 'vi-VN',
                'sourceMessageId' => $sourceMessageId !== '' ? $sourceMessageId : ('msg-' . substr(sha1((string)microtime(true) . (string)$senderId), 0, 10)),
            ],
        ];
        if (is_string($actionPayload) && trim($actionPayload) !== '') {
            $request['actionPayload'] = trim($actionPayload);
        }

        $result = $this->postJson(OPENCLAW_URL . '/chat', $request, OPENCLAW_TIMEOUT_MS, 2);
        if (!$result['ok']) {
            worker_log(
                'OpenClaw call failed status=' . (string)($result['status'] ?? 0) .
                ' error=' . (string)($result['error'] ?? 'unknown')
            );
            return ['reply' => 'Hệ thống tạm bận, vui lòng thử lại sau.'];
        }

        $decoded = is_array($result['data'] ?? null) ? $result['data'] : [];
        if (!is_array($decoded) || empty($decoded['ok']) || !is_array($decoded['data'] ?? null)) {
            worker_log('OpenClaw returned invalid payload');
            return ['reply' => 'Hệ thống tạm bận, vui lòng thử lại sau.'];
        }

        return is_array($decoded['data']) ? $decoded['data'] : ['reply' => 'Hệ thống tạm bận, vui lòng thử lại sau.'];
    }

    private function sendMessengerText($recipientId, $text, $suggestions = null) {
        $pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
        if ($pageToken === '') {
            worker_log('Send text skipped because MESSENGER_PAGE_ACCESS_TOKEN is empty');
            return false;
        }

        $message = ['text' => $text];
        if (is_array($suggestions) && count($suggestions) > 0) {
            $quickReplies = [];
            foreach ($suggestions as $s) {
                $label = mb_substr((string)($s['label'] ?? ''), 0, 20);
                $payload = (string)($s['payload'] ?? '');
                if ($label === '' || $payload === '') {
                    continue;
                }
                $quickReplies[] = [
                    'content_type' => 'text',
                    'title' => $label,
                    'payload' => $payload,
                ];
            }
            if (!empty($quickReplies)) {
                $message['quick_replies'] = $quickReplies;
            }
        }

        $url = 'https://graph.facebook.com/' . rawurlencode((string)MESSENGER_GRAPH_VERSION) . '/me/messages?access_token=' . rawurlencode($pageToken);
        $payload = [
            'messaging_type' => 'RESPONSE',
            'recipient' => ['id' => $recipientId],
            'message' => $message,
        ];

        $result = $this->postJson($url, $payload, 20000, 3);
        if (!$result['ok']) {
            $errorText = $this->resolveGraphError($result);
            worker_log('Send text failed status=' . (string)($result['status'] ?? 0) . ' error=' . $errorText);
            return false;
        }
        worker_log('Send text success recipient=' . $recipientId);
        return true;
    }

    private function sendMessengerMenu($recipientId, $items, $suggestions = null) {
        $pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
        if ($pageToken === '') {
            worker_log('Send menu skipped because MESSENGER_PAGE_ACCESS_TOKEN is empty');
            return false;
        }

        $elements = [];
        $count = 0;
        foreach ($items as $item) {
            if ($count >= 10) break; // Messenger limit
            
            $img = $item['imageUrl'] ?? '';
            if (strpos($img, '/') === 0) {
                $img = rtrim(BASE_URL, '/') . $img;
            }
            $img = trim((string)$img);
            if ($img !== '' && stripos($img, 'https://') !== 0) {
                // Messenger template is strict with media URL; fallback to text if image URL is not HTTPS.
                $img = '';
            }

            $element = [
                'title' => mb_substr($item['name'] . ' (' . number_format((float)$item['priceVnd']) . ' đ)', 0, 80),
                'subtitle' => mb_substr($item['description'] ?? '', 0, 80),
                'buttons' => [
                    [
                        'type' => 'postback',
                        'title' => 'ĐẶT MÓN NÀY',
                        'payload' => 'ACTION_ORDER_ADD:' . $item['sku'],
                    ]
                ]
            ];
            if ($img !== '') {
                $element['image_url'] = $img;
            }
            $elements[] = $element;
            $count++;
        }
        if (count($elements) === 0) {
            worker_log('Send menu skipped because no element available');
            return false;
        }

        $message = [
            'attachment' => [
                'type' => 'template',
                'payload' => [
                    'template_type' => 'generic',
                    'elements' => $elements
                ]
            ]
        ];

        if (is_array($suggestions) && count($suggestions) > 0) {
            // quick replies are attached to a lightweight follow-up text to avoid template validation issues
            $this->sendMessengerText($recipientId, 'Bạn muốn làm gì tiếp theo?', $suggestions);
        }

        $url = 'https://graph.facebook.com/' . rawurlencode((string)MESSENGER_GRAPH_VERSION) . '/me/messages?access_token=' . rawurlencode($pageToken);
        $payload = [
            'messaging_type' => 'RESPONSE',
            'recipient' => ['id' => $recipientId],
            'message' => $message,
        ];

        $result = $this->postJson($url, $payload, 20000, 3);
        if (!$result['ok']) {
            $errorText = $this->resolveGraphError($result);
            worker_log('Send menu failed status=' . (string)($result['status'] ?? 0) . ' error=' . $errorText);
            return false;
        }
        worker_log('Send menu success recipient=' . $recipientId . ' elements=' . (string)count($elements));
        return $result['ok'];
    }

    private function buildMenuFallbackText($items): string {
        if (!is_array($items) || count($items) === 0) {
            return '';
        }

        $lines = ["Danh sách món gợi ý:"];
        $count = 0;
        foreach ($items as $item) {
            if ($count >= 8) {
                break;
            }
            $name = trim((string)($item['name'] ?? ''));
            $sku = strtoupper(trim((string)($item['sku'] ?? '')));
            if ($name === '' || $sku === '') {
                continue;
            }
            $price = number_format((float)($item['priceVnd'] ?? 0), 0, ',', '.');
            $lines[] = '- ' . $name . ' (' . $sku . ') - ' . $price . ' đ';
            $count++;
        }

        if ($count === 0) {
            return '';
        }

        $lines[] = "Bạn có thể bấm nút gợi ý hoặc nhắn theo mẫu SKU:SL (ví dụ CAFE-SUA:2).";
        return implode("\n", $lines);
    }

    private function sendMessengerWebReviewButton($recipientId, $url) {
        $pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
        if ($pageToken === '' || trim((string)$url) === '') {
            return false;
        }

        $message = [
            'attachment' => [
                'type' => 'template',
                'payload' => [
                    'template_type' => 'button',
                    'text' => 'Xem lại đơn bằng ảnh món trên web để kiểm tra trước khi xác nhận.',
                    'buttons' => [
                        [
                            'type' => 'web_url',
                            'url' => $url,
                            'title' => 'Mở trang kiểm tra',
                            'webview_height_ratio' => 'full',
                        ],
                    ],
                ],
            ],
        ];

        $urlApi = 'https://graph.facebook.com/' . rawurlencode((string)MESSENGER_GRAPH_VERSION) . '/me/messages?access_token=' . rawurlencode($pageToken);
        $payload = [
            'messaging_type' => 'RESPONSE',
            'recipient' => ['id' => $recipientId],
            'message' => $message,
        ];

        $result = $this->postJson($urlApi, $payload, 20000, 3);
        if (!$result['ok']) {
            $errorText = $this->resolveGraphError($result);
            worker_log('Send web review button failed status=' . (string)($result['status'] ?? 0) . ' error=' . $errorText);
            return false;
        }
        worker_log('Send web review button success recipient=' . $recipientId);
        return true;
    }

    private function sendMessengerAction($recipientId, $action) {
        $pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
        if ($pageToken === '') {
            worker_log('Send action skipped because MESSENGER_PAGE_ACCESS_TOKEN is empty');
            return false;
        }

        $url = 'https://graph.facebook.com/' . rawurlencode((string)MESSENGER_GRAPH_VERSION) . '/me/messages?access_token=' . rawurlencode($pageToken);
        $payload = [
            'recipient' => ['id' => $recipientId],
            'sender_action' => $action,
        ];

        $this->postJson($url, $payload, 5000, 1);
        return true;
    }

    private function maybeSendFirstContactWelcome(string $senderId, string $messageText, string $actionPayload): bool {
        if (!$this->markMessengerUserSeen($senderId)) {
            return false;
        }

        worker_log('First-contact onboarding sender=' . $senderId);
        $welcomeSuggestions = [
            ['label' => 'Xem menu', 'payload' => 'ACTION_VIEW_MENU'],
            ['label' => 'Đặt đơn', 'payload' => 'ACTION_ORDER_START'],
            ['label' => 'Kiểm tra đơn', 'payload' => 'ACTION_ORDER_STATUS'],
            ['label' => 'Gặp tư vấn viên', 'payload' => 'ACTION_HANDOFF_REQUEST'],
        ];
        $this->sendMessengerText(
            $senderId,
            "Xin chào! Mình là trợ lý Lowland Coffee.\nBạn có thể xem menu, đặt đơn và theo dõi đơn ngay tại đây.",
            $welcomeSuggestions
        );

        $normalizedAction = strtoupper(trim($actionPayload));
        $normalizedText = strtolower(trim($messageText));
        $isIntroOnly = ($normalizedAction === '' && $normalizedText === '')
            || $normalizedAction === 'ACTION_HELP'
            || $normalizedAction === 'GET_STARTED'
            || $normalizedText === 'get started';

        return $isIntroOnly;
    }

    private function markMessengerUserSeen(string $senderId): bool {
        $native = preg_replace('/\D+/', '', $senderId);
        if ($native === '') {
            return false;
        }
        $key = 'messenger_user_seen:' . $native;
        try {
            $set = $this->redis->setnx($key, (string)time());
            if (!$set) {
                return false;
            }
            $this->redis->expire($key, 120 * 24 * 3600);
            return true;
        } catch (\Throwable $e) {
            worker_log('markMessengerUserSeen failed: ' . $e->getMessage());
            return false;
        }
    }

    private function maybeBootstrapMessengerProfile(): void {
        if (!defined('MESSENGER_AUTO_PROFILE_SETUP') || !MESSENGER_AUTO_PROFILE_SETUP) {
            return;
        }
        $pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
        if ($pageToken === '') {
            return;
        }

        try {
            $lockKey = 'messenger_profile_setup:v2';
            $set = $this->redis->setnx($lockKey, (string)time());
            if (!$set) {
                return;
            }
            $this->redis->expire($lockKey, 6 * 3600);
        } catch (\Throwable $e) {
            worker_log('profile setup lock failed: ' . $e->getMessage());
        }

        $url = 'https://graph.facebook.com/' . rawurlencode((string)MESSENGER_GRAPH_VERSION) . '/me/messenger_profile?access_token=' . rawurlencode($pageToken);
        $payload = [
            'get_started' => [
                'payload' => 'ACTION_HELP',
            ],
            'greeting' => [
                [
                    'locale' => 'default',
                    'text' => 'Xin chào! Mình là trợ lý Lowland Coffee. Bạn có thể xem menu, đặt món và theo dõi đơn ngay tại đây.',
                ],
            ],
            'ice_breakers' => [
                ['question' => 'Quán có các món nào?', 'payload' => 'ACTION_VIEW_MENU'],
                ['question' => 'Cho mình đặt đồ uống', 'payload' => 'ACTION_ORDER_START'],
                ['question' => 'Kiểm tra đơn hàng', 'payload' => 'ACTION_ORDER_STATUS'],
            ],
            'persistent_menu' => [
                [
                    'locale' => 'default',
                    'composer_input_disabled' => false,
                    'call_to_actions' => [
                        ['type' => 'postback', 'title' => 'Xem menu', 'payload' => 'ACTION_VIEW_MENU'],
                        ['type' => 'postback', 'title' => 'Đặt đơn', 'payload' => 'ACTION_ORDER_START'],
                        ['type' => 'postback', 'title' => 'Kiểm tra đơn', 'payload' => 'ACTION_ORDER_STATUS'],
                        ['type' => 'postback', 'title' => 'Gặp tư vấn viên', 'payload' => 'ACTION_HANDOFF_REQUEST'],
                        ['type' => 'web_url', 'title' => 'Mở website', 'url' => rtrim((string)BASE_URL, '/'), 'webview_height_ratio' => 'full'],
                    ],
                ],
            ],
        ];

        $result = $this->postJson($url, $payload, 20000, 2);
        if (!$result['ok']) {
            $errorText = $this->resolveGraphError($result);
            worker_log('Bootstrap messenger profile failed status=' . (string)($result['status'] ?? 0) . ' error=' . $errorText);
            return;
        }
        worker_log('Bootstrap messenger profile success');
    }

    private function resolveGraphError(array $result): string {
        $data = $result['data'] ?? null;
        if (is_array($data) && is_array($data['error'] ?? null)) {
            return trim((string)($data['error']['message'] ?? 'unknown_error'));
        }
        return trim((string)($result['error'] ?? 'unknown_error'));
    }

    private function normalizeSuggestions($suggestions) {
        if (!is_array($suggestions)) {
            return [];
        }

        $normalized = [];
        foreach ($suggestions as $entry) {
            if (is_array($entry)) {
                $label = trim((string)($entry['label'] ?? ''));
                $payload = trim((string)($entry['payload'] ?? ''));
                if ($label !== '' && $payload !== '') {
                    $normalized[] = ['label' => $label, 'payload' => $payload];
                }
                continue;
            }

            $text = trim((string)$entry);
            if ($text !== '') {
                $normalized[] = ['label' => $text, 'payload' => $this->mapLegacySuggestionPayload($text)];
            }
        }

        return $normalized;
    }

    private function extractOrderReviewUrl($senderId, &$suggestions) {
        if (!is_array($suggestions) || count($suggestions) === 0) {
            return '';
        }

        $remaining = [];
        $resolvedUrl = '';
        $nativeUserId = preg_replace('/\D+/', '', (string)$senderId);
        foreach ($suggestions as $entry) {
            $payload = trim((string)($entry['payload'] ?? ''));
            $url = $this->buildOrderReviewUrlFromPayload($payload, $nativeUserId);
            if ($resolvedUrl === '' && $url !== '') {
                $resolvedUrl = $url;
                continue;
            }
            $remaining[] = $entry;
        }

        $suggestions = $remaining;
        return $resolvedUrl;
    }

    private function buildOrderReviewUrlFromPayload(string $payload, string $nativeUserId): string {
        $parsed = $this->parseOrderReviewPayload($payload);
        if (!is_array($parsed) || empty($parsed['items'])) {
            return '';
        }

        $base = rtrim((string)BASE_URL, '/')
            . '/?r=site/orderReview&items=' . rawurlencode((string)$parsed['items'])
            . '&ch=messenger';
        if ($nativeUserId !== '') {
            $base .= '&uid=' . rawurlencode($nativeUserId);
        }
        if (!empty($parsed['name'])) {
            $base .= '&rn=' . rawurlencode((string)$parsed['name']);
        }
        if (!empty($parsed['phone'])) {
            $base .= '&rp=' . rawurlencode((string)$parsed['phone']);
        }
        if (!empty($parsed['address'])) {
            $base .= '&ra=' . rawurlencode((string)$parsed['address']);
        }
        if (!empty($parsed['payment'])) {
            $base .= '&rm=' . rawurlencode((string)$parsed['payment']);
        }
        return $base;
    }

    private function parseOrderReviewPayload(string $payload): ?array {
        $prefix = 'OPEN_WEB_REVIEW:';
        if (stripos($payload, $prefix) !== 0) {
            return null;
        }
        $body = trim(substr($payload, strlen($prefix)));
        if ($body === '' || strlen($body) > 1200) {
            return null;
        }

        $parts = explode('|', $body);
        $itemsPart = strtoupper(trim((string)array_shift($parts)));
        if ($itemsPart === '') {
            return null;
        }

        $pairs = explode(',', $itemsPart);
        $normalized = [];
        foreach ($pairs as $pair) {
            $part = strtoupper(trim($pair));
            if (!preg_match('/^([A-Z0-9_-]{2,40}):([1-9][0-9]{0,2})$/', $part, $m)) {
                continue;
            }
            $normalized[] = $m[1] . ':' . $m[2];
            if (count($normalized) >= 20) {
                break;
            }
        }

        if (count($normalized) === 0) {
            return null;
        }

        $meta = [
            'name' => '',
            'phone' => '',
            'address' => '',
            'payment' => '',
        ];
        foreach ($parts as $part) {
            $chunk = trim((string)$part);
            if ($chunk === '' || strpos($chunk, '=') === false) {
                continue;
            }
            [$keyRaw, $valueRaw] = explode('=', $chunk, 2);
            $key = strtolower(trim((string)$keyRaw));
            $value = trim((string)$valueRaw);
            if ($value === '') {
                continue;
            }
            if ($key === 'n') {
                $meta['name'] = $this->decodeCompactReviewField($value);
                continue;
            }
            if ($key === 'p') {
                $digits = preg_replace('/\D+/', '', $value);
                $meta['phone'] = substr((string)$digits, 0, 15);
                continue;
            }
            if ($key === 'a') {
                $meta['address'] = $this->decodeCompactReviewField($value);
                continue;
            }
            if ($key === 'm') {
                $payment = strtolower($value);
                if ($payment === 'bank_transfer' || $payment === 'cod') {
                    $meta['payment'] = $payment;
                }
            }
        }

        return [
            'items' => implode(',', $normalized),
            'name' => $meta['name'],
            'phone' => $meta['phone'],
            'address' => $meta['address'],
            'payment' => $meta['payment'],
        ];
    }

    private function decodeCompactReviewField(string $value): string {
        $encoded = trim($value);
        if ($encoded === '') {
            return '';
        }
        if (!preg_match('/^[A-Za-z0-9\-_]+$/', $encoded)) {
            return '';
        }
        $base64 = strtr($encoded, '-_', '+/');
        $mod = strlen($base64) % 4;
        if ($mod > 0) {
            $base64 .= str_repeat('=', 4 - $mod);
        }
        $decoded = base64_decode($base64, true);
        if ($decoded === false) {
            return '';
        }
        return trim((string)$decoded);
    }

    private function mapLegacySuggestionPayload(string $label): string {
        $normalized = strtolower(trim($label));
        if ($normalized === '') {
            return $label;
        }
        if (strpos($normalized, 'xem menu') !== false) return 'ACTION_VIEW_MENU';
        if (strpos($normalized, 'cà phê') !== false || strpos($normalized, 'ca phe') !== false) return 'ACTION_CATEGORY:coffee';
        if (strpos($normalized, 'trà sữa') !== false || strpos($normalized, 'tra sua') !== false) return 'ACTION_CATEGORY:milk_tea';
        if (strpos($normalized, 'trà trái cây') !== false || strpos($normalized, 'tra trai cay') !== false) return 'ACTION_CATEGORY:fruit_tea';
        if (strpos($normalized, 'nước ép') !== false || strpos($normalized, 'nuoc ep') !== false) return 'ACTION_CATEGORY:juice';
        if (strpos($normalized, 'đặt đơn') !== false || strpos($normalized, 'dat don') !== false) return 'ACTION_ORDER_START';
        if (strpos($normalized, 'kiểm tra đơn') !== false || strpos($normalized, 'kiem tra don') !== false) return 'ACTION_ORDER_STATUS';
        if (strpos($normalized, 'tư vấn viên') !== false || strpos($normalized, 'tu van vien') !== false) return 'ACTION_HANDOFF_REQUEST';
        if (strpos($normalized, 'tiếp tục với bot') !== false || strpos($normalized, 'tiep tuc voi bot') !== false) return 'ACTION_HANDOFF_RESUME';
        return $label;
    }

    private function normalizeIncomingActionPayload(string $rawPayload, string $messageText): string {
        $payload = trim($rawPayload);
        if ($payload === '') {
            return '';
        }

        if (stripos($payload, 'ACTION_') === 0) {
            return $payload;
        }

        if (strcasecmp($payload, 'GET_STARTED') === 0) {
            return 'ACTION_HELP';
        }

        $mapped = $this->mapLegacySuggestionPayload($payload);
        if ($mapped !== $payload && stripos($mapped, 'ACTION_') === 0) {
            return $mapped;
        }

        // If message text is empty (pure postback) keep payload as text fallback to avoid dropping event.
        return trim($messageText) === '' ? $payload : '';
    }

    private function postJson($url, $body, $timeoutMs, $maxAttempts = 1) {
        $json = json_encode($body, JSON_UNESCAPED_UNICODE);
        $headers = [
            'Content-Type: application/json',
            'Content-Length: ' . strlen((string)$json)
        ];
        $attempts = max(1, (int)$maxAttempts);
        $lastResult = ['ok' => false, 'status' => 0, 'error' => 'request_failed'];

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            $ch = curl_init($url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            curl_setopt($ch, CURLOPT_TIMEOUT, max(1, (int)ceil($timeoutMs / 1000)));
            $response = curl_exec($ch);
            $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlError = curl_error($ch);
            curl_close($ch);

            if ($response === false) {
                $lastResult = ['ok' => false, 'status' => $statusCode, 'error' => $curlError !== '' ? $curlError : 'request_failed'];
            } else {
                $decoded = json_decode($response, true);
                $okStatus = $statusCode >= 200 && $statusCode < 300;
                if (!is_array($decoded)) {
                    $decoded = [];
                }
                $lastResult = ['ok' => $okStatus, 'status' => $statusCode, 'data' => $decoded];
            }

            if (!empty($lastResult['ok'])) {
                $lastResult['attempts'] = $attempt;
                return $lastResult;
            }

            if ($attempt < $attempts && $this->shouldRetryRequest($url, $statusCode, $lastResult['data'] ?? null, (string)($lastResult['error'] ?? ''))) {
                usleep((int)(250000 * $attempt));
                continue;
            }

            $lastResult['attempts'] = $attempt;
            return $lastResult;
        }

        return $lastResult;
    }

    private function shouldRetryRequest(string $url, int $statusCode, $decoded, string $errorText): bool {
        $isGraphApi = stripos($url, 'graph.facebook.com') !== false;
        if (!$isGraphApi) {
            return false;
        }

        if (trim($errorText) !== '') {
            return true;
        }
        if ($statusCode === 0 || $statusCode === 429 || $statusCode >= 500) {
            return true;
        }

        if (!is_array($decoded) || !is_array($decoded['error'] ?? null)) {
            return false;
        }

        $code = (int)($decoded['error']['code'] ?? 0);
        return in_array($code, [1, 2, 4, 17, 32, 613], true);
    }
}

// Start worker
$worker = new MessengerWorker();
$worker->run();
