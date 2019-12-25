$(document).ready(function() {
  const target = document.getElementById("g-items");
  $(target)
    .children("li")
    .each(function(index, element) {
      editItem(element);
    });

  // DOM変更を検知した場合の処理
  const observer = new MutationObserver(records => {
    records.forEach(function(record) {
      // 追加されたノードを対象にループ
      Array.from(record.addedNodes).forEach(function(node) {
        // liの場合に処理を実行
        if (node.nodeName === "LI") editItem(node);
      });
    });
  });

  // DOM変更の監視を開始
  observer.observe(target, { childList: true });
});

// 対象の商品の情報を取得
function editItem(item) {
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
        .find(".loyalty-points, #buyNewInner .a-unordered-list li:first-child")
        .text()
        .replace(/\t/g, "")
        .replace(/ /g, "")
        .replace(/\r?\n/g, "");

      // ポイント情報タグを挿入
      $(item)
        .addClass("pointChecked")
        .find(".price-section")
        .append(
          '<div class="add-point"><span class="a-text-bold a-color-price">' +
            points +
            "</span></div>"
        );
    });
}
