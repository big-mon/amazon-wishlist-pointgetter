const assert = require("node:assert/strict");
const { findPointNode } = require("../src/util");

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

console.log(`Passed ${cases.length} util tests.`);
