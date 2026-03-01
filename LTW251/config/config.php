<?php
// config/config.php

// Database
define('DB_HOST', getenv('DB_HOST') ?: '127.0.0.1');
define('DB_NAME', getenv('DB_NAME') ?: 'lowland_coffee');
define('DB_USER', getenv('DB_USER') ?: 'web251');
define('DB_PASS', getenv('DB_PASS') ?: 'Webhk251!');

// Public base URL
define('BASE_URL', getenv('BASE_URL') ?: 'http://localhost:9999');

// App
$appDebugRaw = getenv('APP_DEBUG');
define('APP_DEBUG', $appDebugRaw !== false ? filter_var($appDebugRaw, FILTER_VALIDATE_BOOLEAN) : true);

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

date_default_timezone_set('Asia/Ho_Chi_Minh');
