/* stripe-webhook.php */
<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

if (!is_dir(__DIR__ . '/data')) mkdir(__DIR__ . '/data', 0755, true);

function dataPath(string $file): string {
  return __DIR__ . '/data/' . $file;
}
function readJson(string $file, $default) {
  $path = dataPath($file);
  if (!file_exists($path)) return $default;
  $raw = file_get_contents($path);
  if ($raw === false) return $default;
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : $default;
}
function writeJson(string $file, $data): bool {
  $path = dataPath($file);
  $raw = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  return $raw !== false && file_put_contents($path, $raw, LOCK_EX) !== false;
}

if (!file_exists(__DIR__ . '/vendor/autoload.php')) {
  http_response_code(500);
  echo 'Stripe SDK non installato.';
  exit;
}

// ✅ CAMPO STRIPE: segreti webhook solo lato server
$STRIPE_WEBHOOK_SECRET = getenv('STRIPE_WEBHOOK_SECRET') ?: 'METTI_QUI_WEBHOOK_SECRET';

$payload = @file_get_contents('php://input');
$signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

try {
  require_once __DIR__ . '/vendor/autoload.php';
  \Stripe\Stripe::setApiKey(getenv('STRIPE_SECRET_KEY') ?: 'METTI_QUI_LA_STRIPE_SECRET_KEY');

  $event = \Stripe\Webhook::constructEvent(
    $payload,
    $signature,
    $STRIPE_WEBHOOK_SECRET
  );

  // Recupero metadata userId/plan dalla sessione pagata
  // Per semplicità usiamo checkout.session.completed
  if ($event->type === 'checkout.session.completed') {
    $session = $event->data->object;

    $userId = $session->metadata->userId ?? null;
    $plan   = $session->metadata->plan ?? null;

    if ($userId && $plan) {
      $entitlements = readJson('entitlements.json', []);
      $found = false;
      foreach ($entitlements as $idx => $e) {
        if (($e['userId'] ?? '') === $userId && ($e['plan'] ?? '') === $plan) {
          $entitlements[$idx]['updatedAt'] = date('c');
          $found = true;
          break;
        }
      }
      if (!$found) {
        $entitlements[] = [
          'userId' => (string)$userId,
          'plan' => (string)$plan,
          'createdAt' => date('c'),
          'updatedAt' => date('c')
        ];
      }

      writeJson('entitlements.json', $entitlements);
    }
  }

  http_response_code(200);
  echo 'ok';
} catch (Throwable $e) {
  http_response_code(400);
  echo 'Webhook error';
}
