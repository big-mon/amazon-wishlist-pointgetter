var WISHLIST = {
  target: HTMLElement,
  observer: MutationObserver,

  // アイテム情報の取得と監視の開始
  start: function() {
    this.setTarget();
    this.searchAndDestroy();
    this.setObserver();
    this.startObserv();
  },

  // 監視対象とするアイテムリストを設定
  setTarget: function() {
    WISHLIST.target = document.getElementById("g-items");
  },

  // DOM変更を検知した場合の処理
  setObserver: function() {
    WISHLIST.observer = new MutationObserver(records => {
      records.forEach(function(record) {
        // 追加されたノードを対象にループ
        Array.from(record.addedNodes).forEach(function(node) {
          // liの場合に処理を実行
          if (node.nodeName === "LI") WISHLIST.editItem(node);
        });
      });
    });
  },

  // 対象リストに対してポイント情報を可視化
  searchAndDestroy: function() {
    var list = WISHLIST.target;
    $(list)
      .children("li")
      .each(function(index, element) {
        WISHLIST.editItem(element);
      });
  },

  // DOM変更の監視を開始
  startObserv: function() {
    WISHLIST.observer.observe(WISHLIST.target, { childList: true });
  },

  // 対象の商品の情報を取得
  editItem: function(item) {
    // 商品のURLを取得
    let domain = location.protocol + "//" + location.host;
    let url =
      domain +
      $(item)
        .find("h3.a-size-base .a-link-normal")
        .attr("href");

    // リンク先情報を取得
    fetch(url)
      .then(res => res.text())
      .then(data => {
        var points = $(data)
          .find(
            "#pointsInsideBuyBox_feature_div .a-color-price" +
              ", .a-unordered-list .selected .a-button-text .a-color-price:not(.a-size-base)"
          )
          .text()
          .replace(/\t/g, "")
          .replace(/ /g, "")
          .replace(/\r?\n/g, "");

        // ポイント情報タグを挿入
        $(item)
          .find(".price-section .a-price")
          .append(
            '<span class="add-point a-size-small" style="margin-left: .6rem;"><span class="a-text-bold a-color-price">' +
              points +
              "</span></span>"
          );
      });
  }
};
