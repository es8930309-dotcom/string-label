/**
 * 嘉友體育 穿線取拍系統（Google 試算表 + LINE 官方帳號）
 *
 * 1. 只需要改下面 CONFIG 這一段。
 * 2. 第一次貼上後，執行一次 setup()（建立「客人」「穿線紀錄」工作表）。
 * 3. 部署為「網頁應用程式」，把網址貼到 LINE Developers 的 Webhook URL，
 *    也貼到標籤 App 的「設定 → 雲端紀錄」。
 */
const CONFIG = {
  // LINE Developers → Messaging API → Channel access token (long-lived)
  LINE_TOKEN: '在這裡貼上 Channel access token',
  // 自己設定一組店家密碼（標籤 App 要填一樣的），不要告訴客人
  API_KEY: '在這裡設定店家密碼',
  SHOP_NAME: '嘉友體育',
  SHOP_INFO: '🏸 嘉友體育\n📍 地址：（請填寫）\n🕘 營業時間：（請填寫）\n📞 電話：（請填寫）',
  // 圖文選單其他按鈕的回覆：左邊是按鈕送出的文字，右邊是機器人回覆的內容（\n 是換行，可以放網址）
  REPLIES: {
    '臨打團': '🏸 臨打團\n📅 時間：（請填寫）\n📍 地點：（請填寫）\n💰 費用：（請填寫）\n✍️ 報名方式：（請填寫）',
    '羽技非凡教學': '🏸 羽技非凡教學\n📚 課程內容：（請填寫）\n📅 上課時間：（請填寫）\n💰 費用：（請填寫）\n✍️ 報名方式：（請填寫）',
  },
};

// ----------------------------------------------------------------------------
const SHEET_CUSTOMERS = '客人';
const SHEET_RECORDS = '穿線紀錄';
const C_HEAD = ['手機', '末三碼', '姓名', 'LINE名稱', 'LINE userId', '綁定時間', '備註'];
const R_HEAD = ['編號', '建立時間', '收拍日期', '標籤名字', '手機', '線種', '主線', '橫線', '預拉', '磅數', '狀態', '通知時間', '取拍時間', '備註'];
const ST = { DOING: '穿線中', READY: '待取拍', DONE: '已取拍' };
const MENU = { RACKET: '我的球拍', HISTORY: '穿線紀錄', CHANGE: '修改手機', INFO: '店家資訊' };

const WELCOME =
  `歡迎加入${CONFIG.SHOP_NAME} 🏸\n\n` +
  '請直接輸入您的手機號碼（例如 0912345678）完成綁定。\n' +
  '球拍穿好時，我們會用 LINE 通知您。';
const ASK_PHONE = '請輸入您的手機號碼完成綁定（10 碼，09 開頭，例如 0912345678）。';

// ---------- entry points ----------
function doGet() {
  return ContentService.createTextOutput('OK');
}

function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }

  // LINE webhook
  if (Array.isArray(body.events)) {
    body.events.forEach((ev) => {
      try { handleLineEvent(ev); } catch (err) { console.error(err && err.stack || err); }
    });
    return ContentService.createTextOutput('OK');
  }

  // label app API
  let out;
  try {
    if (!CONFIG.API_KEY || body.key !== CONFIG.API_KEY) throw new Error('店家密碼不正確');
    out = Object.assign({ ok: true }, handleApi(body.action, body));
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** 第一次使用、或更新程式後執行一次 */
function setup() {
  table(SHEET_CUSTOMERS, C_HEAD);
  const t = table(SHEET_RECORDS, R_HEAD);
  // 狀態欄做成下拉選單
  const col = t.h.indexOf('狀態') + 1;
  t.sh.getRange(2, col, t.sh.getMaxRows() - 1, 1).setDataValidation(statusRule());
  // 改狀態時自動處理（改成「待取拍」會傳 LINE 通知）
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const has = ScriptApp.getProjectTriggers().some((tr) => tr.getHandlerFunction() === 'onStatusEdit');
  if (!has) ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(book).onEdit().create();
  book.toast('設定完成：已加入「穿線系統」選單和狀態下拉選單', '嘉友穿線系統', 8);
}

function statusRule() {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList([ST.DOING, ST.READY, ST.DONE], true).setAllowInvalid(false).build();
}

// ---------- spreadsheet menu (computer use) ----------
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏸 穿線系統')
    .addItem('穿好了，通知客人取拍（選取的列）', 'menuReady')
    .addItem('已取拍（選取的列）', 'menuPickup')
    .addSeparator()
    .addItem('重新設定（更新程式後執行）', 'setup')
    .addToUi();
}

