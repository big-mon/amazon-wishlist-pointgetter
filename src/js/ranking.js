let RANKING = {
  target: HTMLElement,

  // アイテム情報の取得の開始
  start: function() {
    this.setTarget();
    this.searchAndDestroy();
  },

  // 監視対象とするアイテムリストを設定
  setTarget: function() {
    RANKING.target = document.getElementById('zg-ordered-list');
  },

  // 対象リストに対してポイント情報を可視化
  searchAndDestroy: function() {
    let list = RANKING.target;
    $(list)
      .children('li')
      .each(function(index, element) {
        RANKING.editItem(element);
      });
  },

  // 対象の商品の情報を取得
  editItem: function(item) {
    // 商品のURLを取得
    let domain = location.protocol + '//' + location.host;
    let url = domain + $(item).find('.zg-item .a-link-normal').attr('href');

    // リンク先情報を取得
    fetch(url)
      .then(res => res.text())
      .then(data => {
        let points = $(data)
          .find(
            '#addToCart #pointsInsideBuyBox_feature_div span.a-color-price' // Normal Item
            + ', #addToCart #buybox span.a-color-price:not(.offer-price)' // Normal Item
            + ', .loyalty-points .a-align-bottom' // Kindle Item
          )
          .text()
          .replace(/\t/g, '')
          .replace(/ /g, '')
          .replace(/\r?\n/g, '');

          console.log(url);
          console.log(points);

        // ポイント情報タグを挿入
        $(item)
          .find('.zg-item .p13n-sc-price')
          .append(
            '<span class="add-point a-size-small" style="margin-left: .6rem;"><span class="a-color-price">'
              + points
              + '</span></span>'
          );
      });
  }
};
