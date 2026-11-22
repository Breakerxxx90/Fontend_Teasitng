'use strict';

function $(sel, root) { return (root || document).querySelector(sel); }

function appendKid(e, c) {
  if (c == null || c === false) return;
  if (Array.isArray(c)) { c.forEach(function (x) { appendKid(e, x); }); return; }
  e.append(c.nodeType ? c : document.createTextNode(String(c)));
}

/* h('div', {class: 'x', onclick: fn}, 'text', child) builds elements without innerHTML */
function h(tag, attrs) {
  var e = document.createElement(tag);
  var a = attrs || {};
  Object.keys(a).forEach(function (k) {
    var v = a[k];
    if (k === 'class') e.className = v;
    else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  });
  for (var i = 2; i < arguments.length; i++) appendKid(e, arguments[i]);
  return e;
}

var ICON_NEXT = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 3l18 9-18 9 4-9z"/></svg>';
var ICON_BACK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 3 3 12l18 9-4-9z"/></svg>';

function apiUrl(path) {
  return ((window.APP_CONFIG && window.APP_CONFIG.API_BASE) || '').replace(/\/+$/, '') + path;
}
function getAdminToken() { try { return sessionStorage.getItem('qa_admin') || ''; } catch (e) { return ''; } }
function setAdminToken(t) { try { sessionStorage.setItem('qa_admin', t); } catch (e) {} }
function clearAdminToken() { try { sessionStorage.removeItem('qa_admin'); } catch (e) {} }

function getToken() { try { return localStorage.getItem('qa_token') || ''; } catch (e) { return ''; } }
function setSession(token) { try { localStorage.setItem('qa_token', token); return true; } catch (e) { return false; } }
function clearSession() { try { localStorage.removeItem('qa_token'); localStorage.removeItem('qa_draft'); } catch (e) {} }

/* JSON fetch helper. Throws Error with .status and a readable message. */
async function api(path, opts) {
  var o = opts || {};
  var headers = { 'Content-Type': 'application/json' };
  var tok = getToken();
  if (tok) headers['X-User-Token'] = tok;
  var atok = getAdminToken();
  if (atok) headers['X-Admin-Token'] = atok;
  var res;
  try {
    res = await fetch(apiUrl(path), {
      method: o.method || 'GET',
      headers: headers,
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      credentials: 'omit'
    });
  } catch (e) {
    var ne = new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง');
    ne.status = 0;
    throw ne;
  }
  var data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    var err = new Error((data && data.error) || 'เกิดข้อผิดพลาด');
    err.status = res.status;
    throw err;
  }
  return data;
}

function fmtTime(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString('th-TH');
}
