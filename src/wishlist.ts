import { fetchPoints, processedItems } from "./util";

const domain = location.protocol + "//" + location.host;

/**
 * Devola Chrome Extension - Point Display System
 * 
 * All elements created by this extension are marked with:
 * - CSS classes: devola-extension-element, devola-points-*
 * - Data attributes: data-devola-element, data-devola-version
 * 
 * This allows easy identification and potential cleanup of extension-added elements.
 */

/** Intersection Observer for lazy loading */
let intersectionObserver: IntersectionObserver | null = null;

/** ウィッシュリスト上の商品ブロックを走査 */
export const doWishlist = () => {
  console.log('Starting wishlist processing...');
  const wrapper = document.getElementById("g-items");
  if (wrapper == null) {
    console.warn('g-items wrapper not found');
    return;
  }
  
  // Intersection Observerの初期化
  initIntersectionObserver();
  
  // 既存の商品アイテムを処理
  const allItems = wrapper?.querySelectorAll("li");
  console.log(`Found ${allItems?.length} items`);
  
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
          console.log('Item became visible:', item);
          if (!processedItems.has(item)) {
            // 処理開始時点でマークする前に実際に処理を試行
            editItem(item);
            // 一度処理したらオブザーバーから外す
            intersectionObserver?.unobserve(item);
          }
        }
      });
    },
    {
      root: null,
      rootMargin: '200px', // 200px手前で事前読み込み
      threshold: 0
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
  if (processedItems.has(item)) {
    console.log('Item already processed, skipping');
    return;
  }
  
  // 商品のURLを取得
  const selectorUrl = "h2.a-size-base .a-link-normal";
  const href = item.querySelector(selectorUrl)?.getAttribute("href");
  if (!href) {
    console.warn('Product URL not found');
    return;
  }
  const url = domain + href;
  console.log('Processing item:', url);
  
  // この時点で処理済みとしてマーク
  processedItems.set(item, true);

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
  spinner.className = 'devola-points-loading devola-extension-element add-point-loading a-size-small';
  spinner.style.cssText = 'margin-left: .6rem; color: #666;';
  spinner.textContent = '⏳';
  spinner.setAttribute('data-devola-element', 'loading');
  return spinner;
};

/** ポイント表示要素を作成 */
const createPointDisplay = (points: string): HTMLElement => {
  const pointElement = document.createElement('span');
  pointElement.className = 'devola-points-display devola-extension-element add-point a-size-small';
  pointElement.style.cssText = 'margin-left: .6rem;';
  pointElement.innerHTML = `<span class="a-color-price devola-points-text">${points}</span>`;
  pointElement.setAttribute('data-devola-element', 'points');
  pointElement.setAttribute('data-devola-version', '1.5.0');
  return pointElement;
};

/** エラー表示要素を作成 */
const createErrorDisplay = (): HTMLElement => {
  const errorElement = document.createElement('span');
  errorElement.className = 'devola-points-error devola-extension-element add-point-error a-size-small';
  errorElement.style.cssText = 'margin-left: .6rem; color: #888; font-size: 11px;';
  errorElement.textContent = '—';
  errorElement.setAttribute('data-devola-element', 'error');
  errorElement.setAttribute('data-devola-status', 'fetch-failed');
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
