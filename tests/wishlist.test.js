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
    this.selectors = selectors;
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
};

global.MutationObserver = class {
  constructor() {}
  observe() {}
  disconnect() {}
};

const {
  editItem,
  findWishlistPointTarget,
} = require("../src/wishlist");

const countPointBadges = (target) =>
  target.children.filter(
    (child) => child.attributes["data-devola-element"] === "points",
  ).length;

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
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000001",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });

    await editItem(item, async () => "20pt");
    await editItem(item, async () => "20pt");

    assert.equal(
      countPointBadges(pointTarget),
      1,
      "appends exactly one point badge per item",
    );
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000002",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });

    await editItem(item, async () => "");

    assert.equal(
      countPointBadges(pointTarget),
      0,
      "does not append a badge when fetchPoints returns an empty string",
    );
  }

  {
    const pointTarget = new FakeNode();
    const item = new FakeItem({
      href: "/dp/B000000004",
      selectors: {
        ".price-section .a-price": pointTarget,
      },
    });

    await editItem(item, async () => "取得失敗");

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
        await editItem(item, async () => {
          throw new Error("boom");
        });
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
