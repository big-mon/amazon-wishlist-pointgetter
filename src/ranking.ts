import { fetchPoints } from "./util";

/** ランキング上の商品ブロックを走査 */
export const doRanking = () => {
  const domain = location.protocol + "//" + location.host;

  const allItems = document
    .getElementById("zg-ordered-list")
    ?.querySelectorAll("li");

  allItems?.forEach((value, _index) => {
    editItem(value, domain);
  });
};

/** 商品ブロックに取得ポイントを追記
 * @param item 商品HTML
 * @param domain basePath (ex. http://example.com)
 */
const editItem = async (item: HTMLElement, domain: string) => {
  // 商品のURLを取得
  const selectorUrl = ".zg-item .a-link-normal";
  const url = domain + item.querySelector(selectorUrl)?.getAttribute("href");

  // 商品の取得ポイントを取得
  const result = await fetchPoints(url);

  // 価格要素を取得
  const selectorPrice = ".zg-item .p13n-sc-price:last-child";
  const priceTag = item.querySelector(selectorPrice);
  if (priceTag == null) return;

  // 価格要素に取得ポイントを追記
  const pointTag =
    '<span class="add-point a-size-small" style="margin-left: .6rem;"><span class="a-color-price">' +
    result +
    "</span></span>";
  priceTag.insertAdjacentHTML("beforeend", pointTag);
};
