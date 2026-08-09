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
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
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
  {
    selector: "#points_feature_div > .a-color-price",
    matcher: isPointValueElement,
  },
  {
    selector:
      '[id*="point" i] .a-color-price, [class*="point" i] .a-color-price, [data-feature-name*="point" i] .a-color-price',
    matcher: isPointValueElement,
  },
  {
    selector:
      '[id*="point" i] span, [class*="point" i] span, [data-feature-name*="point" i] span',
    matcher: isPointValueElement,
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
    const candidates = Array.from(root.querySelectorAll(selector));
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
    element.closest('[id*="point" i],[class*="point" i],[data-feature-name*="point" i]')
      ?.textContent,
  ];

  return texts.some((text) => looksLikePointText(text));
}

function isPointValueElement(element: Element): boolean {
  return looksLikePointText(element.textContent);
}

function looksLikePointText(text: string | null | undefined): boolean {
  if (!text) return false;

  const normalized = trimText(text).toLowerCase();
  return /\d[\d,]*(pt|ポイント)/i.test(normalized);
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
