'use strict';
(async function () {
  var S = { tab: 'users', userId: null, search: '', delUser: false, editingId: null, delQ: null };

  var loginView = $('#loginView'), dashView = $('#dashView'), panel = $('#adminPanel');

  function showLogin() { loginView.hidden = false; dashView.hidden = true; $('#adminUser').focus(); }
  function showDash() { loginView.hidden = true; dashView.hidden = false; render(); }

  async function guard(fn) {
    try { return await fn(); }
    catch (e) { if (e.status === 401) { clearAdminToken(); showLogin(); return null; } panel.replaceChildren(h('p', { class: 'err' }, e.message)); return null; }
  }

  // ---- login / logout
  $('#adminLogin').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var err = $('#adminErr'); err.textContent = '';
    try { var r = await api('/api/admin/login', { method: 'POST', body: { username: $('#adminUser').value.trim(), password: $('#pw').value } }); setAdminToken(r.token); $('#pw').value = ''; showDash(); }
    catch (e) { err.textContent = e.message; }
  });
  $('#logout').addEventListener('click', async function () {
    try { await api('/api/admin/logout', { method: 'POST', body: {} }); } catch (e) {}
    clearAdminToken();
    showLogin();
  });

  // ---- tabs
  var tabU = $('#tab-users'), tabQ = $('#tab-q');
  tabU.addEventListener('click', function () { S.tab = 'users'; S.userId = null; render(); });
  tabQ.addEventListener('click', function () { S.tab = 'q'; render(); });

  async function render() {
    tabU.setAttribute('aria-selected', String(S.tab === 'users'));
    tabQ.setAttribute('aria-selected', String(S.tab === 'q'));
    panel.replaceChildren();
    await guard(async function () {
      if (S.tab === 'users') { if (S.userId) await renderDetail(); else await renderUsers(); }
      else await renderQuestions();
    });
  }

  // ---- users list
  async function renderUsers() {
    var users = (await api('/api/admin/users')).users;
    var done = users.filter(function (u) { return u.submitted_at; }).length;
    var listBox = h('ul', { class: 'ulist' });
    var search = h('input', { class: 'search', type: 'search', id: 'userSearch', placeholder: 'ค้นหาชื่อผู้ใช้', 'aria-label': 'ค้นหาชื่อผู้ใช้' });
    search.value = S.search;

    function fill() {
      var q = S.search.trim().toLowerCase();
      var rows = users.filter(function (u) { return !q || u.username.toLowerCase().indexOf(q) !== -1; });
      listBox.replaceChildren();
      if (!rows.length) { listBox.append(h('li', { class: 'none' }, users.length ? 'ไม่พบชื่อที่ค้นหา' : 'ยังไม่มีผู้ใช้สมัครเข้ามา')); return; }
      rows.forEach(function (u) {
        listBox.append(h('li', {},
          h('button', { class: 'uitem', type: 'button', onclick: function () { S.userId = u.id; S.delUser = false; render(); } },
            h('span', { class: 'uname' }, u.username),
            h('span', { class: 'umeta' },
              h('span', { class: 'badge' + (u.submitted_at ? ' ok' : '') }, u.submitted_at ? 'ตอบแล้ว' : 'ยังไม่ตอบ'),
              fmtTime(u.submitted_at || u.created_at)))));
      });
    }
    search.addEventListener('input', function () { S.search = search.value; fill(); });
    fill();

    panel.append(
      h('div', { class: 'stats' },
        h('span', {}, 'สมัครทั้งหมด ', h('b', {}, String(users.length)), ' คน'),
        h('span', {}, 'ตอบแล้ว ', h('b', {}, String(done)), ' คน')),
      h('div', { class: 'toolbar' }, search,
        h('button', { class: 'btn', type: 'button', onclick: render }, 'รีเฟรช'),
        h('button', { class: 'btn', type: 'button', onclick: downloadCsv }, 'ส่งออก CSV')),
      listBox);
  }

  // ---- one user's answers
  async function renderDetail() {
    var data;
    try { data = await api('/api/admin/users/' + S.userId); }
    catch (e) { if (e.status === 404) { S.userId = null; return renderUsers(); } throw e; }
    var u = data.user;
    var dl = h('dl', {});
    if (!data.answers.length) dl.append(h('p', { class: 'none' }, 'ผู้ใช้คนนี้ยังไม่ได้ส่งคำตอบ'));
    data.answers.forEach(function (a, i) {
      dl.append(h('div', {}, h('dt', {}, (i + 1) + '. ' + a.question_text), h('dd', {}, a.answer || '—')));
    });
    var del = h('button', { class: 'btn danger mt', type: 'button', onclick: async function () {
      if (!S.delUser) { S.delUser = true; render(); setTimeout(function () { if (S.delUser) { S.delUser = false; render(); } }, 3000); return; }
      S.delUser = false;
      await api('/api/admin/users/' + u.id, { method: 'DELETE' });
      S.userId = null; render();
    } }, S.delUser ? 'กดอีกครั้งเพื่อลบผู้ใช้นี้' : 'ลบผู้ใช้นี้');

    panel.append(
      h('button', { class: 'btn sm', type: 'button', onclick: function () { S.userId = null; render(); } }, '← รายชื่อทั้งหมด'),
      h('div', { class: 'detail' },
        h('h2', {}, u.username),
        h('div', { class: 'umeta' },
          h('span', { class: 'badge' + (u.submitted_at ? ' ok' : '') }, u.submitted_at ? 'ตอบแล้ว' : 'ยังไม่ตอบ'),
          'สมัครเมื่อ ' + fmtTime(u.created_at),
          u.submitted_at ? 'ส่งคำตอบเมื่อ ' + fmtTime(u.submitted_at) : ''),
        dl, del));
  }

  // ---- questions
  async function renderQuestions() {
    var list = (await api('/api/admin/questions')).questions;
    var newText = h('textarea', { id: 'newQ', placeholder: 'พิมพ์คำถามใหม่ เช่น คุณชอบอะไรที่สุด?', 'aria-label': 'คำถามใหม่', maxlength: '500' });
    var newReq = h('input', { type: 'checkbox', id: 'newReq', checked: true });
    var msg = h('span', { class: 'err', role: 'alert' });
    var add = h('button', { class: 'btn primary', type: 'button', onclick: async function () {
      var t = newText.value.trim();
      if (!t) { msg.textContent = 'พิมพ์คำถามก่อนกดเพิ่ม'; newText.focus(); return; }
      try { await api('/api/admin/questions', { method: 'POST', body: { text: t, required: newReq.checked } }); render(); }
      catch (e) { msg.textContent = e.message; }
    } }, 'เพิ่มคำถาม');
    panel.append(h('div', { class: 'addbox' }, newText,
      h('div', { class: 'row' }, h('label', { class: 'check' }, newReq, 'ต้องตอบ'), add, msg)));

    if (!list.length) { panel.append(h('p', { class: 'none' }, 'ยังไม่มีคำถาม เพิ่มข้อแรกด้านบนได้เลย')); return; }
    var ul = h('ol', { class: 'qlist' });
    list.forEach(function (q, i) {
      var li = h('li', { class: 'qitem' }, h('span', { class: 'qnum' }, String(i + 1)));
      if (S.editingId === q.id) {
        var t = h('textarea', { 'aria-label': 'แก้ไขคำถาม', maxlength: '500' }); t.value = q.text;
        var r = h('input', { type: 'checkbox', checked: q.required });
        li.append(h('div', { class: 'editbox' }, t,
          h('div', { class: 'row' }, h('label', { class: 'check' }, r, 'ต้องตอบ'),
            h('button', { class: 'btn primary sm', type: 'button', onclick: async function () {
              var v = t.value.trim(); if (!v) { t.focus(); return; }
              await api('/api/admin/questions/' + q.id, { method: 'PUT', body: { text: v, required: r.checked } });
              S.editingId = null; render();
            } }, 'บันทึก'),
            h('button', { class: 'btn sm', type: 'button', onclick: function () { S.editingId = null; render(); } }, 'ยกเลิก'))));
      } else {
        var confirming = S.delQ === q.id;
        li.append(h('div', { class: 'qbody' }, h('p', {}, q.text), h('span', { class: 'badge' }, q.required ? 'ต้องตอบ' : 'เว้นว่างได้')));
        li.append(h('div', { class: 'actions' },
          h('button', { class: 'btn sm', type: 'button', disabled: i === 0, 'aria-label': 'เลื่อนขึ้น', onclick: async function () { await api('/api/admin/questions/' + q.id + '/move', { method: 'POST', body: { dir: -1 } }); render(); } }, '↑'),
          h('button', { class: 'btn sm', type: 'button', disabled: i === list.length - 1, 'aria-label': 'เลื่อนลง', onclick: async function () { await api('/api/admin/questions/' + q.id + '/move', { method: 'POST', body: { dir: 1 } }); render(); } }, '↓'),
          h('button', { class: 'btn sm', type: 'button', onclick: function () { S.editingId = q.id; render(); } }, 'แก้ไข'),
          h('button', { class: 'btn sm danger', type: 'button', onclick: async function () {
            if (!confirming) { S.delQ = q.id; render(); setTimeout(function () { if (S.delQ === q.id) { S.delQ = null; render(); } }, 3000); return; }
            S.delQ = null; await api('/api/admin/questions/' + q.id, { method: 'DELETE' }); render();
          } }, confirming ? 'กดอีกครั้งเพื่อลบ' : 'ลบ')));
      }
      ul.append(li);
    });
    panel.append(ul);
    panel.append(h('p', { class: 'note' }, 'การแก้ไขหรือลบคำถามไม่กระทบคำตอบที่เก็บไว้แล้ว (ระบบจดข้อความคำถามไว้ตอนที่ผู้ใช้ตอบ)'));
  }

  // ---- CSV export (needs the admin header, so a plain <a href> no longer works)
  async function downloadCsv() {
    await guard(async function () {
      var res = await fetch(apiUrl('/api/admin/export.csv'), { headers: { 'X-Admin-Token': getAdminToken() } });
      if (!res.ok) { var e = new Error('ส่งออกไม่สำเร็จ'); e.status = res.status; throw e; }
      var url = URL.createObjectURL(await res.blob());
      var a = h('a', { href: url, download: 'answers.csv' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
  }

  // ---- start
  try { await api('/api/admin/me'); showDash(); } catch (e) { showLogin(); }
})();