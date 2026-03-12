/** 商品URLから取得ポイントを取得 */
export const fetchPoints = async (url: string): Promise<string> => {
  try {
    console.log("Fetching points for:", url);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.warn(`HTTP ${response.status} for ${url}`);
      return "取得失敗";
    }

    const resData = await response.text();
    const points = parsePoints(resData);
    console.log("Points found:", points);
    return points;
  } catch (error) {
    console.warn(`Failed to fetch points for ${url}:`, error);
    return "取得失敗";
  }
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
export const parsePoints = (data: string): string => {
  try {
    const doc = new DOMParser().parseFromString(data, "text/html");
    const dom = findPointNode(doc);

    if (!dom || !dom.textContent) {
      return "";
    }

    const pointText = trimText(dom.textContent);
    return pointText ? escapeHtml(pointText) : "";
  } catch (error) {
    console.warn("Failed to parse points:", error);
    return "";
  }
};

export const findPointNode = (root: ParentNode): Element | null => {
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

function isPointCandidate(element: Element): boolean {
  const texts = [
    element.textContent,
    element.parentElement?.textContent,
    element.closest('[id*="point"],[class*="point"]')?.textContent,
  ];

  return texts.some((text) => looksLikePointText(text));
}

function looksLikePointText(text: string | null | undefined): boolean {
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
const trimText = (text: string): string =>
  text.replace(/\t/g, "").replace(/ /g, "").replace(/\r?\n/g, "");

/** 重複処理チェック用のWeakMap */
export const processedItems = new WeakMap<HTMLElement, boolean>();
