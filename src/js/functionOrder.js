// ページ読み込み後の実行処理を制御
$(document).ready(function() {
  var url = location.href;

  // [ウィッシュリスト]ページの場合
  if (url.indexOf('wishlist') != -1) WISHLIST.start();
  // [ランキング]ページの場合
  else if (url.indexOf("digital-text") != -1) RANKING.start();
});
