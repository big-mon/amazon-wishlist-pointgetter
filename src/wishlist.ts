import { fetchPoints, processedItems } from "./util";

const domain = location.protocol + "//" + location.host;

/** Intersection Observer for lazy loading */
let intersectionObserver: IntersectionObserver | null = null;

/** ウィッシュリスト上の商品ブロックを走査 */
export const doWishlist = () => {
  const wrapper = document.getElementById("g-items");
  if (wrapper == null) return;
  
  // Intersection Observerの初期化
  initIntersectionObserver();
  
  // 既存の商品アイテムを処理
  const allItems = wrapper?.querySelectorAll("li");
  allItems?.forEach((item) => {
    if (item instanceof HTMLElement) {
      observeItem(item);
    }
  });

  // 動的な要素の追加を監視
  observer.observe(wrapper, { childList: true });
};

/** Intersection Observerの初期化 */
const initIntersectionObserver = () => {
  if (intersectionObserver) return;
  
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          const item = entry.target;
          if (!processedItems.has(item)) {
            processedItems.set(item, true);
            editItem(item);
            // 一度処理したらオブザーバーから外す
            intersectionObserver?.unobserve(item);
          }
        }
      });
    },
    {
      root: null,
      rootMargin: '100px', // 100px手前で事前読み込み
      threshold: 0.1
    }
  );
};

/** アイテムをIntersection Observerに登録 */
const observeItem = (item: HTMLElement) => {
  if (processedItems.has(item)) return;
  intersectionObserver?.observe(item);
};

/** 商品ブロックに取得ポイントを追記
 * @param item 商品HTML
 */
const editItem = async (item: HTMLElement) => {
  // 重複処理チェック
  if (processedItems.has(item)) return;
  
  // 商品のURLを取得
  const selectorUrl = "h2.a-size-base .a-link-normal";
  const href = item.querySelector(selectorUrl)?.getAttribute("href");
  if (!href) return;
  const url = domain + href;

  // 価格要素を取得
  const selectorPrice = ".price-section .a-price";
  const priceTag = item.querySelector(selectorPrice);
  if (priceTag == null) return;

  // ローディングインジケータを即座に表示
  const loadingSpinner = createLoadingSpinner();
  priceTag.appendChild(loadingSpinner);

  try {
    // 商品の取得ポイントを取得
    const result = await fetchPoints(url);
    
    // ローディングインジケータを削除
    loadingSpinner.remove();
    
    // ポイント情報を表示
    if (result && result !== "取得失敗") {
      const pointTag = createPointDisplay(result);
      priceTag.appendChild(pointTag);
    } else {
      const errorTag = createErrorDisplay();
      priceTag.appendChild(errorTag);
    }
  } catch (error) {
    console.warn('Failed to process item:', error);
    loadingSpinner.remove();
    const errorTag = createErrorDisplay();
    priceTag.appendChild(errorTag);
  }
};

/** ローディングスピナーを作成 */
const createLoadingSpinner = (): HTMLElement => {
  const spinner = document.createElement('span');
  spinner.className = 'add-point-loading a-size-small';
  spinner.style.cssText = 'margin-left: .6rem; color: #666;';
  spinner.textContent = '⏳';
  return spinner;
};

/** ポイント表示要素を作成 */
const createPointDisplay = (points: string): HTMLElement => {
  const pointElement = document.createElement('span');
  pointElement.className = 'add-point a-size-small';
  pointElement.style.cssText = 'margin-left: .6rem;';
  pointElement.innerHTML = `<span class="a-color-price">${points}</span>`;
  return pointElement;
};

/** エラー表示要素を作成 */
const createErrorDisplay = (): HTMLElement => {
  const errorElement = document.createElement('span');
  errorElement.className = 'add-point-error a-size-small';
  errorElement.style.cssText = 'margin-left: .6rem; color: #888; font-size: 11px;';
  errorElement.textContent = '—';
  return errorElement;
};

/** 要素の監視を定義 */
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    // 追加されたノードを対象にループ
    for (let node of Array.from(mutation.addedNodes)) {
      if (!(node instanceof HTMLElement)) continue;
      if (!node.matches("li")) continue;

      // 新しく追加されたアイテムをIntersection Observerに登録
      observeItem(node);
    }
  });
});

/** クリーンアップ関数 */
export const cleanup = () => {
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  observer.disconnect();
};

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', cleanup);
