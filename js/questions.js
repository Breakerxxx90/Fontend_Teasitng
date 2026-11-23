'use strict';
(async function () {
  var body = $('#askBody'), dots = $('#dots'), topBack = $('#topBack');
  var me, questions = [], idx = 0, answers = {}, lastPct = 0;

  $('#signout').addEventListener('click', leave);
  $('#again').addEventListener('click', leave);
  function leave() { clearSession(); location.href = 'index.html'; }

  try { me = await api('/api/me'); }
  catch (e) {
    if (e.status === 401) { clearSession(); location.replace('index.html'); return; }
    body.append(h('div', { class: 'qcard' }, h('div', { class: 'empty-q' }, e.message)));
    return;
  }
  $('#whoami').textContent = 'Questions with you, ' + me.username + '.';
  if (me.submitted) { showThanks(); return; }

  try { questions = (await api('/api/questions')).questions; }
  catch (e) { body.append(h('div', { class: 'qcard' }, h('div', { class: 'empty-q' }, e.message))); return; }

  try { answers = JSON.parse(localStorage.getItem('qa_draft') || '{}') || {}; } catch (e) { answers = {}; }
  render();

  function saveDraft() { try { localStorage.setItem('qa_draft', JSON.stringify(answers)); } catch (e) {} }

  function showThanks() {
    $('#view-ask').hidden = true;
    $('#view-thanks').hidden = false;
    $('#thanksMsg').textContent = 'ขอบคุณ ' + me.username + ' ส่งคำตอบเรียบร้อยแล้ว';
  }

  function renderDots() {
    dots.replaceChildren();
    questions.forEach(function (_, i) { dots.append(h('i', { class: i === idx ? 'on' : '' })); });
  }

  function goBack() { if (idx > 0) { idx--; render(); } }
  topBack.addEventListener('click', goBack);

  function render() {
    body.replaceChildren();
    if (!questions.length) {
      topBack.classList.add('invisible'); dots.replaceChildren();
      body.append(h('div', { class: 'qcard' }, h('div', { class: 'empty-q' }, 'ยังไม่มีคำถามในระบบ กรุณากลับมาใหม่ภายหลัง')));
      return;
    }
    var q = questions[idx], last = idx === questions.length - 1;
    var canBack = idx >= 1;                       // Back appears from question 2 onward
    topBack.classList.toggle('invisible', !canBack);

    var ta = h('textarea', { id: 'answer', placeholder: 'พิมพ์คำตอบที่นี่…', 'aria-label': 'คำตอบ', maxlength: '2000' });
    ta.value = answers[q.id] || '';
    var err = h('p', { class: 'qerr', role: 'alert' });
    var next = h('button', { class: 'btn-next', type: 'button' });
    next.innerHTML = (last ? 'Submit' : 'Next question') + ' ' + ICON_NEXT;
    function sync() { next.classList.toggle('is-empty', !ta.value.trim()); }
    ta.addEventListener('input', function () { answers[q.id] = ta.value; saveDraft(); err.textContent = ''; sync(); });

    next.addEventListener('click', async function () {
      if (q.required && !ta.value.trim()) { err.textContent = 'ข้อนี้ต้องตอบก่อนไปต่อ'; ta.focus(); return; }
      if (!last) { idx++; render(); return; }
      next.disabled = true;
      try {
        await api('/api/submit', {
          method: 'POST',
          body: { answers: questions.map(function (qq) { return { question_id: qq.id, answer: (answers[qq.id] || '').trim() }; }) }
        });
        try { localStorage.removeItem('qa_draft'); } catch (e) {}
        showThanks();
      } catch (e) {
        if (e.status === 409) { showThanks(); return; }
        if (e.status === 401) { clearSession(); location.replace('index.html'); return; }
        err.textContent = e.message;
        next.disabled = false;
      }
    });

    var bar = h('div', { class: 'abar' });
    if (canBack) {
      var back = h('button', { class: 'btn-back', type: 'button', onclick: goBack });
      back.innerHTML = ICON_BACK + ' Back';
      bar.append(back);
    }
    bar.append(next);

    var pct = Math.round(((idx + 1) / questions.length) * 100);
    var fill = h('i', { style: 'width:' + lastPct + '%' });
    var prog = h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'ความคืบหน้า', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, fill);
    requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = pct + '%'; }); });
    lastPct = pct;

    body.append(h('div', { class: 'qcard' },
      prog,
      h('div', { class: 'qtop' }, h('span', { class: 'dot' }), 'Question', h('span', { class: 'count' }, (idx + 1) + ' / ' + questions.length)),
      h('p', { class: 'qtext' }, q.text),
      h('div', { class: 'qmeta' }, h('span', { class: 'tag' + (q.required ? ' req' : '') }, q.required ? 'ต้องตอบ' : 'ไม่บังคับ')),
      h('div', { class: 'abox' }, ta, bar),
      err));
    sync(); renderDots(); ta.focus();
  }
})();
