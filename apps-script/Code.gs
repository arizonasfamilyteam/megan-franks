/**
 * Megan Franks seller leads -> Google Sheets (+ optional email + photo storage in Drive)
 * Setup: open your Google Sheet > Extensions > Apps Script > paste this file > Deploy as Web app
 * (Execute as: Me, Who has access: Anyone). Paste the Web App URL into js/config.js.
 */
const NOTIFY_EMAIL = "";            // Megan's email for new-lead alerts. Leave "" to turn off. Stays in Apps Script only.
const SHEET_NAME = "Leads";
const PHOTO_FOLDER = "Megan Franks Seller Photos";
const HEADERS = ["Submission Date","Lead ID","Seller Name","Email","Phone","Preferred Contact Method","Seller Goal","Property Address","City","ZIP Code","Property Type","Bedrooms","Bathrooms","Square Footage","Property Condition","Selling Timeline","Additional Notes","Consultation Date","Consultation Time","Meeting Preference","Lead Source","Photo URLs"];

function doGet() { return out({ ok: true, status: "Lead endpoint is running" }); }

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
    const d = JSON.parse(e.postData.contents);
    if (d.website) return out({ ok: true });                       // honeypot: bots
    if (!d.leadId || !d.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || "") || String(d.phone || "").replace(/\D/g, "").length < 10)
      return out({ ok: false, error: "Name, a valid email, and a phone number are required." });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) { sh.appendRow(HEADERS); sh.setFrozenRows(1); }
    if (sh.getLastRow() > 1 && sh.getRange(2, 2, sh.getLastRow() - 1, 1).getValues().flat().indexOf(d.leadId) > -1)
      return out({ ok: true, duplicate: true });                   // already saved

    const urls = savePhotos(d);
    sh.appendRow([Utilities.formatDate(new Date(), "America/Phoenix", "yyyy-MM-dd HH:mm:ss"), d.leadId, d.name, d.email, d.phone, d.contactMethod, d.goal,
      d.address, d.city, d.zip, d.propertyType, d.bedrooms, d.bathrooms, d.sqft, d.condition, d.timeline, d.notes,
      d.consultDate, d.consultTime, d.meetingPref, d.source, urls.join("\n")].map(safe));
    notify(d, urls, ss.getUrl() + "#gid=" + sh.getSheetId() + "&range=A" + sh.getLastRow());
    return out({ ok: true, leadId: d.leadId });
  } catch (err) {
    return out({ ok: false, error: "Server error: " + err.message });
  } finally { try { lock.releaseLock(); } catch (x) {} }
}

function safe(v) { v = v == null ? "" : String(v).slice(0, 2000); return /^[=+\-@]/.test(v) ? "'" + v : v; } // blocks formula injection
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function savePhotos(d) {
  const list = (d.photos || []).slice(0, 6), urls = [];
  if (!list.length) return urls;
  const it = DriveApp.getFoldersByName(PHOTO_FOLDER);
  const folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER);
  list.forEach((p, i) => {
    const m = /^data:image\/jpeg;base64,(.+)$/.exec(p); if (!m) return;
    const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[1]), "image/jpeg", d.leadId + "-" + (i + 1) + ".jpg"));
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    urls.push(f.getUrl());
  });
  return urls;
}

function notify(d, urls, link) {
  if (!NOTIFY_EMAIL) return;
  try {
    MailApp.sendEmail(NOTIFY_EMAIL, "New seller inquiry: " + d.name,
      ["Name: " + d.name, "Email: " + d.email, "Phone: " + d.phone, "Preferred contact: " + (d.contactMethod || "-"),
       "Goal: " + (d.goal || "-"), "Property: " + [d.address, d.city, d.zip].filter(String).join(", "),
       "Timeline: " + (d.timeline || "-"), d.consultDate ? "Requested: " + d.consultDate + " " + d.consultTime + " (" + d.meetingPref + ")" : "",
       "Source: " + d.source, urls.length ? "Photos:\n" + urls.join("\n") : "", "", "Spreadsheet record: " + link].filter(String).join("\n"));
  } catch (e) { /* a mail failure must not lose the lead */ }
}
