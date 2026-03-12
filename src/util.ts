/** 商品URLから取得ポイントを取得 */
export const fetchPoints = async (url: string) => {
  const response = await fetch(url);
  const resData = await response.text();
  return parsePoints(resData);
};

const pointSelectors = [
  {
    selector: "#addToCart #pointsInsideBuyBox_feature_div span.a-color-price",
  },
  {
    selector: "#addToCart #buyBoxInner span.a-color-price:not(.offer-price)",
    matcher: isPointCandidate,
  },
  {
    selector: ".loyalty-points .a-align-bottom",
  },
  {
    selector: ".ebooks-aip-points-label .a-color-price",
  },
  {
    selector: "#Ebooks-desktop-KINDLE_ALC-prices-loyaltyPoints .a-color-price",
  },
] as Array<{
  selector: string;
  matcher?: (element: Element) => boolean;
}>;

/** 商品ページからポイント部分を取得
 * @param data 商品ページHTML
 */
export const parsePoints = (data: string) => {
  const doc = new DOMParser().parseFromString(data, "text/html");
  const dom = findPointNode(doc);
  if (!dom || !dom.textContent) return "";

  return escapeHtml(trimText(dom.textContent));
};

export const findPointNode = (root: ParentNode) => {
  for (const { selector, matcher } of pointSelectors) {
    const candidates = root.querySelectorAll(selector);
    for (const candidate of candidates) {
      if (!matcher || matcher(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

function isPointCandidate(element: Element) {
  const texts = [
    element.textContent,
    element.parentElement?.textContent,
    element.closest('[id*="point"],[class*="point"]')?.textContent,
  ];

  return texts.some((text) => looksLikePointText(text));
}

function looksLikePointText(text: string | null | undefined) {
  if (!text) return false;

  const normalized = trimText(text).toLowerCase();
  return normalized.includes("pt") || normalized.includes("ポイント");
}

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
