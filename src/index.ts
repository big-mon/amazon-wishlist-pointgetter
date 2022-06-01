import { doWishlist } from "./wishlist";

/** 処理全体のスターター */
const start = () => {
  let url = location.href;

  // 表示中のページ種別を判定
  if (url.indexOf("wishlist") != -1) {
    // [ウィッシュリスト]ページの場合
    doWishlist();
  }
};

start();
