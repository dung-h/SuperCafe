<?php
require_once __DIR__ . '/BaseController.php';

class AdminChatController extends BaseController {
    public function index() {
        $this->requireAdmin();
        return $this->renderAdmin('admin/chat', [], 'Hỗ trợ trực tuyến');
    }

    public function poll() {
        $this->requireAdmin();
        header('Content-Type: application/json');
        
        $url = OPENCLAW_URL . '/admin/handoff';
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        $res = curl_exec($ch);
        curl_close($ch);
        
        echo $res ?: json_encode(['ok' => false]);
        exit;
    }

    public function reply() {
        $this->requireAdmin();
        header('Content-Type: application/json');
        
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        
        if (!$data || empty($data['channel']) || empty($data['userId']) || empty($data['message'])) {
            echo json_encode(['ok' => false, 'error' => 'Missing data']);
            exit;
        }
        
        $url = OPENCLAW_URL . '/admin/handoff/reply';
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        
        $res = curl_exec($ch);
        curl_close($ch);
        
        echo $res ?: json_encode(['ok' => false]);
        exit;
    }

    public function endSession() {
        $this->requireAdmin();
        header('Content-Type: application/json');
        
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);
        
        if (!$data || empty($data['channel']) || empty($data['userId'])) {
            echo json_encode(['ok' => false]);
            exit;
        }
        
        $payload = [
            'channel' => $data['channel'],
            'userId' => $data['userId'],
            'message' => 'tiếp tục với bot'
        ];
        
        $url = OPENCLAW_URL . '/chat';
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        $res = curl_exec($ch);
        curl_close($ch);
        
        echo $res ?: json_encode(['ok' => false]);
        exit;
    }
}
