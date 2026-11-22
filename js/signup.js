'use strict';
(async function () {
  // Already signed up on this browser? Go straight to the questions.
  if (getToken()) {
    try { await api('/api/me'); location.replace('questions.html'); return; }
    catch (e) { if (e.status === 401) clearSession(); }
  }

  var form = $('#signupForm'), input = $('#username'), err = $('#signupErr'), btn = $('#signupBtn');
  input.addEventListener('input', function () { err.textContent = ''; });

  form.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    var name = input.value.trim();
    if (!name) { err.textContent = 'กรุณาใส่ชื่อก่อนเข้าใช้งาน'; input.focus(); return; }
    btn.disabled = true;
    try {
      var res = await api('/api/signup', { method: 'POST', body: { username: name } });
      if (!setSession(res.token)) { err.textContent = 'เบราว์เซอร์นี้ไม่อนุญาตให้เก็บข้อมูล ลองปิดโหมดส่วนตัวแล้วเปิดใหม่'; btn.disabled = false; return; }
      location.href = 'questions.html';
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
      input.focus();
    }
  });
})();
