/** 商品URLから取得ポイントを取得 */
export const fetchPoints = async (url: string): Promise<string> => {
  try {
    console.log('Fetching points for:', url);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      console.warn(`HTTP ${response.status} for ${url}`);
      return "取得失敗";
    }

    const resData = await response.text();
    const points = parsePoints(resData);
    console.log('Points found:', points);
    return points;
  } catch (error) {
    console.warn(`Failed to fetch points for ${url}:`, error);
    return "取得失敗";
  }
};

/** 商品ページからポイント部分を取得
 * @param data 商品ページHTML
 */
const parsePoints = (data: string): string => {
  // セレクター
  const selectors = [
    "#addToCart #pointsInsideBuyBox_feature_div span.a-color-price",
    "#addToCart #buyBoxInner span.a-color-price:not(.offer-price)",
    ".loyalty-points .a-align-bottom",
    ".ebooks-aip-points-label .a-color-price",
    "#Ebooks-desktop-KINDLE_ALC-prices-loyaltyPoints .a-color-price"
  ];

  try {
    // 取得ポイント部分のDOM
    const dom = new DOMParser()
      .parseFromString(data, "text/html")
      .querySelector(selectors.join(","));
    
    if (!dom || !dom.textContent) {
      return "";
    }

    const pointText = trimText(dom.textContent);
    return pointText ? escapeHtml(pointText) : "";
  } catch (error) {
    console.warn('Failed to parse points:', error);
    return "";
  }
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
const trimText = (text: string): string =>
  text.replace(/\t/g, "").replace(/ /g, "").replace(/\r?\n/g, "");

/** 重複処理チェック用のWeakMap */
export const processedItems = new WeakMap<HTMLElement, boolean>();
