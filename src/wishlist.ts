import {
  fetchPoints,
  fetchPointsWithRetry,
  type PointsFetcher,
  type RetryWait,
} from "./util";

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

let intersectionObserver: IntersectionObserver | null = null;
type ItemGeneration = {
  href: string;
  token: symbol;
};
const processingItems = new WeakMap<HTMLElement, ItemGeneration>();
const itemGenerations = new WeakMap<HTMLElement, ItemGeneration>();
let visibleItems = new WeakSet<HTMLElement>();
type ProcessedItemState = {
  href: string;
  outcome: "points" | "no-points";
};
const processedItems = new WeakMap<HTMLElement, ProcessedItemState>();

type RetryTimer = unknown;
type ScheduleRetry = (callback: () => void, delayMs: number) => RetryTimer;
type CancelRetry = (timer: RetryTimer) => void;

export type WishlistRuntimeOptions = {
  fetcher?: PointsFetcher;
  retryWait?: RetryWait;
  retryCycleDelayMs?: number;
  scheduleRetry?: ScheduleRetry;
  cancelRetry?: CancelRetry;
};

type ResolvedWishlistRuntimeOptions = {
  fetcher: PointsFetcher;
  retryWait: RetryWait | undefined;
  retryCycleDelayMs: number;
  scheduleRetry: ScheduleRetry;
  cancelRetry: CancelRetry;
};

const defaultRuntimeOptions: ResolvedWishlistRuntimeOptions = {
  fetcher: fetchPoints,
  retryWait: undefined,
  retryCycleDelayMs: 1_000,
  scheduleRetry: (callback: () => void, delayMs: number) =>
    setTimeout(callback, delayMs),
  cancelRetry: (timer: RetryTimer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

let runtimeOptions: ResolvedWishlistRuntimeOptions = defaultRuntimeOptions;
const retryTimers = new Map<HTMLElement, { href: string; timer: RetryTimer }>();
const minimumRetryCycleDelayMs = 250;
const maximumRetryCycleDelayMs = 30_000;

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

const removeExtensionElements = (item: ParentNode) => {
  item.querySelectorAll(extensionElementSelector).forEach((element) => element.remove());
};

const hasPointDisplay = (item: ParentNode) =>
  Array.from(item.querySelectorAll(extensionElementSelector)).some(
    (element) => element.getAttribute("data-devola-element") === "points",
  );

const needsProcessing = (item: HTMLElement, href: string | null): boolean => {
  if (!href) return false;

  const state = processedItems.get(item);
  if (!state || state.href !== href) return true;

  return state.outcome === "points" && !hasPointDisplay(item);
};

const createProductUrl = (href: string) => new URL(href, getDomain()).toString();

export const doWishlist = (options: WishlistRuntimeOptions = {}) => {
  runtimeOptions = { ...defaultRuntimeOptions, ...options };
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

  observer.observe(wrapper, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href"],
  });
};

const initIntersectionObserver = () => {
  if (intersectionObserver) return;

  intersectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!(entry.target instanceof HTMLElement)) return;

        const item = entry.target;
        if (!entry.isIntersecting) {
          visibleItems.delete(item);
          cancelRetryTimer(item);
          return;
        }

        visibleItems.add(item);
        processVisibleItem(item);
      });
    },
    {
      root: null,
      rootMargin: "200px",
      threshold: 0,
    },
  );
};

const cancelRetryTimer = (item: HTMLElement) => {
  const pending = retryTimers.get(item);
  if (!pending) return;

  runtimeOptions.cancelRetry(pending.timer);
  retryTimers.delete(item);
};

const boundedRetryCycleDelay = () =>
  Math.max(
    minimumRetryCycleDelayMs,
    Math.min(maximumRetryCycleDelayMs, runtimeOptions.retryCycleDelayMs),
  );

const scheduleRetryCycle = (item: HTMLElement, href: string) => {
  cancelRetryTimer(item);

  const timer = runtimeOptions.scheduleRetry(() => {
    const pending = retryTimers.get(item);
    if (!pending || pending.timer !== timer) return;

    retryTimers.delete(item);
    if (!visibleItems.has(item)) return;

    const currentHref = findWishlistUrlElement(item)?.getAttribute("href") ?? null;
    if (currentHref !== href) {
      processVisibleItem(item);
      return;
    }

    processVisibleItem(item);
  }, boundedRetryCycleDelay());

  retryTimers.set(item, { href, timer });
};

