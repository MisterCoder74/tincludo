<?php
declare(strict_types=1);

session_start();

if (!is_dir(__DIR__ . '/data')) {
  mkdir(__DIR__ . '/data', 0755, true);
}

function dataPath(string $file): string {
  return __DIR__ . '/data/' . $file;
}

function readJson(string $file, $default) {
  $path = dataPath($file);
  if (!file_exists($path)) return $default;
  $raw = file_get_contents($path);
  if ($raw === false) return $default;

  $decoded = json_decode($raw, true);
  if (!is_array($decoded)) return $default;
  return $decoded;
}

function writeJson(string $file, $data): bool {
  $path = dataPath($file);
  $raw = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  if ($raw === false) return false;
  return file_put_contents($path, $raw, LOCK_EX) !== false;
}

function normalizeEmail(string $email): string {
  return trim(mb_strtolower($email));
}

function requirePost(): void {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Metodo non consentito'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

function requireAuth(): void {
  if (empty($_SESSION['user'])) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Non autenticato'], JSON_UNESCAPED_UNICODE);
    exit;
  }
}

$action = $_GET['action'] ?? '';
header('Content-Type: application/json; charset=utf-8');

if ($action === 'signup') {
  requirePost();

  $name = trim((string)($_POST['name'] ?? ''));
  $email = normalizeEmail((string)($_POST['email'] ?? ''));
  $password = (string)($_POST['password'] ?? '');
  $city = trim((string)($_POST['city'] ?? ''));
  $terms = (string)($_POST['terms'] ?? '0');

  if ($name === '' || mb_strlen($name) > 60) {
    http_response_code(400);
    echo json_encode(['error' => 'Nome non valido.'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if ($city === '' || mb_strlen($city) > 80) {
    http_response_code(400);
    echo json_encode(['error' => 'Città non valida.'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Inserisci un’email valida.'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if ($password === '' || strlen($password) < 8) {
    http_response_code(400);
    echo json_encode(['error' => 'Password troppo corta (min 8).'], JSON_UNESCAPED_UNICODE);
    exit;
  }
  if (!in_array($terms, ['1', 'true', 'on'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Devi accettare i termini del servizio.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $users = readJson('users.json', []);
  foreach ($users as $u) {
    if (($u['email'] ?? '') === $email) {
      http_response_code(409);
      echo json_encode(['error' => 'Email già registrata.'], JSON_UNESCAPED_UNICODE);
      exit;
    }
  }

  $id = bin2hex(random_bytes(16));
  $hash = password_hash($password, PASSWORD_DEFAULT);

  $users[] = [
    'id' => $id,
    'name' => $name,
    'email' => $email,
    'city' => $city,
    'password_hash' => $hash,
    'createdAt' => date('c')
  ];

  if (!writeJson('users.json', $users)) {
    http_response_code(500);
    echo json_encode(['error' => 'Errore salvataggio utente.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Come richiesto: registrazione OK ma rimanda al login.
  // Quindi NON manteniamo login automatico: distruggiamo sessione.
  session_destroy();
  session_start();

  echo json_encode(['ok' => true, 'message' => 'Registrazione riuscita ✅ Ora accedi.'], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($action === 'login') {
  requirePost();

  $email = normalizeEmail((string)($_POST['email'] ?? ''));
  $password = (string)($_POST['password'] ?? '');

  $users = readJson('users.json', []);
  $found = null;

  foreach ($users as $u) {
    if (($u['email'] ?? '') === $email) {
      $found = $u;
      break;
    }
  }

  if (!$found || empty($found['password_hash']) || !password_verify($password, (string)$found['password_hash'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Credenziali non valide.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  $_SESSION['user'] = ['id' => $found['id'], 'email' => $found['email'], 'name' => $found['name'] ?? ''];

  echo json_encode(['ok' => true, 'user' => $_SESSION['user']], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($action === 'reset') {
  requirePost();

  $email = normalizeEmail((string)($_POST['email'] ?? ''));
  if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Inserisci un’email valida.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Demo: salviamo un token fittizio (non inviamo email).
  $tokens = readJson('reset_tokens.json', []);
  $tokens[] = [
    'email' => $email,
    'token' => bin2hex(random_bytes(16)),
    'createdAt' => date('c')
  ];
  writeJson('reset_tokens.json', $tokens);

  echo json_encode(['ok' => true, 'message' => 'Richiesta inviata ✅ (demo). Ora puoi fare login.'], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($action === 'logout') {
  session_destroy();
  echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($action === 'me') {
  if (empty($_SESSION['user'])) {
    echo json_encode(['authed' => false], JSON_UNESCAPED_UNICODE);
    exit;
  }
  echo json_encode(['authed' => true, 'user' => $_SESSION['user']], JSON_UNESCAPED_UNICODE);
  exit;
}

if ($action === 'plusStatus') {
  requireAuth();

  $entitlements = readJson('entitlements.json', []);
  $userId = (string)($_SESSION['user']['id'] ?? '');

  $isPlus = false;
  foreach ($entitlements as $e) {
    if (($e['userId'] ?? '') === $userId && ($e['plan'] ?? '') === 'plus_one_time') {
      $isPlus = true;
      break;
    }
  }

  echo json_encode(['plus' => $isPlus], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(400);
echo json_encode(['error' => 'Azione non valida'], JSON_UNESCAPED_UNICODE);
