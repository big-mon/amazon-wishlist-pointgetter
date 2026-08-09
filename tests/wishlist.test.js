const assert = require("node:assert/strict");

class FakeNode {
  constructor() {
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.parentElement = null;
    this.className = "";
    this.textContent = "";
    this.innerHTML = "";
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;

    this.parentElement.children = this.parentElement.children.filter(
      (child) => child !== this,
    );
    this.parentElement = null;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  matches() {
    return false;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  querySelectorAll() {
    return [];
  }
}

class FakeAnchor extends FakeNode {
  constructor(href) {
    super();
    this.setAttribute("href", href);
  }
}

class FakeItem extends FakeNode {
  constructor({ href, selectors }) {
    super();
    this.anchor = new FakeAnchor(href);
    this.anchor.parentElement = this;
    this.selectors = selectors;
  }

  matches(selector) {
    return selector === "li";
  }

  querySelector(selector) {
    if (selector === "h2.a-size-base .a-link-normal") {
      return this.anchor;
    }

    return this.selectors[selector] ?? null;
  }

  querySelectorAll(selector) {
    if (selector !== "[data-devola-element]") {
      return [];
    }

    return Object.values(this.selectors).flatMap((node) =>
      node.children.filter((child) => child.attributes["data-devola-element"]),
    );
  }
}

global.window = {
  addEventListener: () => {},
};

global.location = {
  protocol: "https:",
  host: "www.amazon.co.jp",
};

global.document = {
  createElement: () => new FakeNode(),
  getElementById: () => null,
};

global.HTMLElement = FakeNode;

let mutationObserverCallback;
global.MutationObserver = class {
  constructor(callback) {
    mutationObserverCallback = callback;
  }
  observe() {}
  disconnect() {}
};

let intersectionObserverCallback;
global.IntersectionObserver = class {
  constructor(callback) {
    intersectionObserverCallback = callback;
    this.observedItems = new Set();
  }

  observe(item) {
    this.observedItems.add(item);
  }

  unobserve(item) {
    this.observedItems.delete(item);
  }

  disconnect() {
    this.observedItems.clear();
  }
};

const {
  cleanup,
  doWishlist,
  editItem,
  findWishlistItemsInMutation,
  findWishlistPointTarget,
} = require("../src/wishlist");

const countPointBadges = (target) =>
  target.children.filter(
    (child) => child.attributes["data-devola-element"] === "points",
  ).length;

const pointResult = (points) => ({ kind: "success", points });
const transientFailure = { kind: "transient-failure" };
const terminalFailure = (status) => ({ kind: "terminal-failure", status });
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

(() => {
  const firstItem = new FakeItem({ href: "/dp/wrapped-1", selectors: {} });
  const secondItem = new FakeItem({ href: "/dp/wrapped-2", selectors: {} });
  const container = new FakeNode();
  container.matches = () => false;
  container.closest = () => null;
  container.querySelectorAll = (selector) =>
    selector === "li" ? [firstItem, secondItem] : [];

  assert.deepEqual(
    Array.from(
      findWishlistItemsInMutation({
        addedNodes: [container],
        target: container,
      }),
    ),
    [firstItem, secondItem],
    "discovers wishlist item descendants inside an added wrapper",
  );
})();

(() => {
  const legacyTarget = new FakeNode();
  const kindleTarget = new FakeNode();

  const legacyItem = new FakeItem({
    href: "/dp/legacy",
    selectors: {
      ".price-section .a-price": legacyTarget,
    },
  });

  const kindleItem = new FakeItem({
    href: "/dp/kindle",
    selectors: {
      '[id^="itemPrice_"] .a-price': kindleTarget,
    },
  });

  assert.equal(
    findWishlistPointTarget(legacyItem),
    legacyTarget,
    "uses the existing price selector when present",
  );
  assert.equal(
    findWishlistPointTarget(kindleItem),
    kindleTarget,
    "falls back to the Kindle wishlist selector",
  );
})();

const main = async () => {
  {
    const item = new FakeItem({
      href: "/dp/late-price-target",
      selectors: {},
    });
    const wrapper = new FakeNode();
    wrapper.querySelectorAll = (selector) => (selector === "li" ? [item] : []);
    global.document.getElementById = (id) => (id === "g-items" ? wrapper : null);

    let attempts = 0;
    doWishlist({
      fetcher: async () => {
        attempts += 1;
        return pointResult("25pt");
      },
    });

    intersectionObserverCallback([{ isIntersecting: true, target: item }]);
    await flushPromises();
    assert.equal(attempts, 0, "waits to fetch until the price target exists");

    const pointTarget = new FakeNode();
    item.appendChild(pointTarget);
    item.selectors[".price-section .a-price"] = pointTarget;
    mutationObserverCallback([
      { addedNodes: [pointTarget], target: item, type: "childList" },
    ]);
    await flushPromises();

    assert.equal(
      attempts,
      1,
      "fetches a visible item when mutation discovery finds its late price target",
    );
    assert.equal(
      countPointBadges(pointTarget),
      1,
      "renders points without another intersection callback",
    );

    const pointBadge = pointTarget.children.find(
      (child) => child.attributes["data-devola-element"] === "points",
    );
    mutationObserverCallback([
      { addedNodes: [pointBadge], target: pointTarget, type: "childList" },
    ]);
    await flushPromises();
    assert.equal(attempts, 1, "ignores its own point-display mutation");

    cleanup();
  }

  for (const [configuredDelay, expectedDelay] of [
    [10, 250],
    [60_000, 30_000],
  ]) {
    const item = new FakeItem({
      href: `/dp/delay-${configuredDelay}`,
      selectors: {
        ".price-section .a-price": new FakeNode(),
      },
    });
    const wrapper = new FakeNode();
    wrapper.querySelectorAll = (selector) => (selector === "li" ? [item] : []);
    global.document.getElementById = (id) => (id === "g-items" ? wrapper : null);

    let attempts = 0;
    const scheduled = [];
    const canceled = [];
    doWishlist({
      fetcher: async () => {
        attempts += 1;
        return transientFailure;
      },
      retryWait: async () => {},
      retryCycleDelayMs: configuredDelay,
      scheduleRetry: (callback, delay) => {
        const timer = { callback, delay };
        scheduled.push(timer);
        return timer;
      },
      cancelRetry: (timer) => canceled.push(timer),
    });

    intersectionObserverCallback([{ isIntersecting: true, target: item }]);
    await flushPromises();

    assert.equal(scheduled[0].delay, expectedDelay, `clamps ${configuredDelay}ms retry delay`);

    if (configuredDelay === 10) {
      intersectionObserverCallback([{ isIntersecting: false, target: item }]);
      assert.ok(canceled.includes(scheduled[0]), "leaving the viewport cancels the pending retry");

      scheduled[0].callback();
      await flushPromises();
      assert.equal(attempts, 3, "a canceled retry callback does not fetch again");
    }

    cleanup();
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/terminal-404",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    const wrapper = new FakeNode();
    wrapper.querySelectorAll = (selector) => (selector === "li" ? [item] : []);
    global.document.getElementById = (id) => (id === "g-items" ? wrapper : null);

    let attempts = 0;
    const scheduled = [];
    doWishlist({
      fetcher: async () => {
        attempts += 1;
        return terminalFailure(404);
      },
      retryWait: async () => {},
      scheduleRetry: (callback, delay) => {
        const timer = { callback, delay };
        scheduled.push(timer);
        return timer;
      },
    });

    intersectionObserverCallback([{ isIntersecting: true, target: item }]);
    await flushPromises();

    assert.equal(attempts, 1, "does not retry a terminal HTTP failure");
    assert.equal(scheduled.length, 0, "does not schedule another terminal retry cycle");
    assert.equal(countPointBadges(pointTarget), 0, "does not display points for a terminal failure");

    intersectionObserverCallback([{ isIntersecting: true, target: item }]);
    await flushPromises();
    assert.equal(attempts, 1, "keeps a terminal href completed across visibility events");

    item.anchor.setAttribute("href", "/dp/terminal-410");
    mutationObserverCallback([
      { addedNodes: [], target: item.anchor, type: "attributes" },
    ]);
    await flushPromises();
    assert.equal(attempts, 2, "processes a terminal item again after its href changes");

    cleanup();
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000012",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    const wrapper = new FakeNode();
    wrapper.querySelectorAll = (selector) => (selector === "li" ? [item] : []);
    global.document.getElementById = (id) => (id === "g-items" ? wrapper : null);

    let attempts = 0;
    let recovered = false;
    const scheduled = [];
    const canceled = [];

    doWishlist({
      fetcher: async () => {
        attempts += 1;
        return recovered ? pointResult("70pt") : transientFailure;
      },
      retryWait: async () => {},
      retryCycleDelayMs: 1_234,
      scheduleRetry: (callback, delay) => {
        const timer = { callback, delay };
        scheduled.push(timer);
        return timer;
      },
      cancelRetry: (timer) => canceled.push(timer),
    });

    intersectionObserverCallback([{ isIntersecting: true, target: item }]);
    await flushPromises();

    assert.equal(attempts, 3, "keeps three attempts in the first retry cycle");
    assert.equal(scheduled.length, 1, "schedules a visible failed item for a later cycle");
    assert.equal(scheduled[0].delay, 1_234, "uses the injected retry-cycle delay");

    recovered = true;
    scheduled[0].callback();
    await flushPromises();

    assert.equal(attempts, 4, "runs the delayed retry without a new intersection event");
    assert.equal(countPointBadges(pointTarget), 1, "renders points after delayed recovery");

    const hrefChangeTarget = new FakeNode();
    const hrefChangeItem = new FakeItem({
      href: "/dp/B000000013",
      selectors: {
        ".price-section .a-price": hrefChangeTarget,
      },
    });
    wrapper.querySelectorAll = (selector) =>
      selector === "li" ? [item, hrefChangeItem] : [];
    recovered = false;
    intersectionObserverCallback([{ isIntersecting: true, target: hrefChangeItem }]);
    await flushPromises();
    const pendingHrefTimer = scheduled.at(-1);

    hrefChangeItem.anchor.setAttribute("href", "/dp/B000000014");
    recovered = true;
    mutationObserverCallback([
      { addedNodes: [], target: hrefChangeItem.anchor, type: "attributes" },
    ]);
    await flushPromises();

    assert.ok(canceled.includes(pendingHrefTimer), "cancels the old href retry timer");
    assert.equal(
      countPointBadges(hrefChangeTarget),
      1,
      "processes a visible href change without another intersection event",
    );

    const cleanupItem = new FakeItem({
      href: "/dp/B000000015",
      selectors: {
        ".price-section .a-price": new FakeNode(),
      },
    });
    recovered = false;
    intersectionObserverCallback([{ isIntersecting: true, target: cleanupItem }]);
    await flushPromises();
    const pendingCleanupTimer = scheduled.at(-1);

    cleanup();
    assert.ok(canceled.includes(pendingCleanupTimer), "cleanup cancels pending item retries");
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000016",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    const wrapper = new FakeNode();
    wrapper.querySelectorAll = (selector) => (selector === "li" ? [item] : []);
    global.document.getElementById = (id) => (id === "g-items" ? wrapper : null);

    const requestedUrls = [];
    let resolveOldFetch;
    const oldFetch = new Promise((resolve) => {
      resolveOldFetch = resolve;
    });

    doWishlist({
      fetcher: async (url) => {
        requestedUrls.push(url);
        if (url.endsWith("B000000016")) return oldFetch;
        return pointResult("90pt");
      },
      retryWait: async () => {},
    });

    intersectionObserverCallback([{ isIntersecting: true, target: item }]);
    await flushPromises();

    intersectionObserverCallback([{ isIntersecting: true, target: item }]);
    await flushPromises();
    assert.equal(
      requestedUrls.length,
      1,
      "does not duplicate an unresolved generation for the same href",
    );

    item.anchor.setAttribute("href", "/dp/B000000017");
    mutationObserverCallback([
      { addedNodes: [], target: item.anchor, type: "attributes" },
    ]);
    await flushPromises();

    assert.deepEqual(
      requestedUrls,
      [
        "https://www.amazon.co.jp/dp/B000000016",
        "https://www.amazon.co.jp/dp/B000000017",
      ],
      "starts the new href generation before the old fetch resolves",
    );
    assert.equal(countPointBadges(pointTarget), 1, "renders the new href promptly");
    assert.match(
      pointTarget.children.find(
        (child) => child.attributes["data-devola-element"] === "points",
      ).children[0].textContent,
      /90pt/,
      "renders the new href result while the old generation is pending",
    );

    resolveOldFetch(pointResult("10pt"));
    await flushPromises();

    assert.equal(countPointBadges(pointTarget), 1, "keeps exactly the new href badge");
    assert.match(
      pointTarget.children.find(
        (child) => child.attributes["data-devola-element"] === "points",
      ).children[0].textContent,
      /90pt/,
      "ignores the old generation when it eventually resolves",
    );

    cleanup();
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000005",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    let attempts = 0;

    await editItem(
      item,
      async () => {
        attempts += 1;
        return attempts === 1 ? transientFailure : pointResult("35pt");
      },
      async () => {},
    );

    assert.equal(attempts, 2, "retries a transient failure");
    assert.equal(
      countPointBadges(pointTarget),
      1,
      "renders points after a transient retry succeeds",
    );
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000006",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    let attempts = 0;
    let recovered = false;
    const fetcher = async () => {
      attempts += 1;
      return recovered ? pointResult("45pt") : transientFailure;
    };

    await editItem(item, fetcher, async () => {});
    recovered = true;
    await editItem(item, fetcher, async () => {});

    assert.equal(attempts, 4, "stops the first run after three attempts and can retry later");
    assert.equal(
      countPointBadges(pointTarget),
      1,
      "does not permanently complete an item after retry exhaustion",
    );
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/html-significant-points",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    const points = '80pt <bonus> & "member"';

    await editItem(item, async () => pointResult(points));

    const pointBadge = pointTarget.children.find(
      (child) => child.attributes["data-devola-element"] === "points",
    );
    const pointsText = pointBadge.children[0];
    assert.equal(
      pointsText.className,
      "a-color-price devola-points-text",
      "renders point text in the expected nested span",
    );
    assert.equal(
      pointsText.textContent,
      points,
      "renders HTML-significant point text literally without interpretation",
    );
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000001",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });

    await editItem(item, async () => pointResult("20pt"));
    await editItem(item, async () => pointResult("20pt"));

    assert.equal(
      countPointBadges(pointTarget),
      1,
      "appends exactly one point badge per item",
    );
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000007",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    let attempts = 0;
    const fetcher = async () => {
      attempts += 1;
      return pointResult("55pt");
    };

    await editItem(item, fetcher);
    pointTarget.children.find(
      (child) => child.attributes["data-devola-element"] === "points",
    ).remove();
    await editItem(item, fetcher);

    assert.equal(attempts, 2, "reprocesses an item when its point badge is removed");
    assert.equal(countPointBadges(pointTarget), 1, "restores the removed point badge");
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000008",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    const requestedUrls = [];
    const fetcher = async (url) => {
      requestedUrls.push(url);
      return pointResult(url.endsWith("B000000009") ? "65pt" : "60pt");
    };

    await editItem(item, fetcher);
    item.anchor.setAttribute("href", "/dp/B000000009");
    await editItem(item, fetcher);

    assert.deepEqual(
      requestedUrls,
      [
        "https://www.amazon.co.jp/dp/B000000008",
        "https://www.amazon.co.jp/dp/B000000009",
      ],
      "reprocesses the same item when its product href changes",
    );
    assert.equal(countPointBadges(pointTarget), 1, "replaces the previous product badge");
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000002",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });

    await editItem(item, async () => pointResult(""));

    assert.equal(
      countPointBadges(pointTarget),
      0,
      "does not append a badge when fetchPoints returns an empty string",
    );
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000010",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });
    let attempts = 0;
    const fetcher = async () => {
      attempts += 1;
      return pointResult("");
    };

    await editItem(item, fetcher);
    await editItem(item, fetcher);

    assert.equal(attempts, 1, "keeps a successful no-points result terminal");
    assert.equal(countPointBadges(pointTarget), 0, "does not invent a no-points badge");

    item.anchor.setAttribute("href", "/dp/B000000011");
    await editItem(item, fetcher);
    assert.equal(attempts, 2, "reprocesses a no-points item only after its href changes");
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000004",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });

    await editItem(item, async () => transientFailure, async () => {});

    assert.equal(
      countPointBadges(pointTarget),
      0,
      "does not append a badge when fetchPoints returns the failure sentinel",
    );
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000003",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });

    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      await assert.doesNotReject(async () => {
        await editItem(
          item,
          async () => {
            throw new Error("boom");
          },
          async () => {},
        );
      });
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(
      countPointBadges(pointTarget),
      0,
      "swallows fetch errors so other items can continue",
    );
  }
};

main()
  .then(() => {
    console.log("Passed wishlist tests.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
