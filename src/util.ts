/** リクエストキューの管理 */
class RequestQueue {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;
  private readonly maxConcurrent = 3;
  private readonly delayMs = 300;
  private activeRequests = 0;

  async add<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.activeRequests++;
          const result = await this.executeWithRetry(request);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeRequests--;
          // 次のリクエストまでディレイ
          if (this.queue.length > 0) {
            await this.delay(this.delayMs);
          }
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.processing || this.activeRequests >= this.maxConcurrent) {
      return;
    }

    this.processing = true;
    while (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
      const request = this.queue.shift();
      if (request) {
        // 並列実行（awaitしない）
        request().finally(() => {
          this.processQueue();
        });
      }
    }
    this.processing = false;
  }

  private async executeWithRetry<T>(request: () => Promise<T>, maxRetries = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await request();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        // 指数バックオフ
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
    throw new Error('Max retries exceeded');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

const requestQueue = new RequestQueue();

/** 商品URLから取得ポイントを取得（最適化版） */
export const fetchPoints = async (url: string): Promise<string> => {
  return requestQueue.add(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const resData = await response.text();
      return parsePoints(resData);
    } catch (error) {
      console.warn(`Failed to fetch points for ${url}:`, error);
      return "取得失敗";
    } finally {
      clearTimeout(timeoutId);
    }
  });
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
