import { fetchPoints } from "./util";

const domain = location.protocol + "//" + location.host;

/** ウィッシュリスト上の商品ブロックを走査 */
export const doWishlist = () => {
  const wrapper = document.getElementById("g-items");
  if (wrapper == null) return;
  const allItems = wrapper?.querySelectorAll("li");

  allItems?.forEach((value, _index) => {
    editItem(value);
  });

  // 動的な要素の追加を監視
  observer.observe(wrapper, { childList: true });
};

/** 商品ブロックに取得ポイントを追記
 * @param item 商品HTML
 */
const editItem = async (item: HTMLElement) => {
  // 商品のURLを取得
  const selectorUrl = "h2.a-size-base .a-link-normal";
  const href = item.querySelector(selectorUrl)?.getAttribute("href");
  if (!href) return;
  const url = domain + href;

  // 商品の取得ポイントを取得
  const result = await fetchPoints(url);

  // 価格要素を取得
  const selectorPrice = ".price-section .a-price";
  const priceTag = item.querySelector(selectorPrice);
  if (priceTag == null) return;

  // 価格要素に取得ポイントを追記
  const pointTag =
    '<span class="add-point a-size-small" style="margin-left: .6rem;"><span class="a-color-price">' +
    result +
    "</span></span>";
  priceTag.insertAdjacentHTML("beforeend", pointTag);
};

/** 要素の監視を定義 */
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    // 追加されたノードを対象にループ
    for (let node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof HTMLElement)) continue;
      if (!node.matches("li")) continue;

      editItem(node);
    }
  });
});
