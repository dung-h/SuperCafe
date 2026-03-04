<?php
// config/config.php

if (!function_exists('resolve_base_url')) {
    function resolve_base_url(): string {
        $fromEnv = trim((string)(getenv('BASE_URL') ?: ''));
        if ($fromEnv !== '') {
            return rtrim($fromEnv, '/');
        }

        $forwardedProto = trim((string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
        if ($forwardedProto !== '') {
            $protoParts = explode(',', $forwardedProto);
            $scheme = strtolower(trim((string)$protoParts[0]));
        } else {
            $https = strtolower((string)($_SERVER['HTTPS'] ?? ''));
            $scheme = ($https === 'on' || $https === '1') ? 'https' : 'http';
        }

        $forwardedHost = trim((string)($_SERVER['HTTP_X_FORWARDED_HOST'] ?? ''));
        if ($forwardedHost !== '') {
            $hostParts = explode(',', $forwardedHost);
            $host = trim((string)$hostParts[0]);
        } else {
            $host = trim((string)($_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? 'localhost:9999'));
        }

        return rtrim($scheme . '://' . $host, '/');
    }
}

// Database
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_NAME', getenv('DB_NAME') ?: 'lowland_coffee');
define('DB_USER', getenv('DB_USER') ?: 'web251');
define('DB_PASS', getenv('DB_PASS') ?: 'Webhk251!');

// Public base URL (auto-detect host/proto when BASE_URL is not set)
define('BASE_URL', resolve_base_url());

// App
$appDebugRaw = getenv('APP_DEBUG');
define('APP_DEBUG', $appDebugRaw !== false ? filter_var($appDebugRaw, FILTER_VALIDATE_BOOLEAN) : true);

// Redis
define('REDIS_HOST', getenv('REDIS_HOST') ?: 'lowland_redis');
define('REDIS_PORT', (int)(getenv('REDIS_PORT') ?: 6379));

// Mail
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'mailhog');
define('SMTP_PORT', (int)(getenv('SMTP_PORT') ?: 1025));

// Bot bridge + chatbot proxy
define('BOT_BRIDGE_API_KEY', getenv('BOT_BRIDGE_API_KEY') ?: 'dev-bridge-key-change-me');
define('OPENCLAW_URL', getenv('OPENCLAW_URL') ?: 'http://localhost:8082');
define('OPENCLAW_TIMEOUT_MS', (int)(getenv('OPENCLAW_TIMEOUT_MS') ?: 20000));
define('MESSENGER_VERIFY_TOKEN', getenv('MESSENGER_VERIFY_TOKEN') ?: 'change-me-messenger-verify-token');
define('MESSENGER_APP_SECRET', getenv('MESSENGER_APP_SECRET') ?: '');
define('MESSENGER_PAGE_ACCESS_TOKEN', getenv('MESSENGER_PAGE_ACCESS_TOKEN') ?: '');
define('MESSENGER_GRAPH_VERSION', getenv('MESSENGER_GRAPH_VERSION') ?: 'v21.0');
define('EXTERNAL_SESSION_SECRET', getenv('EXTERNAL_SESSION_SECRET') ?: '');

date_default_timezone_set('Asia/Ho_Chi_Minh');
