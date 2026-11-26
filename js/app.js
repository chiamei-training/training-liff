// 所有 LIFF 頁面共用：LIFF 初始化、呼叫 GAS API、畫面訊息。
(function () {
  const cfg = window.LIFF_CONFIG;

  async function init() {
    if (!cfg || !cfg.liffId || /請填入/.test(cfg.liffId)) throw new Error('js/config.js 尚未填入 LIFF ID');
    await liff.init({ liffId: cfg.liffId });
    if (!liff.isLoggedIn()) {
      // 在電腦或外部瀏覽器開啟時需要先登入 LINE
      liff.login({ redirectUri: location.href });
      return new Promise(function () { });
    }
  }

  // 以 text/plain 送出 JSON：屬於「簡單請求」，GAS 不需處理 CORS 預檢
  async function api(action, data) {
    const body = Object.assign({ source: 'liff', idToken: liff.getIDToken(), action: action }, data || {});
    let res;
    try {
      res = await fetch(cfg.gasUrl, { method: 'POST', body: JSON.stringify(body) });
    } catch (e) {
      throw new Error('無法連線到伺服器，請確認網路後再試一次。');
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error('伺服器回應異常，請稍後再試。');
    }
    if (!json.ok) {
      const err = new Error(json.error || '發生錯誤');
      err.code = json.code;
      throw err;
    }
    return json;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showFatal(message) {
    document.getElementById('app').innerHTML =
      '<div class="card error-card"><h2>無法開啟</h2><p>' + esc(message).replace(/\n/g, '<br>') + '</p>' +
      (window.liff && liff.isInClient && liff.isInClient() ? '<button class="btn" onclick="liff.closeWindow()">關閉</button>' : '') +
      '</div>';
  }

  let toastTimer;
  function toast(message, isError) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ''; }, isError ? 5000 : 2500);
  }

  window.App = { init: init, api: api, esc: esc, showFatal: showFatal, toast: toast };
})();
