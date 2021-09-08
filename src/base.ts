import { doWishlist } from "./wishlist";
import { doRanking } from "./ranking";

/** 処理全体のスターター */
const start = () => {
  let url = location.href;

  // [ウィッシュリスト]ページの場合
  if (url.indexOf("wishlist") != -1) {
    doWishlist();
  } else {
    doRanking();
  }
};

start();