function selectedRecordIds() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sh = book.getActiveSheet();
  if (sh.getName() !== SHEET_RECORDS) throw new Error(`請先到「${SHEET_RECORDS}」分頁，選取要處理的列`);
  const idCol = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0].indexOf('編號') + 1;
  const ids = [];
  sh.getActiveRangeList().getRanges().forEach((rg) => {
    for (let r = rg.getRow(); r < rg.getRow() + rg.getNumRows(); r++) {
      if (r < 2) continue;
      const id = sh.getRange(r, idCol).getDisplayValue();
      if (id && ids.indexOf(id) < 0) ids.push(id);
    }
  });
  if (!ids.length) throw new Error('請先點選要處理的那一列（可以一次選好幾列）');
  return ids;
}

function menuReady() {
  const ui = SpreadsheetApp.getUi();
  try {
    const out = withLock(() => selectedRecordIds().map((id) => {
      const { r } = findRecord(id);
      const res = markReady(id);
      const who = r['標籤名字'];
      if (res.needChoice) return `${who}：末三碼有好幾位客人，請先在「手機」欄填完整手機號碼，再按一次`;
      return res.notified ? `${who}：已傳 LINE 通知 ✅` : `${who}：已改成待取拍（${res.reason}）`;
    }));
    ui.alert('通知取拍', out.join('\n'), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert(String(err.message || err));
  }
}

function menuPickup() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ids = withLock(() => selectedRecordIds().map((id) => { markPickup(id); return id; }));
    SpreadsheetApp.getActiveSpreadsheet().toast(`已取拍 ${ids.length} 筆`, '嘉友穿線系統', 5);
  } catch (err) {
    ui.alert(String(err.message || err));
  }
}

/** 由 setup() 安裝的觸發條件：手動把「狀態」改成待取拍 / 已取拍時執行 */
function onStatusEdit(e) {
  const rg = e && e.range;
  if (!rg || rg.getSheet().getName() !== SHEET_RECORDS || rg.getRow() < 2 || rg.getNumRows() !== 1) return;
  const sh = rg.getSheet();
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  if (rg.getColumn() !== head.indexOf('狀態') + 1) return;
  const id = sh.getRange(rg.getRow(), head.indexOf('編號') + 1).getDisplayValue();
  const value = String(e.value || '');
  if (!id) return;
  const book = SpreadsheetApp.getActiveSpreadsheet();
  try {
    if (value === ST.READY) {
      const res = withLock(() => markReady(id));
      if (res.needChoice) {
        rg.setValue(e.oldValue || ST.DOING);
        book.toast('末三碼有好幾位客人：請先在「手機」欄填完整手機號碼，再改狀態', '沒有傳通知', 10);
      } else {
        book.toast(res.notified ? '已傳 LINE 通知客人取拍 ✅' : res.reason, '待取拍', 6);
      }
    } else if (value === ST.DONE) {
      withLock(() => markPickup(id));
      book.toast('已記錄取拍時間', '已取拍', 4);
    }
  } catch (err) {
    book.toast(String(err.message || err), '錯誤', 10);
  }
}

