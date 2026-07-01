<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');

$query = isset($_GET['query']) ? trim((string)$_GET['query']) : 'inclusione sociale accessibilità';
$limit = isset($_GET['limit']) ? max(1, min(20, (int)$_GET['limit'])) : 15;

// Fonte generica (in italiano): Google News RSS search
// Nota: l’endpoint può cambiare nel tempo, perciò il client ha già un fallback offline.
$rssUrl = 'https://news.google.com/rss/search?q=' . rawurlencode($query) . '&hl=it&gl=IT&ceid=IT:it';

function fetchUrl(string $url): string {
  $ctx = stream_context_create([
    'http' => [
      'timeout' => 8,
      'follow_location' => 1,
      'user_agent' => 'TiIncludoPWA/1.0 (+news-proxy)'
    ]
  ]);
  $content = @file_get_contents($url, false, $ctx);
  if ($content === false) {
    throw new RuntimeException('Impossibile recuperare RSS');
  }
  return $content;
}

function safeText($v): string {
  return trim((string)($v ?? ''));
}

function toIsoDateOrEmpty(string $s): string {
  $s = trim($s);
  if ($s === '') return '';
  $d = date_create($s);
  if ($d === false) return $s;
  return $d->format('c');
}

try {
  $xmlText = fetchUrl($rssUrl);

  libxml_use_internal_errors(true);
  $xml = simplexml_load_string($xmlText);
  if (!$xml) {
    throw new RuntimeException('RSS non valido');
  }

  $channel = $xml->channel ?? null;
  if (!$channel) {
    throw new RuntimeException('RSS senza channel');
  }

  $items = [];
  $counter = 0;

  foreach ($channel->item as $item) {
    $title = safeText($item->title ?? '');
    $link = safeText($item->link ?? '');
    $pubDateRaw = safeText($item->pubDate ?? '');

    if ($title === '' && $link === '') continue;

    $items[] = [
      'title' => $title !== '' ? $title : 'Notizia senza titolo',
      'link'  => $link !== '' ? $link : '#',
      'pubDate' => $pubDateRaw !== '' ? toIsoDateOrEmpty($pubDateRaw) : ''
    ];

    $counter++;
    if ($counter >= $limit) break;
  }

  echo json_encode(['items' => $items], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Throwable $e) {
  http_response_code(200);
  echo json_encode(['items' => []], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}
