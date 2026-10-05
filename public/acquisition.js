// Метки рекламного перехода: API привяжет их к пользователю при регистрации.
// Подключается на лендинге, промо-страницах и в приложении, чтобы метки
// сохранялись, на какую бы страницу ни вела реклама.
(function () {
  var cookieName = 'socstat_utm';
  var params = new URLSearchParams(window.location.search);
  // yclid Директ добавляет сам, даже когда в объявлении нет UTM-меток.
  var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'rb_clickid', 'yclid'];
  var data = { path: window.location.pathname, ts: Date.now() };
  var hasMarks = false;
  keys.forEach(function (key) {
    var value = params.get(key);
    if (value) { data[key] = value.slice(0, 200); hasMarks = true; }
  });

  var hasCookie = document.cookie.split('; ').some(function (item) { return item.indexOf(cookieName + '=') === 0; });
  if (!hasMarks) {
    // Без меток запоминаем внешний referrer, но только первый и не поверх меток.
    var referrerHost = '';
    try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch (error) { referrerHost = ''; }
    var isOwnOrAuth = referrerHost === window.location.hostname || referrerHost === 'oauth.vk.com' || referrerHost === 'id.vk.com';
    if (hasCookie || !referrerHost || isOwnOrAuth) return;
    data.referrer = referrerHost.slice(0, 200);
  }

  document.cookie = cookieName + '=' + encodeURIComponent(JSON.stringify(data)) + '; path=/; max-age=' + 30 * 24 * 3600 + '; samesite=lax';
})();
