<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204); exit;
}

if (!is_dir(__DIR__ . '/data')) mkdir(__DIR__ . '/data', 0755, true);

function userFile(string $type): string {
  $userId = $_SESSION['user']['id'] ?? 'anonymous';
  $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $userId);
  return __DIR__ . '/data/' . $type . '_' . $safeId . '.json';
}

function readJson(string $type, $default = []) {
  $path = userFile($type);
  if (!file_exists($path)) return $default;
  $raw = file_get_contents($path);
  if ($raw === false) return $default;
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : $default;
}

function writeJson(string $type, $data): bool {
  $path = userFile($type);
  $raw = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($raw === false) return false;
  return file_put_contents($path, $raw, LOCK_EX) !== false;
}

$type = $_GET['type'] ?? '';
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// GET /?action=load&type=<type>
if ($action === 'load' && $method === 'GET') {
  if (!in_array($type, ['profile','favorites','quiz','diary','saved_news','diary_entries'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Tipo non valido: ' . $type], JSON_UNESCAPED_UNICODE);
    exit;
  }
  echo json_encode(['ok' => true, 'data' => readJson($type)], JSON_UNESCAPED_UNICODE);
  exit;
}

// POST /?action=save&type=<type>
if ($action === 'save' && $method === 'POST') {
  if (!in_array($type, ['profile','favorites','quiz','diary','saved_news','diary_entries'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Tipo non valido'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  
  $input = json_decode(file_get_contents('php://input'), true);
  if ($input === null || !isset($input['data'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Body deve contenere {data: ...}'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if (!writeJson($type, $input['data'])) {
    http_response_code(500);
    echo json_encode(['error' => 'Errore salvataggio'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  echo json_encode(['ok' => true, 'type' => $type], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(400);
echo json_encode(['error' => 'Usa ?action=load&type=<tipo> o ?action=save&type=<tipo>'], JSON_UNESCAPED_UNICODE);