// ---------- sheet helpers ----------
function table(name, head) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sh = book.getSheetByName(name);
  if (!sh) sh = book.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, sh.getMaxRows(), head.length).setNumberFormat('@'); // keep leading zeros
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const values = sh.getDataRange().getDisplayValues();
  const h = values[0];
  const rows = values.slice(1).map((r, i) => {
    const o = { _row: i + 2 };
    h.forEach((k, j) => { o[k] = r[j]; });
    return o;
  });
  return { sh, h, rows };
}

function appendRow(t, obj) {
  const r = t.sh.getLastRow() + 1;
  const range = t.sh.getRange(r, 1, 1, t.h.length);
  range.setNumberFormat('@');
  range.setValues([t.h.map((k) => (obj[k] === undefined || obj[k] === null ? '' : String(obj[k])))]);
  const o = Object.assign({ _row: r }, obj);
  t.rows.push(o);
  return o;
}

function updateRow(t, row, patch) {
  Object.keys(patch).forEach((k) => {
    const j = t.h.indexOf(k);
    if (j < 0) return;
    const cell = t.sh.getRange(row._row, j + 1);
    cell.setNumberFormat('@');
    cell.setValue(String(patch[k]));
    row[k] = String(patch[k]);
  });
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function now() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm');
}

function normPhone(text) {
  let d = String(text || '').replace(/[\s\-()]/g, '');
  if (/^\+?886/.test(d)) d = '0' + d.replace(/^\+?886/, '');
  return /^09\d{8}$/.test(d) ? d : '';
}

function maskPhone(p) {
  return p ? `${p.slice(0, 4)}-***-${p.slice(7)}` : '';
}

function customerName(c) {
  return (c && (c['姓名'] || c['LINE名稱'])) || '';
}

function recordLine(r) {
  return [r['線種'], r['磅數']].filter(Boolean).join(' ');
}

function shortDate(d) {
  const m = String(d || '').match(/\d{4}[-/](\d{2})[-/](\d{2})/);
  return m ? `${m[1]}/${m[2]}` : d;
}

// ---------- LINE ----------
function lineApi(path, payload, method) {
  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/' + path, {
    method: method || 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.LINE_TOKEN },
    payload: payload ? JSON.stringify(payload) : undefined,
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 300) throw new Error(`LINE ${code}: ${res.getContentText()}`);
  const txt = res.getContentText();
  return txt ? JSON.parse(txt) : {};
}

function reply(token, text) {
  if (!token) return;
  lineApi('message/reply', { replyToken: token, messages: [{ type: 'text', text }] });
}

function push(userId, text) {
  lineApi('message/push', { to: userId, messages: [{ type: 'text', text }] });
}

function profileName(userId) {
  try { return lineApi('profile/' + userId, null, 'get').displayName || ''; } catch (err) { return ''; }
}

function handleLineEvent(ev) {
  const uid = ev.source && ev.source.userId;
  if (!uid || (ev.source.type && ev.source.type !== 'user')) return;
  const cache = CacheService.getScriptCache();
  const customers = table(SHEET_CUSTOMERS, C_HEAD);
  const cust = customers.rows.find((c) => c['LINE userId'] === uid);

  if (ev.type === 'follow') {
    reply(ev.replyToken, cust
      ? `歡迎回來 🏸 您已綁定手機 ${maskPhone(cust['手機'])}。`
      : WELCOME);
    return;
  }
  if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;

  const text = String(ev.message.text || '').trim();
  const phone = normPhone(text);
  const rebinding = cache.get('rebind:' + uid);

  if (phone && (!cust || rebinding)) {
    reply(ev.replyToken, bindPhone(uid, phone));
    cache.remove('rebind:' + uid);
    return;
  }

  if (CONFIG.REPLIES && Object.prototype.hasOwnProperty.call(CONFIG.REPLIES, text)) {
    reply(ev.replyToken, CONFIG.REPLIES[text]);
    return;
  }

  switch (text) {
    case MENU.INFO:
      reply(ev.replyToken, CONFIG.SHOP_INFO);
      return;
    case MENU.CHANGE:
      cache.put('rebind:' + uid, '1', 600);
      reply(ev.replyToken, '請輸入新的手機號碼（10 碼，09 開頭）。\n10 分鐘內有效。');
      return;
    case MENU.RACKET:
      reply(ev.replyToken, cust ? myRackets(cust) : ASK_PHONE);
      return;
    case MENU.HISTORY:
      reply(ev.replyToken, cust ? myHistory(cust) : ASK_PHONE);
      return;
  }

  if (!cust) {
    // remind unbound customers, but not on every message
    if (!cache.get('nag:' + uid)) {
      cache.put('nag:' + uid, '1', 21600);
      reply(ev.replyToken, /\d/.test(text) ? '號碼格式不太對喔。' + ASK_PHONE : ASK_PHONE);
    }
  }
  // other messages: no auto reply, so the shop can chat by hand
}

