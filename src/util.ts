export type FetchPointsResult =
  | { kind: "success"; points: string }
  | { kind: "transient-failure" }
  | { kind: "terminal-failure"; status: number };

export type PointsFetcher = (url: string) => Promise<FetchPointsResult>;
export type RetryWait = () => Promise<void>;

const transientFailure: FetchPointsResult = { kind: "transient-failure" };
const defaultRetryWait: RetryWait = () =>
  new Promise((resolve) => setTimeout(resolve, 100));

/** 商品URLから取得ポイントを取得 */
export const fetchPoints: PointsFetcher = async (url) => {
  try {
    console.log("Fetching points for:", url);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.warn(`HTTP ${response.status} for ${url}`);
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429
      ) {
        return { kind: "terminal-failure", status: response.status };
      }
      return transientFailure;
    }

    const resData = await response.text();
    const points = parsePoints(resData);
    console.log("Points found:", points);
    return { kind: "success", points };
  } catch (error) {
    console.warn(`Failed to fetch points for ${url}:`, error);
    return transientFailure;
  }
};

export const fetchPointsWithRetry = async (
  url: string,
  fetcher: PointsFetcher = fetchPoints,
  wait: RetryWait = defaultRetryWait,
): Promise<FetchPointsResult> => {
  const maximumAttempts = 3;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    let result: FetchPointsResult;
    try {
      result = await fetcher(url);
    } catch (error) {
      console.warn(`Failed to fetch points for ${url}:`, error);
      result = transientFailure;
    }

    if (result.kind !== "transient-failure" || attempt === maximumAttempts) {
      return result;
    }

    await wait();
  }

  return transientFailure;
};

const pointSelectors = [
  "#addToCart #pointsInsideBuyBox_feature_div span.a-color-price",
  "#addToCart #buyBoxInner span.a-color-price:not(.offer-price)",
  ".loyalty-points .a-align-bottom",
  ".ebooks-aip-points-label .a-color-price",
  "#Ebooks-desktop-KINDLE_ALC-prices-loyaltyPoints .a-color-price",
  "#points_feature_div > .a-color-price",
  '[id*="point" i] .a-color-price, [class*="point" i] .a-color-price, [data-feature-name*="point" i] .a-color-price',
  '[id*="point" i] span, [class*="point" i] span, [data-feature-name*="point" i] span',
] as const;

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
    return pointText;
  } catch (error) {
    console.warn("Failed to parse points:", error);
    return "";
  }
};

export const findPointNode = (root: ParentNode): Element | null => {
  for (const selector of pointSelectors) {
    for (const candidate of root.querySelectorAll(selector)) {
      if (isPointValueElement(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

function isPointValueElement(element: Element): boolean {
  return looksLikePointText(element.textContent);
}

function looksLikePointText(text: string | null | undefined): boolean {
  if (!text) return false;

  const normalized = trimText(text);
  return /^\d[\d,]*(?:pt|ポイント)(?:\([^)]*\))?$/i.test(normalized);
}

/** 文字列トリム
 * @param text トリムを行う文字列
 */
const trimText = (text: string): string => text.replace(/\s+/g, "");
