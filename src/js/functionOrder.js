// ページ読み込み後の実行処理を制御
$(document).ready(function () {
  let url = location.href;

  // [ウィッシュリスト]ページの場合
  if (url.indexOf("wishlist") != -1) WISHLIST.start();
  // [ランキング]ページの場合
  else RANKING.start();
});

// エスケープ
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
