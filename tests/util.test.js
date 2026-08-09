const assert = require("node:assert/strict");
const { fetchPoints, fetchPointsWithRetry, findPointNode } = require("../src/util");

const createElement = ({ textContent = "", parentTextContent, closestTextContent } = {}) => ({
  textContent,
  parentElement: parentTextContent
    ? {
        textContent: parentTextContent,
      }
    : null,
  closest: () =>
    closestTextContent
      ? {
          textContent: closestTextContent,
        }
      : null,
});

const createRoot = (selectorMap) => ({
  querySelectorAll: (selector) => selectorMap[selector] || [],
});

const cases = [
  {
    name: "prefers loyalty points over earlier a-color-price nodes",
    root: createRoot({
      "#addToCart #pointsInsideBuyBox_feature_div span.a-color-price": [
        createElement({ textContent: "50pt" }),
      ],
      "#addToCart #buyBoxInner span.a-color-price:not(.offer-price)": [
        createElement({ textContent: "￥1,980" }),
      ],
    }),
    expected: "50pt",
  },
  {
    name: "ignores offer-price nodes in the buy box",
    root: createRoot({
      "#addToCart #buyBoxInner span.a-color-price:not(.offer-price)": [
        createElement({ textContent: "30pt", parentTextContent: "ポイント 30pt" }),
      ],
    }),
    expected: "30pt",
  },
  {
    name: "does not return unrelated price labels from the broad fallback selector",
    root: createRoot({
      "#addToCart #buyBoxInner span.a-color-price:not(.offer-price)": [
        createElement({ textContent: "￥1,980" }),
        createElement({ textContent: "税込" }),
      ],
    }),
    expected: null,
  },
  {
    name: "supports legacy kindle point markup",
    root: createRoot({
      ".loyalty-points .a-align-bottom": [createElement({ textContent: "70pt" })],
    }),
    expected: "70pt",
  },
  {
    name: "supports current kindle point markup",
    root: createRoot({
      "#Ebooks-desktop-KINDLE_ALC-prices-loyaltyPoints .a-color-price": [
        createElement({ textContent: "90pt" }),
      ],
    }),
    expected: "90pt",
  },
  {
    name: "supports logged-in all inclusive points markup",
    root: createRoot({
      "#points_feature_div > .a-color-price": [
        createElement({ textContent: "62ポイント (2.5%)" }),
      ],
    }),
    expected: "62ポイント (2.5%)",
  },
  {
    name: "supports point feature containers outside the add to cart buy box",
    root: createRoot({
      '[id*="point" i] .a-color-price, [class*="point" i] .a-color-price, [data-feature-name*="point" i] .a-color-price': [
        createElement({ textContent: "118pt" }),
      ],
    }),
    expected: "118pt",
  },
  {
    name: "supports the regular points feature div",
    root: createRoot({
      '[id*="point" i] span, [class*="point" i] span, [data-feature-name*="point" i] span': [
        createElement({
          textContent: "118pt",
          closestTextContent: "ポイント:118pt",
        }),
      ],
    }),
    expected: "118pt",
  },
  {
    name: "skips point container labels before the point value",
    root: createRoot({
      '[id*="point" i] span, [class*="point" i] span, [data-feature-name*="point" i] span': [
        createElement({
          textContent: "Amazonポイント",
          closestTextContent: "Amazonポイント118pt",
        }),
        createElement({
          textContent: "118pt",
          closestTextContent: "Amazonポイント118pt",
        }),
      ],
    }),
    expected: "118pt",
  },
  {
    name: "ignores point navigation labels without point values",
    root: createRoot({
      '[id*="point" i] span, [class*="point" i] span, [data-feature-name*="point" i] span': [
        createElement({ textContent: "Amazonポイント" }),
      ],
    }),
    expected: null,
  },
];

for (const testCase of cases) {
  const node = findPointNode(testCase.root);
  assert.equal(node?.textContent ?? null, testCase.expected, testCase.name);
}

const main = async () => {
  const originalFetch = global.fetch;
  const originalWarn = console.warn;
  const originalAbortSignalTimeout = AbortSignal.timeout;
  console.warn = () => {};

  try {
    for (const [status, expectedKind] of [
      [404, "terminal-failure"],
      [410, "terminal-failure"],
      [408, "transient-failure"],
      [429, "transient-failure"],
      [500, "transient-failure"],
      [503, "transient-failure"],
    ]) {
      global.fetch = async () => ({ ok: false, status });
      const result = await fetchPoints(`https://www.amazon.co.jp/dp/status-${status}`);

      assert.equal(result.kind, expectedKind, `classifies HTTP ${status}`);
      if (expectedKind === "terminal-failure") {
        assert.equal(result.status, status, `retains terminal HTTP ${status}`);
      }
    }

    const receivedSignals = [];
    const requestedTimeouts = [];
    let retryWaits = 0;
    AbortSignal.timeout = (delay) => {
      requestedTimeouts.push(delay);
      return new AbortController().signal;
    };
    global.fetch = async (_url, options) => {
      receivedSignals.push(options.signal);
      const error = new Error("request timed out");
      error.name = "TimeoutError";
      throw error;
    };

    const timeoutResult = await fetchPointsWithRetry(
      "https://www.amazon.co.jp/dp/timeout",
      fetchPoints,
      async () => {
        retryWaits += 1;
      },
    );

    assert.equal(timeoutResult.kind, "transient-failure", "treats timeouts as transient");
    assert.equal(receivedSignals.length, 3, "retries a timed-out request");
    assert.equal(retryWaits, 2, "waits between timeout retries");
    assert.deepEqual(requestedTimeouts, [10_000, 10_000, 10_000], "uses a 10-second timeout");
    assert.ok(
      receivedSignals.every((signal) => signal instanceof AbortSignal),
      "passes an AbortSignal to every fetch attempt",
    );
  } finally {
    global.fetch = originalFetch;
    AbortSignal.timeout = originalAbortSignalTimeout;
    console.warn = originalWarn;
  }
};

main()
  .then(() => {
    console.log(`Passed ${cases.length} parser cases and fetch behavior tests.`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
