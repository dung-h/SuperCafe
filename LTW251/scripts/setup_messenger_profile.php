<?php
// scripts/setup_messenger_profile.php
require_once __DIR__ . '/../config/config.php';

$pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
if ($pageToken === '') {
    echo "Error: MESSENGER_PAGE_ACCESS_TOKEN is not set.\n";
    exit(1);
}

$url = 'https://graph.facebook.com/' . MESSENGER_GRAPH_VERSION . '/me/messenger_profile?access_token=' . rawurlencode($pageToken);

$payload = [
    'get_started' => [
        'payload' => 'ACTION_HELP'
    ],
    'greeting' => [
        [
            'locale' => 'default',
            'text' => 'Xin chào! Mình là trợ lý Lowland Coffee. Bạn có thể xem menu, đặt món và theo dõi đơn ngay tại đây.'
        ]
    ],
    'ice_breakers' => [
        [
            'question' => 'Quán có các món nào?',
            'payload' => 'ACTION_VIEW_MENU'
        ],
        [
            'question' => 'Cho mình đặt đồ uống',
            'payload' => 'ACTION_ORDER_START'
        ],
        [
            'question' => 'Kiểm tra đơn hàng',
            'payload' => 'ACTION_ORDER_STATUS'
        ],
    ],
    'persistent_menu' => [
        [
            'locale' => 'default',
            'composer_input_disabled' => false,
            'call_to_actions' => [
                [
                    'type' => 'postback',
                    'title' => 'Xem Menu',
                    'payload' => 'ACTION_VIEW_MENU'
                ],
                [
                    'type' => 'postback',
                    'title' => 'Đặt đơn',
                    'payload' => 'ACTION_ORDER_START'
                ],
                [
                    'type' => 'postback',
                    'title' => 'Kiểm tra đơn',
                    'payload' => 'ACTION_ORDER_STATUS'
                ],
                [
                    'type' => 'postback',
                    'title' => 'Gặp tư vấn viên',
                    'payload' => 'ACTION_HANDOFF_REQUEST'
                ],
                [
                    'type' => 'web_url',
                    'title' => 'Mở website',
                    'url' => BASE_URL,
                    'webview_height_ratio' => 'full'
                ]
            ]
        ]
    ]
];

$json = json_encode($payload, JSON_UNESCAPED_UNICODE);
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Content-Length: ' . strlen($json)
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $response\n";
