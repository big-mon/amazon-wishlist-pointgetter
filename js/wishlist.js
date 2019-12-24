$(document).ready(function() {
  $("#g-items > li").each(function(index, element) {
    getProductInfo(element);
  });
});

// 対象の商品の情報を取得
function getProductInfo(item) {
  let domain = location.protocol + "//" + location.host;
  let url =
    domain +
    $(item)
      .find("h3.a-size-base a")
      .attr("href");

  // リンク先情報を取得
  fetch(url)
    .then(res => res.text())
    .then(data => {
      var points = $(data)
        .find(".loyalty-points")
        .text()
        .replace(/\t/g, "")
        .replace(/ /g, "")
        .replace(/\r?\n/g, "");

      // ポイント情報タグを挿入
      $(item)
        .find(".price-section")
        .append(
          '<div class="add-point"><span class="a-text-bold">' +
            points +
            "</span></div>"
        );
    });
}
