var RANKING = {
  target: HTMLElement,

  // アイテム情報の取得の開始
  start: function() {
    this.setTarget();
    this.searchAndDestroy();
  },

  // 監視対象とするアイテムリストを設定
  setTarget: function() {
    RANKING.target = document.getElementById("zg-ordered-list");
  },

  // 対象リストに対してポイント情報を可視化
  searchAndDestroy: function() {
    var list = RANKING.target;
    $(list)
      .children("li")
      .each(function(index, element) {
        RANKING.editItem(element);
      });
  },

  // 対象の商品の情報を取得
  editItem: function(item) {
    // 商品のURLを取得
    let domain = location.protocol + "//" + location.host;
    let url =
      domain +
      $(item)
        .find(".zg-item .a-link-normal")
        .attr("href");

    // リンク先情報を取得
    fetch(url)
      .then(res => res.text())
      .then(data => {
        var points = $(data)
          .find(
            ".loyalty-points, #buyNewInner .a-unordered-list li:first-child"
          )
          .text()
          .replace(/\t/g, "")
          .replace(/ /g, "")
          .replace(/\r?\n/g, "");

        // ポイント情報タグを挿入
        $(item)
          .find(".zg-item")
          .append(
            '<div class="add-point"><span class="a-size-small a-color-secondary a-color-price">' +
              points +
              "</span></div>"
          );
      });
  }
};
