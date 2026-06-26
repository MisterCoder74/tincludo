<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Crea directory data se non esiste
if (!is_dir(__DIR__ . '/data')) {
  mkdir(__DIR__ . '/data', 0755, true);
}

function diaryFilePath(): string {
  // Usa un file unico per demo (senza autenticazione reale usa un file comune)
  // Se c'è un utente loggato, usa il suo ID
  $userId = $_SESSION['user']['id'] ?? 'anonymous';
  // Sanitize userId per nome file sicuro
  $safeId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $userId);
  return __DIR__ . '/data/diary_' . $safeId . '.json';
}

function loadDiaryFromFile(): array {
  $path = diaryFilePath();
  if (!file_exists($path)) return [];
  $raw = file_get_contents($path);
  if ($raw === false) return [];
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : [];
}

function saveDiaryToFile(array $entries): bool {
  $path = diaryFilePath();
  $raw = json_encode($entries, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($raw === false) return false;
  return file_put_contents($path, $raw, LOCK_EX) !== false;
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// LIST - recupera tutte le voci
if ($action === 'list' && $method === 'GET') {
  $entries = loadDiaryFromFile();
  echo json_encode(['ok' => true, 'entries' => $entries], JSON_UNESCAPED_UNICODE);
  exit;
}

// SAVE - salva una nuova voce o un array di voci (sync)
if ($action === 'save' && $method === 'POST') {
  $input = json_decode(file_get_contents('php://input'), true);
  if (!$input || !is_array($input)) {
    http_response_code(400);
    echo json_encode(['error' => 'Dati non validi'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Supporta sia singola entry che array
  if (isset($input['entry'])) {
    // Singola entry
    $entries = loadDiaryFromFile();
    $entry = $input['entry'];
    
    // Se ha un id già esistente, sovrascrivi (update)
    $found = false;
    foreach ($entries as $i => $e) {
      if (($e['id'] ?? '') === ($entry['id'] ?? '')) {
        $entries[$i] = $entry;
        $entries[$i]['updatedAt'] = date('c');
        $found = true;
        break;
      }
    }
    if (!$found) {
      $entry['createdAt'] = $entry['createdAt'] ?? date('c');
      array_unshift($entries, $entry);
    }

    if (!saveDiaryToFile($entries)) {
      http_response_code(500);
      echo json_encode(['error' => 'Errore salvataggio'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    echo json_encode(['ok' => true, 'entries' => $entries], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Array completo (sync)
  if (isset($input['entries']) && is_array($input['entries'])) {
    if (!saveDiaryToFile($input['entries'])) {
      http_response_code(500);
      echo json_encode(['error' => 'Errore salvataggio'], JSON_UNESCAPED_UNICODE);
      exit;
    }
    echo json_encode(['ok' => true, 'entries' => $input['entries']], JSON_UNESCAPED_UNICODE);
    exit;
  }

  http_response_code(400);
  echo json_encode(['error' => 'Formato non valido: usa {entry: {...}} o {entries: [...]}'], JSON_UNESCAPED_UNICODE);
  exit;
}

// DELETE - elimina una voce per id
if ($action === 'delete' && $method === 'POST') {
  $input = json_decode(file_get_contents('php://input'), true);
  $id = (string)($input['id'] ?? '');
  if ($id === '') {
    http_response_code(400);
    echo json_encode(['error' => 'ID mancante'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $entries = loadDiaryFromFile();
  $filtered = array_values(array_filter($entries, fn($e) => ($e['id'] ?? '') !== $id));
  
  if (count($filtered) === count($entries)) {
    http_response_code(404);
    echo json_encode(['error' => 'Voce non trovata'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  if (!saveDiaryToFile($filtered)) {
    http_response_code(500);
    echo json_encode(['error' => 'Errore salvataggio'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  echo json_encode(['ok' => true, 'entries' => $filtered], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(400);
echo json_encode(['error' => 'Azione non valida'], JSON_UNESCAPED_UNICODE);