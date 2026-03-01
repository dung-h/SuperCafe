<?php
require __DIR__ . '/../app/Models/DB.php';

$ok = true;

echo "Connecting to database...\n";
try {
    $pdo = DB::pdo();
    echo "OK: Connected.\n";
} catch (Throwable $e) {
    echo "FAIL: Cannot connect to DB: " . $e->getMessage() . "\n";
    exit(1);
}

echo "Checking table 'users'...\n";

try {
    $cols = $pdo->query('SHOW COLUMNS FROM users')->fetchAll(PDO::FETCH_COLUMN);
} catch (Throwable $e) {
    echo "FAIL: Cannot read columns from users: " . $e->getMessage() . "\n";
    exit(1);
}

$expected = [
    'id',
    'email',
    'password_hash',
    'name',
    'role',
    'avatar_path',
    'is_blocked',
    'last_login_at',
    'created_at',
];

$missing = array_diff($expected, $cols);
if ($missing) {
    echo "FAIL: Missing columns in users: " . implode(', ', $missing) . "\n";
    $ok = false;
} else {
    echo "OK: users table has required columns.\n";
}

if ($ok) {
    exit(0);
}
exit(1);