function bindPhone(uid, phone) {
  return withLock(() => {
    const t = table(SHEET_CUSTOMERS, C_HEAD);
    const owner = t.rows.find((c) => c['手機'] === phone);
    const mine = t.rows.find((c) => c['LINE userId'] === uid);
    if (owner && owner['LINE userId'] && owner['LINE userId'] !== uid) {
      return '這個號碼已經綁定其他 LINE 帳號了。如需更改，請洽店家。';
    }
    if (owner && owner !== mine) {
      // number was added by the shop without LINE: attach this LINE account
      updateRow(t, owner, { 'LINE userId': uid, 'LINE名稱': profileName(uid), '綁定時間': now() });
      if (mine) updateRow(t, mine, { 'LINE userId': '', '備註': '已改綁 ' + maskPhone(phone) });
    } else if (mine) {
      const old = mine['手機'];
      updateRow(t, mine, { '手機': phone, '末三碼': phone.slice(-3), '綁定時間': now() });
      // move this customer's records to the new number
      const rec = table(SHEET_RECORDS, R_HEAD);
      rec.rows.filter((r) => old && r['手機'] === old).forEach((r) => updateRow(rec, r, { '手機': phone }));
    } else {
      const name = profileName(uid);
      appendRow(t, {
        '手機': phone, '末三碼': phone.slice(-3), '姓名': name, 'LINE名稱': name,
        'LINE userId': uid, '綁定時間': now(),
      });
    }
    return `綁定完成 ✅\n手機：${maskPhone(phone)}\n\n球拍穿好時會用 LINE 通知您。\n下方選單可以查詢「我的球拍」和「穿線紀錄」。`;
  });
}

function myRackets(cust) {
  const list = table(SHEET_RECORDS, R_HEAD).rows
    .filter((r) => r['手機'] === cust['手機'] && (r['狀態'] === ST.DOING || r['狀態'] === ST.READY))
    .reverse();
  if (!list.length) return '目前沒有寄放在店裡的球拍喔 🏸';
  return '🏸 您的球拍\n\n' + list.map((r) =>
    (r['狀態'] === ST.READY ? '✅ 可以取拍了' : '⏳ 穿線中') +
    `\n${recordLine(r)}（${shortDate(r['收拍日期'])} 收拍）`).join('\n\n');
}

function myHistory(cust) {
  const list = table(SHEET_RECORDS, R_HEAD).rows.filter((r) => r['手機'] === cust['手機']).reverse().slice(0, 5);
  if (!list.length) return '還沒有穿線紀錄喔。';
  return '📋 最近的穿線紀錄\n\n' + list.map((r) => `${shortDate(r['收拍日期'])}　${recordLine(r)}`).join('\n');
}

// ---------- label app API ----------
function handleApi(action, b) {
  switch (action) {
    case 'ping': return { shop: CONFIG.SHOP_NAME };
    case 'lookup': return { customers: lookup(b.q) };
    case 'create': return withLock(() => createRecord(b));
    case 'list': return { records: listOpen() };
    case 'ready': return withLock(() => markReady(b.id, b.phone));
    case 'pickup': return withLock(() => markPickup(b.id));
    default: throw new Error('未知的動作：' + action);
  }
}

