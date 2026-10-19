const assert = require("node:assert/strict");

// Node has no DOMParser. This fixture is only the HTML/CSS surface parsePoints uses.
if (typeof globalThis.DOMParser !== "function") {
  const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

  const decode = (value) =>
    value
      .replace(/&nbsp;/gi, "\u00a0")
      .replace(/&#160;/g, "\u00a0")
      .replace(/&#xa0;/gi, "\u00a0")
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&");

  class MiniElement {
    constructor(localName, attrs, parentElement) {
      this.localName = localName;
      this.attrs = attrs;
      this.parentElement = parentElement;
      this.children = [];
      this.content = [];
    }

    get textContent() {
      return this.content
        .map((part) => (typeof part === "string" ? part : part.textContent))
        .join("");
    }

    querySelectorAll(selector) {
      const found = [];
      const visit = (node) => {
        for (const child of node.children) {
          if (matchesSelector(child, selector)) found.push(child);
          visit(child);
        }
      };
      visit(this);
      return found;
    }
  }

  const parseAttrs = (source) => {
    const attrs = {};
    const attrPattern = /([^\s"'=<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+)))?/g;
    for (const match of source.matchAll(attrPattern)) {
      attrs[match[1].toLowerCase()] = decode(match[2] ?? match[3] ?? match[4] ?? "");
    }
    return attrs;
  };

  const parseCompound = (compound) => {
    const simples = [];
    let index = 0;
    while (index < compound.length) {
      const char = compound[index];
      if (char === ".") {
        const name = /^[\w-]+/.exec(compound.slice(index + 1))[0];
        simples.push({ kind: "class", name });
        index += 1 + name.length;
      } else if (char === "#") {
        const name = /^[\w-]+/.exec(compound.slice(index + 1))[0];
        simples.push({ kind: "id", name });
        index += 1 + name.length;
      } else if (char === "[") {
        const end = compound.indexOf("]", index);
        const body = compound.slice(index + 1, end);
        const match = /^([^\s~|^$*]+)(\*=|=)"([^"]*)"(?:\s+([iI]))?$/.exec(body);
        simples.push({
          kind: "attr",
          name: match[1].toLowerCase(),
          op: match[2],
          value: match[3],
          insensitive: match[4]?.toLowerCase() === "i",
        });
        index = end + 1;
      } else if (char === ":") {
        const match = /^:not\(([^)]*)\)/.exec(compound.slice(index));
        simples.push({ kind: "not", inner: match[1] });
        index += match[0].length;
      } else if (/[a-z]/i.test(char)) {
        const name = /^[a-z][\w-]*/i.exec(compound.slice(index))[0];
        simples.push({ kind: "tag", name: name.toLowerCase() });
        index += name.length;
      } else {
        index += 1;
      }
    }
    return simples;
  };

  const classTokens = (element) =>
    new Set((element.attrs.class ?? "").split(/\s+/).filter(Boolean));

  const matchesCompound = (element, compound) =>
    parseCompound(compound).every((simple) => {
      if (simple.kind === "tag") return element.localName === simple.name;
      if (simple.kind === "id") return element.attrs.id === simple.name;
      if (simple.kind === "class") return classTokens(element).has(simple.name);
      if (simple.kind === "not") return !matchesCompound(element, simple.inner);
      const actual = element.attrs[simple.name];
      if (actual == null) return false;
      const left = simple.insensitive ? actual.toLowerCase() : actual;
      const right = simple.insensitive ? simple.value.toLowerCase() : simple.value;
      return simple.op === "*=" ? left.includes(right) : left === right;
    });

  const selectorParts = (selector) => {
    const parts = [];
    let buffer = "";
    let depth = 0;
    let combinator = null;
    const push = (nextCombinator) => {
      const compound = buffer.trim();
      if (compound) parts.push({ combinator, compound });
      buffer = "";
      combinator = nextCombinator;
    };
    for (const char of selector) {
      if (char === "[" || char === "(") depth += 1;
      else if (char === "]" || char === ")") depth -= 1;
      if (depth === 0 && (char === ">" || char === " ")) {
        if (char === " " && (buffer.trim() === "" || buffer.endsWith(" "))) continue;
        push(char === ">" ? ">" : " ");
        continue;
      }
      buffer += char;
    }
    push(null);
    return parts;
  };

  const matchesComplex = (element, selector) => {
    const parts = selectorParts(selector);
    let index = parts.length - 1;
    let current = element;
    if (!matchesCompound(current, parts[index].compound)) return false;
    while (index > 0) {
      const combinator = parts[index].combinator;
      const compound = parts[index - 1].compound;
      if (combinator === ">") {
        current = current.parentElement;
        if (!current || !matchesCompound(current, compound)) return false;
      } else {
        let ancestor = current.parentElement;
        while (ancestor && !matchesCompound(ancestor, compound)) ancestor = ancestor.parentElement;
        if (!ancestor) return false;
        current = ancestor;
      }
      index -= 1;
    }
    return true;
  };

  const matchesSelector = (element, selector) =>
    selector.split(",").some((part) => matchesComplex(element, part.trim()));

  class MiniDocument extends MiniElement {
    constructor() {
      super("#document", {}, null);
    }
  }

  class MiniDOMParser {
    parseFromString(html) {
      const document = new MiniDocument();
      const htmlElement = new MiniElement("html", {}, document);
      const body = new MiniElement("body", {}, htmlElement);
      document.children.push(htmlElement);
      htmlElement.children.push(body);
      const stack = [body];
      const tokenPattern = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)([^>]*?)(\/?)>|([^<]+)/g;
      for (const match of html.matchAll(tokenPattern)) {
        if (match[1]) {
          const name = match[1].toLowerCase();
          while (stack.length > 1 && stack.at(-1).localName !== name) stack.pop();
          if (stack.length > 1) stack.pop();
        } else if (match[2]) {
          const name = match[2].toLowerCase();
          const element = new MiniElement(name, parseAttrs(match[3] ?? ""), stack.at(-1));
          const parent = stack.at(-1);
          parent.children.push(element);
          parent.content.push(element);
          if (!match[4] && !voidTags.has(name)) stack.push(element);
        } else if (match[5]) {
          stack.at(-1).content.push(decode(match[5]));
        }
      }
      return document;
    }
  }

  globalThis.DOMParser = MiniDOMParser;
}

const { fetchPoints, fetchPointsWithRetry, findPointNode, parsePoints } = require("../src/util.ts");

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

const parseCases = [
  {
    name: "skips an earlier price inside the buy box points block",
    html: '<div id="addToCart"><div id="pointsInsideBuyBox_feature_div"><span class="a-color-price">￥1,980</span><span class="a-color-price">40pt</span></div></div>',
    expected: "40pt",
  },
  {
    name: "uses the point value inside a wide span instead of the whole sentence",
    html: '<div id="point-box"><span>説明文が長いです。価格は1,980円。付与は<span>15pt</span>です。</span></div>',
    expected: "15pt",
  },
  {
    name: "reads a point value separated by a non-breaking space",
    html: '<div id="points_feature_div"><span class="a-color-price">40&nbsp;pt</span></div>',
    expected: "40pt",
  },
];

for (const testCase of parseCases) {
  assert.equal(parsePoints(testCase.html), testCase.expected, testCase.name);
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
    console.log(
      `Passed ${cases.length} parser cases, ${parseCases.length} parsePoints cases, and fetch behavior tests.`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
