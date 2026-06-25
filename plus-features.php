/* plus-features.php */
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

if ($action === 'rewrite') {
  requirePlusOr403();
  $body = json_decode(file_get_contents('php://input') ?: '[]', true);
  $text = (string)($body['text'] ?? '');

  if (trim($text) === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Testo mancante.'], JSON_UNESCAPED_UNICODE);
    exit;
  }

  // Rule-based rewrite (demo)
  $out = $text;

  // Riduci toni categorici
  $out = preg_replace('/\b(sei|stai)\s+([a-zà-ù]+)\b/i', 'potresti essere', $out) ?? $out;

  // Aggiungi struttura inclusiva
  $prefix = "Grazie per aver condiviso. 🙏\n";
  $prefix .= "Capisco il tuo punto di vista, e allo stesso tempo vorrei proporre una formulazione più inclusiva:\n\n";
  $suffix = "\n\nSe vuoi, dimmi anche cosa ti servirebbe per sentirti più ascoltato/a. 🌿";

  // Semplice: manteniamo testo ma lo “incorniciamo”
  $rewritten = $prefix . $out . $suffix;

  echo json_encode([
    'ok' => true,
    'rewritten' => $rewritten,
    'tips' => [
      'Usa “capisco” e “grazie per aver condiviso” per ridurre difese.',
      'Evita frasi categoriche: preferisci “potremmo” e “se per te va bene…”.',
      'Chiudi con una domanda su bisogni e preferenze.'
    ]
  ], JSON_UNESCAPED_UNICODE);
  exit;
}

http_response_code(400);
echo json_encode(['error' => 'Azione non valida'], JSON_UNESCAPED_UNICODE);
