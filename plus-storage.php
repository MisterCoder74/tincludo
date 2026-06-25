/* plus-storage.php */
<?php
declare(strict_types=1);

session_start();
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['user']['id'] ?? null)) {
  http_response_code(401);
  echo json_encode(['error' => 'Non autenticato'], JSON_UNESCAPED_UNICODE);
  exit;
}

if (!is_dir(__DIR__ . '/data')) mkdir(__DIR__ . '/data', 0755, true);

function dataPath(string $file): string { return __DIR__ . '/data/' . $file; }
function readJson(string $file, $default) {
  $path = dataPath($file);
  if (!file_exists($path)) return $default;
  $raw = file_get_contents($path);
  if ($raw === false) return $default;
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : $default;
}
function writeJson(string $file, $data): bool {
  $raw = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($raw === false) return false;
  return file_put_contents(dataPath($file), $raw, LOCK_EX) !== false;
}
function requirePlusOr403(): void {
  $entitlements = readJson('entitlements.json', []);
  $userId = (string)$_SESSION['user']['id'];
  $ok = false;
  foreach ($entitlements as $e) {
    if (($e['userId'] ?? '') === $userId && ($e['plan'] ?? '') === 'plus_one_time') { $ok = true; break; }
  }
  if (!$ok) {
    http_response_code(403);
    echo json_encode(['error' => 'Funzione Plus non sbloccata.'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

$action = $_GET['action'] ?? '';
$userId = (string)$_SESSION['user']['id'];

if ($action === 'push') {
  requirePlusOr403();
  $body = json_decode(file_get_contents('php://input') ?: '[]', true);
  if (!is_array($body)) $body = [];

  // payload: { diaryEntries: [...], favorites: [...] }
  $diaryEntries = $body['diaryEntries'] ?? [];
  $favorites = $body['favorites'] ?? [];

  $all = readJson('plus_data.json', []);
  if (!is_array($all)) $all = [];

  $updated = false;
  foreach ($all as $i => $row) {
    if (($row['userId'] ?? '') === $userId) {
      $all[$i]['diaryEntries'] = is_array($diaryEntries) ? $diaryEntries : [];
      $all[$i]['favorites'] = is_array($favorites) ? $favorites : [];
      $all[$i]['updatedAt'] = date('c');
      $updated = true;
      break;
    }
  }
  if (!$updated) {
    $all[] = [
      'userId' => $userId,
      'diaryEntries' => is_array($diaryEntries) ? $diaryEntries : [],
      'favorites' => is_array($favorites) ? $favorites : [],
      'createdAt' => date('c'),
      'updatedAt' => date('c')
    ];
  }

  writeJson('plus_data.json', $all);
  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($action === 'pull') {
  requirePlusOr403();
  $all = readJson('plus_data.json', []);
  foreach ($all as $row) {
    if (($row['userId'] ?? '') === $userId) {
      echo json_encode([
        'ok' => true,
        'diaryEntries' => $row['diaryEntries'] ?? [],
        'favorites' => $row['favorites'] ?? []
      ], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }

  echo json_encode(['ok' => true, 'diaryEntries' => [], 'favorites' => []], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(400);
echo json_encode(['error' => 'Azione non valida'], JSON_UNESCAPED_UNICODE);