const processVisibleItem = (item: HTMLElement) => {
  if (!visibleItems.has(item)) return;

  const href = findWishlistUrlElement(item)?.getAttribute("href") ?? null;
  const processing = processingItems.get(item);
  if (processing?.href === href) return;

  const pendingRetry = retryTimers.get(item);
  if (pendingRetry) {
    if (pendingRetry.href === href) return;
    cancelRetryTimer(item);
  }
  if (!needsProcessing(item, href)) {
    cancelRetryTimer(item);
    intersectionObserver?.unobserve(item);
    return;
  }
  if (!href) return;

  const generation = Symbol(href);
  void editItemForGeneration(
    item,
    runtimeOptions.fetcher,
    runtimeOptions.retryWait,
    generation,
  ).then((completed) => {
    if (itemGenerations.get(item)?.token !== generation) return;

    const currentHref = findWishlistUrlElement(item)?.getAttribute("href") ?? null;
    if (currentHref !== href) {
      cancelRetryTimer(item);
      processVisibleItem(item);
      return;
    }

    if (completed || !needsProcessing(item, currentHref)) {
      cancelRetryTimer(item);
      intersectionObserver?.unobserve(item);
      return;
    }

    if (visibleItems.has(item)) {
      scheduleRetryCycle(item, href);
    }
  });
};

const observeItem = (item: HTMLElement) => {
  const href = findWishlistUrlElement(item)?.getAttribute("href") ?? null;
  if (!needsProcessing(item, href) || processingItems.get(item)?.href === href) return;
  intersectionObserver?.observe(item);
};

export const editItem = async (
  item: HTMLElement,
  fetcher: PointsFetcher = fetchPoints,
  wait?: RetryWait,
): Promise<boolean> => editItemForGeneration(item, fetcher, wait, Symbol());

const editItemForGeneration = async (
  item: HTMLElement,
  fetcher: PointsFetcher,
  wait: RetryWait | undefined,
  generation: symbol,
): Promise<boolean> => {
  const href = findWishlistUrlElement(item)?.getAttribute("href");
  if (href && processingItems.get(item)?.href === href) {
    return true;
  }

  const priceTarget = findWishlistPointTarget(item);
  if (!href || priceTarget == null) {
    return false;
  }
  if (!needsProcessing(item, href)) {
    return true;
  }

  removeExtensionElements(item);
  const state = { href, token: generation };
  itemGenerations.set(item, state);
  processingItems.set(item, state);

  const loadingSpinner = createLoadingSpinner();
  priceTarget.appendChild(loadingSpinner);
  let completed = false;

  try {
    const result = await fetchPointsWithRetry(createProductUrl(href), fetcher, wait);
    const currentHref = findWishlistUrlElement(item)?.getAttribute("href") ?? null;
    if (itemGenerations.get(item)?.token !== generation || currentHref !== href) {
      return false;
    }
    if (result.kind === "success" && result.points !== "") {
      priceTarget.appendChild(createPointDisplay(result.points));
    }
    if (result.kind === "success") {
      completed = true;
      processedItems.set(item, {
        href,
        outcome: result.points === "" ? "no-points" : "points",
      });
    }
  } catch (error) {
    if (itemGenerations.get(item)?.token === generation) {
      console.warn("Failed to process item:", error);
    }
  } finally {
    loadingSpinner.remove();
    if (processingItems.get(item)?.token === generation) {
      processingItems.delete(item);
    }
  }

  return completed;
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
  return pointElement;
};

export const findWishlistItemsInMutation = (
  mutation: Pick<MutationRecord, "addedNodes" | "target">,
): Set<HTMLElement> => {
  const items = new Set<HTMLElement>();

  const addRelatedItems = (node: Node) => {
    if (!(node instanceof HTMLElement)) return;

    if (node.matches("li")) {
      items.add(node);
    }

    const parentItem = node.closest("li");
    if (parentItem instanceof HTMLElement) {
      items.add(parentItem);
    }

    node.querySelectorAll("li").forEach((descendant) => {
      if (descendant instanceof HTMLElement) {
        items.add(descendant);
      }
    });
  };

  Array.from(mutation.addedNodes).forEach(addRelatedItems);
  addRelatedItems(mutation.target);

  return items;
};

const observer = new MutationObserver((mutations) => {
  const items = new Set<HTMLElement>();
  const hrefChangedItems = new Set<HTMLElement>();

  mutations.forEach((mutation) => {
    findWishlistItemsInMutation(mutation).forEach((item) => {
      items.add(item);
      if (mutation.type === "attributes") {
        hrefChangedItems.add(item);
      }
    });
  });

  items.forEach((item) => {
    if (hrefChangedItems.has(item)) {
      cancelRetryTimer(item);
      if (visibleItems.has(item)) {
        processVisibleItem(item);
        return;
      }
    }
    observeItem(item);
  });
});

export const cleanup = () => {
  if (intersectionObserver) {
    intersectionObserver.disconnect();
    intersectionObserver = null;
  }
  retryTimers.forEach(({ timer }) => runtimeOptions.cancelRetry(timer));
  retryTimers.clear();
  visibleItems = new WeakSet<HTMLElement>();
  runtimeOptions = defaultRuntimeOptions;
  observer.disconnect();
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", cleanup);
}
