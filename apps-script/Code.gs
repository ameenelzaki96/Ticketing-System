/**
 * FleetOo Installation Tickets — Google Apps Script backend
 * ---------------------------------------------------------
 * Stores tickets and technicians in the Google Sheet this script is bound to.
 * Deploy as a Web App (Execute as: Me, Who has access: Anyone).
 *
 * SECURITY: change ACCESS_KEY below to your own long random string.
 * The same key goes at the end of the link you send Mustafa (…/#YOUR_KEY).
 */
const ACCESS_KEY = 'CHANGE-ME-to-a-long-random-string';

const TICKET_SHEET = 'Tickets';
const TECH_SHEET = 'Technicians';
const TICKET_COLS = ['id', 'createdAt', 'client', 'phone', 'locations', 'devices',
  'notes', 'raw', 'status', 'technician', 'updatedAt', 'closedAt', 'history'];
const TECH_COLS = ['name', 'phone', 'area'];
const STATUSES = ['new', 'assigned', 'in_progress', 'closed', 'cancelled'];

/* ---------- HTTP entry points ---------- */

function doGet(e) {
  return handle_(() => {
    checkKey_(e.parameter.key);
    return { tickets: readAll_(TICKET_SHEET, TICKET_COLS), technicians: readAll_(TECH_SHEET, TECH_COLS) };
  });
}

function doPost(e) {
  return handle_(() => {
    const body = JSON.parse(e.postData.contents || '{}');
    checkKey_(body.key);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (body.action) {
        case 'create': return { ticket: createTicket_(body.ticket || {}) };
        case 'update': return { ticket: updateTicket_(body.id, body.changes || {}, body.by) };
        case 'saveTechs': return { technicians: saveTechs_(body.technicians || []) };
        default: throw new Error('Unknown action');
      }
    } finally {
      lock.releaseLock();
    }
  });
}

/* ---------- Actions ---------- */

function createTicket_(t) {
  const sh = sheet_(TICKET_SHEET, TICKET_COLS);
  const now = new Date().toISOString();
  const id = nextId_(sh);
  const row = {
    id: id, createdAt: now,
    client: str_(t.client), phone: str_(t.phone), locations: str_(t.locations),
    devices: str_(t.devices), notes: str_(t.notes), raw: str_(t.raw),
    status: 'new', technician: '', updatedAt: now, closedAt: '',
    history: JSON.stringify([{ at: now, what: 'created', by: str_(t.by) }])
  };
  sh.appendRow(TICKET_COLS.map(c => row[c]));
  return row;
}

function updateTicket_(id, changes, by) {
  const sh = sheet_(TICKET_SHEET, TICKET_COLS);
  const data = sh.getDataRange().getValues();
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][0]) !== String(id)) continue;
    const row = {};
    TICKET_COLS.forEach((c, i) => row[c] = data[r][i]);
    const now = new Date().toISOString();
    const hist = safeJson_(row.history, []);
    const editable = ['client', 'phone', 'locations', 'devices', 'notes', 'technician', 'status'];
    editable.forEach(k => {
      if (changes[k] === undefined || String(changes[k]) === String(row[k])) return;
      if (k === 'status' && STATUSES.indexOf(changes[k]) < 0) throw new Error('Bad status');
      hist.push({ at: now, what: k, from: String(row[k]), to: String(changes[k]), by: str_(by) });
      row[k] = str_(changes[k]);
    });
    if (row.status === 'closed' && !row.closedAt) row.closedAt = now;
    if (row.status !== 'closed') row.closedAt = '';
    row.updatedAt = now;
    row.history = JSON.stringify(hist);
    sh.getRange(r + 1, 1, 1, TICKET_COLS.length).setValues([TICKET_COLS.map(c => row[c])]);
    return row;
  }
  throw new Error('Ticket not found: ' + id);
}

function saveTechs_(list) {
  const sh = sheet_(TECH_SHEET, TECH_COLS);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, TECH_COLS.length).clearContent();
  const rows = list.filter(t => str_(t.name)).map(t => TECH_COLS.map(c => str_(t[c])));
  if (rows.length) sh.getRange(2, 1, rows.length, TECH_COLS.length).setValues(rows);
  return readAll_(TECH_SHEET, TECH_COLS);
}

/* ---------- Helpers ---------- */

function handle_(fn) {
  let out;
  try { out = Object.assign({ ok: true }, fn()); }
  catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function checkKey_(k) {
  if (!k || k !== ACCESS_KEY) throw new Error('Invalid access key');
}

function sheet_(name, cols) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // keep phone numbers as text so leading zeros survive
    sh.getRange('A:Z').setNumberFormat('@');
  }
  return sh;
}

function readAll_(name, cols) {
  const sh = sheet_(name, cols);
  const data = sh.getDataRange().getValues();
  const out = [];
  for (let r = 1; r < data.length; r++) {
    if (!data[r][0]) continue;
    const o = {};
    cols.forEach((c, i) => o[c] = data[r][i] instanceof Date ? data[r][i].toISOString() : String(data[r][i]));
    out.push(o);
  }
  return out;
}

function nextId_(sh) {
  const props = PropertiesService.getScriptProperties();
  let n = Number(props.getProperty('seq') || 0);
  if (!n) n = Math.max(0, sh.getLastRow() - 1);
  n += 1;
  props.setProperty('seq', String(n));
  return 'T-' + String(n).padStart(4, '0');
}

function str_(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function safeJson_(s, d) { try { return JSON.parse(s); } catch (e) { return d; } }

/** Run once from the editor to create both tabs with headers. */
function setup() {
  sheet_(TICKET_SHEET, TICKET_COLS);
  sheet_(TECH_SHEET, TECH_COLS);
}