function custOut(c) {
  return { phone: c['手機'], name: customerName(c), bound: !!c['LINE userId'] };
}

function lookup(q) {
  q = String(q || '').trim();
  if (!q) return [];
  const rows = table(SHEET_CUSTOMERS, C_HEAD).rows.filter((c) => c['手機']);
  const hit = /^\d{3}$/.test(q)
    ? rows.filter((c) => c['末三碼'] === q)
    : rows.filter((c) => customerName(c).indexOf(q) >= 0 || c['LINE名稱'].indexOf(q) >= 0 || c['手機'] === normPhone(q));
  return hit.slice(0, 10).map(custOut);
}

function createRecord(b) {
  const name = String(b.name || '').trim();
  if (!name) throw new Error('缺少末三碼或名字');
  let phone = normPhone(b.phone);
  if (!phone) {
    const hit = lookup(name);
    if (hit.length === 1) phone = hit[0].phone;
  }
  const t = table(SHEET_RECORDS, R_HEAD);
  const id = 'R' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  appendRow(t, {
    '編號': id, '建立時間': now(), '收拍日期': b.date || '', '標籤名字': name, '手機': phone,
    '線種': b.string || '', '主線': b.main || '', '橫線': b.cross || '', '預拉': b.pre ? b.pre + '%' : '',
    '磅數': b.tension || '', '狀態': ST.DOING,
  });
  t.sh.getRange(t.sh.getLastRow(), t.h.indexOf('狀態') + 1).setDataValidation(statusRule());
  return { id, phone };
}

function listOpen() {
  const cust = {};
  table(SHEET_CUSTOMERS, C_HEAD).rows.forEach((c) => { if (c['手機']) cust[c['手機']] = c; });
  return table(SHEET_RECORDS, R_HEAD).rows
    .filter((r) => r['狀態'] === ST.DOING || r['狀態'] === ST.READY)
    .reverse().slice(0, 100)
    .map((r) => {
      const c = cust[r['手機']];
      return {
        id: r['編號'], date: r['收拍日期'], name: r['標籤名字'], phone: r['手機'],
        customer: c ? customerName(c) : '', bound: !!(c && c['LINE userId']),
        string: r['線種'], tension: r['磅數'], status: r['狀態'], notified: r['通知時間'],
      };
    });
}

function findRecord(id) {
  const t = table(SHEET_RECORDS, R_HEAD);
  const r = t.rows.find((x) => x['編號'] === id);
  if (!r) throw new Error('找不到這筆紀錄：' + id);
  return { t, r };
}

function markReady(id, phoneIn) {
  const { t, r } = findRecord(id);
  let phone = normPhone(phoneIn) || r['手機'];
  if (!phone) {
    const hit = lookup(r['標籤名字']);
    if (hit.length > 1) return { needChoice: true, candidates: hit };
    if (hit.length === 1) phone = hit[0].phone;
  }
  if (phone && phone !== r['手機']) updateRow(t, r, { '手機': phone });

  const c = phone && table(SHEET_CUSTOMERS, C_HEAD).rows.find((x) => x['手機'] === phone);
  let notified = false, reason = '';
  if (!c || !c['LINE userId']) {
    reason = '客人還沒綁定 LINE，沒有傳通知';
  } else {
    try {
      push(c['LINE userId'],
        `${customerName(c) ? customerName(c) + ' 您好，' : ''}您的球拍穿好了 🏸\n\n` +
        `線種：${r['線種'] || '-'}\n磅數：${r['磅數'] || '-'}\n\n歡迎來${CONFIG.SHOP_NAME}取拍！`);
      notified = true;
    } catch (err) {
      reason = '通知失敗：' + (err.message || err);
    }
  }
  updateRow(t, r, Object.assign({ '狀態': ST.READY }, notified ? { '通知時間': now() } : {}));
  return { notified, reason };
}

function markPickup(id) {
  const { t, r } = findRecord(id);
  updateRow(t, r, { '狀態': ST.DONE, '取拍時間': now() });
  return {};
}
