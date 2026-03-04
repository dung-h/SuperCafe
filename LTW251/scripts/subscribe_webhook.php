<?php
// scripts/subscribe_webhook.php
require_once __DIR__ . '/../config/config.php';

$pageToken = (string)MESSENGER_PAGE_ACCESS_TOKEN;
if ($pageToken === '') {
    echo "Error: MESSENGER_PAGE_ACCESS_TOKEN is not set.\n";
    exit(1);
}

$url = 'https://graph.facebook.com/' . MESSENGER_GRAPH_VERSION . '/me/subscribed_apps?subscribed_fields=messages,messaging_postbacks&access_token=' . rawurlencode($pageToken);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
// No body needed for this POST
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

echo "HTTP Code: $httpCode\n";
echo "Response: $response\n";
