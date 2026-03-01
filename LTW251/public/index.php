<?php
// public/index.php

// 1. Chống lỗi khoảng trắng/header trên Windows
ob_start(); 

// 2. Nạp Config ngay lập tức
require_once __DIR__ . '/../config/config.php'; 

// 3. Nạp Composer (nếu có dùng PHPMailer)
if (file_exists(__DIR__ . '/../vendor/autoload.php')) {
    require_once __DIR__ . '/../vendor/autoload.php';
}

header('Content-Type: text/html; charset=utf-8');
session_start();

spl_autoload_register(function($class){
  $paths = [
    __DIR__ . '/../app/Controllers/' . $class . '.php',
    __DIR__ . '/../app/Models/' . $class . '.php',
  ];
  foreach ($paths as $p) if (file_exists($p)) { require_once $p; return; }
});

$r = $_GET['r'] ?? 'home/index';
[$c, $a] = array_pad(explode('/', $r, 2), 2, 'index');
$controllerClass = ucfirst($c) . 'Controller';

if (!class_exists($controllerClass)) { 
    http_response_code(404); echo "404 Controller not found"; exit; 
}

$ctl = new $controllerClass();
if (!method_exists($ctl, $a)) { 
    http_response_code(404); echo "404 Action not found"; exit; 
}

echo $ctl->$a();

// 4. Kết thúc buffer
ob_end_flush();
?>