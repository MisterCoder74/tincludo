/* stripe-checkout.php */
<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php'; // already starts session

header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['user']['id'] ?? null)) {
  http_response_code(401);
  echo json_encode(['error' => 'Devi fare login prima di acquistare Plus.'], JSON_UNESCAPED_UNICODE);
  exit;
}

if (!is_dir(__DIR__ . '/data')) mkdir(__DIR__ . '/data', 0755, true);

$userId = (string)$_SESSION['user']['id'];
$email = (string)$_SESSION['user']['email'];

function jsonOut(array $arr, int $code=200): void {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}

if (!file_exists(__DIR__ . '/vendor/autoload.php')) {
  jsonOut(['error' => 'Installa libreria Stripe con Composer (richiede vendor/autoload.php).'], 500);
}

// ✅ CAMPO STRIPE: usa variabili d’ambiente o mettile qui lato server (NON nel frontend, non in repo pubblico)
$STRIPE_SECRET_KEY = getenv('STRIPE_SECRET_KEY') ?: 'METTI_QUI_LA_STRIPE_SECRET_KEY';
$STRIPE_PRICE_ID   = getenv('STRIPE_PRICE_ID') ?: 'METTI_QUI_IL_PRICE_ID_ONE_TIME';
$STRIPE_MODE       = 'payment';

try {
  require_once __DIR__ . '/vendor/autoload.php';
  \Stripe\Stripe::setApiKey($STRIPE_SECRET_KEY);

  // Checkout Session per pagamento una tantum
  $session = \Stripe\Checkout\Session::create([
    'mode' => $STRIPE_MODE,
    'line_items' => [[
      'price' => $STRIPE_PRICE_ID,
      'quantity' => 1,
    ]],
    'customer_email' => $email,
    'success_url' => getenv('STRIPE_SUCCESS_URL') ?: ('https://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/plus-success.php?session_id={CHECKOUT_SESSION_ID}'),
    'cancel_url'  => getenv('STRIPE_CANCEL_URL') ?: ('https://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '/plus-cancel.php'),
    'metadata' => [
      'userId' => $userId,
      'plan' => 'plus_one_time'
    ],
  ]);

  echo json_encode(['ok' => true, 'checkoutUrl' => $session->url], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
  jsonOut(['error' => 'Errore creazione checkout.'], 500);
}
