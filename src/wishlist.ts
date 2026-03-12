import { fetchPoints, processedItems } from "./util";

const extensionElementSelector = "[data-devola-element]";

const wishlistUrlSelectors = [
  "h2.a-size-base .a-link-normal",
  'a[id^="itemName_"]',
] as const;

const wishlistPointTargetSelectors = [
  ".price-section .a-price",
  '[id^="itemPrice_"] .a-price',
  '[id^="itemPriceDrop_"] .a-price',
  ".price-section",
  '[id^="itemPrice_"]',
  '[id^="itemPriceDrop_"]',
] as const;

const fetchFailureSentinel = "取得失敗";

let intersectionObserver: IntersectionObserver | null = null;
const processingItems = new WeakMap<HTMLElement, boolean>();

const getDomain = () => `${location.protocol}//${location.host}`;

const findFirstMatch = <T extends Element>(
  root: ParentNode,
  selectors: readonly string[],
): T | null => {
  for (const selector of selectors) {
    const element = root.querySelector(selector);
    if (element) {
      return element as T;
    }
  }

  return null;
};

export const findWishlistUrlElement = (item: ParentNode): HTMLAnchorElement | null =>
  findFirstMatch<HTMLAnchorElement>(item, wishlistUrlSelectors);

export const findWishlistPointTarget = (item: ParentNode): HTMLElement | null =>
  findFirstMatch<HTMLElement>(item, wishlistPointTargetSelectors);

const isDisplayablePoints = (result: string) =>
  result !== "" && result !== fetchFailureSentinel;

const removeExtensionElements = (item: ParentNode) => {
  item.querySelectorAll(extensionElementSelector).forEach((element) => element.remove());
};

const createProductUrl = (href: string) => new URL(href, getDomain()).toString();

export const doWishlist = () => {
  console.log("Starting wishlist processing...");
  const wrapper = document.getElementById("g-items");
  if (wrapper == null) {
    console.warn("g-items wrapper not found");
    return;
  }

  initIntersectionObserver();

  const allItems = wrapper.querySelectorAll("li");
  console.log(`Found ${allItems.length} items`);

  allItems.forEach((item) => {
    if (item instanceof HTMLElement) {
      observeItem(item);
    }
  });

  observer.observe(wrapper, { childList: true, subtree: true });
};

const initIntersectionObserver = () => {
  if (intersectionObserver) return;

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.target instanceof HTMLElement) {
          const item = entry.target;
          if (!processedItems.has(item) && !processingItems.has(item)) {
            void editItem(item);
            intersectionObserver?.unobserve(item);
          }
        }
      });
    },
    {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    },
  );
};

const observeItem = (item: HTMLElement) => {
  if (processedItems.has(item) || processingItems.has(item)) return;
  intersectionObserver?.observe(item);
};

export const editItem = async (
  item: HTMLElement,
  fetcher: (url: string) => Promise<string> = fetchPoints,
): Promise<boolean> => {
  if (processedItems.has(item) || processingItems.has(item)) {
    return true;
  }

  const href = findWishlistUrlElement(item)?.getAttribute("href");
  const priceTarget = findWishlistPointTarget(item);
  if (!href || priceTarget == null) {
    return false;
  }

  removeExtensionElements(item);
  processingItems.set(item, true);

  const loadingSpinner = createLoadingSpinner();
  priceTarget.appendChild(loadingSpinner);

  try {
    const result = await fetcher(createProductUrl(href));
    if (isDisplayablePoints(result)) {
      priceTarget.appendChild(createPointDisplay(result));
    }
  } catch (error) {
    console.warn("Failed to process item:", error);
  } finally {
    loadingSpinner.remove();
    processingItems.delete(item);
    processedItems.set(item, true);
  }

  return true;
};

const createLoadingSpinner = (): HTMLElement => {
  const spinner = document.createElement("span");
  spinner.className =
    "devola-points-loading devola-extension-element add-point-loading a-size-small";
  spinner.style.cssText = "margin-left: .6rem; color: #666;";
  spinner.textContent = "...";
  spinner.setAttribute("data-devola-element", "loading");
  return spinner;
};

const createPointDisplay = (points: string): HTMLElement => {
  const pointElement = document.createElement("span");
  pointElement.className =
    "devola-points-display devola-extension-element add-point a-size-small";
  pointElement.style.cssText = "margin-left: .6rem;";
  pointElement.innerHTML = `<span class="a-color-price devola-points-text">${points}</span>`;
  pointElement.setAttribute("data-devola-element", "points");
  pointElement.setAttribute("data-devola-version", "1.5.0");
  return pointElement;
};

const observer = new MutationObserver((mutations) => {
  const items = new Set<HTMLElement>();

  mutations.forEach((mutation) => {
    Array.from(mutation.addedNodes).forEach((node) => {
      if (!(node instanceof HTMLElement)) return;

      if (node.matches("li")) {
        items.add(node);
      }

      const parentItem = node.closest("li");
      if (parentItem instanceof HTMLElement) {
        items.add(parentItem);
      }
    });
  });

  items.forEach((item) => {
    observeItem(item);
  });
});

export const cleanup = () => {
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  observer.disconnect();
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", cleanup);
}
