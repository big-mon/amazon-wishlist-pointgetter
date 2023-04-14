/** 商品URLから取得ポイントを取得 */
export const fetchPoints = async (url: string) => {
  const response = await fetch(url);
  const resData = await response.text();
  return parsePoints(resData);
};

/** 商品ページからポイント部分を取得
 * @param data 商品ページHTML
 */
const parsePoints = (data: string) => {
  // セレクター
  const normalItem1 =
    "#addToCart #pointsInsideBuyBox_feature_div span.a-color-price";
  const normalItem2 =
    "#addToCart #buyBoxInner span.a-color-price:not(.offer-price)";
  const kindleItem1 = ".loyalty-points .a-align-bottom";
  const kindleItem2 = ".ebooks-aip-points-label .a-color-price";
  const kindleItem3 =
    "#Ebooks-desktop-KINDLE_ALC-prices-loyaltyPoints .a-color-price";

  // 取得ポイント部分のDOM
  const dom = new DOMParser()
    .parseFromString(data, "text/html")
    .querySelector(
      `${normalItem1},${normalItem2},${kindleItem1},${kindleItem2},${kindleItem3}`
    );
  if (!dom || !dom.textContent) return "";

  return escapeHtml(trimText(dom.textContent));
};

/** 文字列エスケープ
 * @param unsafe 無害化する文字列
 */
const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

/** 文字列トリム
 * @param text トリムを行う文字列
 */
const trimText = (text: string) =>
  text.replace(/\t/g, "").replace(/ /g, "").replace(/\r?\n/g, "");
