// 課程編輯頁：沒有 ?no= 參數時顯示課程清單，有參數時顯示編輯表單。僅管理者可用。
(function () {
  const esc = App.esc;
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  const courseNo = params.get('no');

  App.init()
    .then(function () { return courseNo ? showForm(courseNo) : showList('待補資料', ''); })
    .catch(function (e) { App.showFatal(e.message); });

  // ---------- 清單 ----------

  async function showList(status, q) {
    document.getElementById('title').textContent = '編輯課程';
    app.innerHTML =
      '<div class="tabs">' +
      ['待補資料', '待發佈'].map(function (s) {
        return '<button class="tab' + (!q && s === status ? ' active' : '') + '" data-status="' + s + '">' + s + '</button>';
      }).join('') + '</div>' +
      '<form class="search" id="searchForm"><input type="search" id="q" placeholder="搜尋課程代號或名稱" value="' + esc(q) + '">' +
      '<button class="btn small">搜尋</button></form>' +
      '<div id="list"><div class="loading">載入中…</div></div>';

    app.querySelectorAll('.tab').forEach(function (b) {
      b.onclick = function () { showList(b.dataset.status, ''); };
    });
    document.getElementById('searchForm').onsubmit = function (e) {
      e.preventDefault();
      const kw = document.getElementById('q').value.trim();
      showList(status, kw);
    };

    const listEl = document.getElementById('list');
    try {
      const r = await App.api('listCourses', { status: status, q: q });
      if (!r.courses.length) {
        listEl.innerHTML = '<p class="empty">' + (q ? '找不到符合「' + esc(q) + '」的課程。' : '沒有「' + esc(status) + '」的課程。') + '</p>';
        return;
      }
      listEl.innerHTML =
        '<p class="hint">共 ' + r.total + ' 門' + (r.total > r.courses.length ? '，顯示前 ' + r.courses.length + ' 門，請用搜尋縮小範圍' : '') + '</p>' +
        r.courses.map(function (c) {
          const when = c.classDate ? c.classDate + ' ' + c.startTime + (c.endTime ? '～' + c.endTime : '') : '尚未設定上課時間';
          return '<a class="item" href="course-edit.html?no=' + encodeURIComponent(c.courseNo) + '">' +
            '<div class="item-top"><span class="code">' + esc(c.courseNo) + '</span>' + badge(c.status) + '</div>' +
            '<div class="item-name">' + esc(c.name) + '</div>' +
            '<div class="item-sub">' + esc(when) + (c.instructor ? '　' + esc(c.instructor) : '') + '</div></a>';
        }).join('');
    } catch (e) {
      listEl.innerHTML = '<p class="empty error-text">' + esc(e.message) + '</p>';
    }
  }

  function badge(status) {
    const cls = { '待補資料': 'warn', '待發佈': 'ok', '歷史': 'muted' }[status] || 'info';
    return '<span class="badge ' + cls + '">' + esc(status || '—') + '</span>';
  }

  // ---------- 表單 ----------

  async function showForm(no) {
    const r = await App.api('getCourse', { courseNo: no });
    const c = r.course;
    document.getElementById('title').textContent = c.courseNo;

    app.innerHTML =
      '<div class="card">' +
      '<div class="item-top"><span class="code">' + esc(c.courseNo) + '</span><span id="status">' + badge(c.status) + '</span></div>' +
      '<h2>' + esc(c.name) + '</h2>' +
      '<dl class="info">' +
      info('主講人', c.instructor) + info('時數', c.hours === '' ? '' : c.hours + ' 小時') +
      info('評量方式', c.evalNames) + info('主要對象', c.mainTarget) +
      '</dl><p class="hint">以上資料來自 MIS，如需修改請在 MIS 修改。</p></div>' +

      '<form class="card" id="form">' +
      '<label>上課日期<span class="req">*</span><input type="date" id="classDate" value="' + esc(toInputDate(c.classDate)) + '"></label>' +
      '<div class="row">' +
      '<label>開始時間<span class="req">*</span><input type="time" id="startTime" value="' + esc(c.startTime) + '"></label>' +
      '<label>結束時間<span class="req">*</span><input type="time" id="endTime" value="' + esc(c.endTime) + '"></label>' +
      '</div><p class="hint" id="durationHint"></p>' +
      '<label>地點<span class="req">*</span>' + locationSelect(r.locations, c.location) + '</label>' +
      '<label>課程大綱<textarea id="outline" rows="6" maxlength="2000" placeholder="選填，會顯示在課程通知上">' + esc(c.outline) + '</textarea></label>' +
      '<p class="hint">標 <span class="req">*</span> 的欄位都填好後，課程狀態會變成「待發佈」；可先儲存部分資料。</p>' +
      '<button class="btn" id="saveBtn">儲存</button>' +
      '<a class="btn secondary" href="course-edit.html">回課程清單</a>' +
      '</form>';

    const hours = Number(c.hours);
    const updateHint = function () {
      const s = document.getElementById('startTime').value;
      const e = document.getElementById('endTime').value;
      const el = document.getElementById('durationHint');
      if (!s || !e) { el.textContent = ''; return; }
      const mins = toMinutes(e) - toMinutes(s);
      if (mins <= 0) { el.textContent = '結束時間必須晚於開始時間'; el.className = 'hint error-text'; return; }
      const h = Math.round(mins / 6) / 10;
      el.className = 'hint';
      el.textContent = '上課 ' + h + ' 小時' + (hours && h !== hours ? '（MIS 時數為 ' + hours + ' 小時，請確認）' : '');
    };
    document.getElementById('startTime').oninput = updateHint;
    document.getElementById('endTime').oninput = updateHint;
    updateHint();

    document.getElementById('form').onsubmit = async function (ev) {
      ev.preventDefault();
      const btn = document.getElementById('saveBtn');
      btn.disabled = true;
      btn.textContent = '儲存中…';
      try {
        const saved = await App.api('saveCourse', {
          courseNo: c.courseNo,
          classDate: document.getElementById('classDate').value,
          startTime: document.getElementById('startTime').value,
          endTime: document.getElementById('endTime').value,
          location: document.getElementById('location').value,
          outline: document.getElementById('outline').value
        });
        document.getElementById('status').innerHTML = badge(saved.course.status);
        App.toast('已儲存，狀態：' + saved.course.status);
      } catch (e) {
        App.toast(e.message, true);
      } finally {
        btn.disabled = false;
        btn.textContent = '儲存';
      }
    };
  }

  // 選項來自 Admin_Config.course_locations；課程原本的地點不在選項中時仍保留顯示
  function locationSelect(options, current) {
    const list = options.slice();
    if (current && list.indexOf(current) < 0) list.unshift(current);
    return '<select id="location"><option value="">請選擇地點</option>' +
      list.map(function (l) {
        return '<option value="' + esc(l) + '"' + (l === current ? ' selected' : '') + '>' + esc(l) +
          (options.indexOf(l) < 0 ? '（原設定）' : '') + '</option>';
      }).join('') + '</select>';
  }

  function info(label, value) {
    return value ? '<dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd>' : '';
  }

  function toInputDate(d) {
    return d ? d.replace(/\//g, '-') : '';
  }

  function toMinutes(t) {
    const p = t.split(':');
    return Number(p[0]) * 60 + Number(p[1]);
  }
})();
