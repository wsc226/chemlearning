/**
 * Google Apps Script — ChemAssistant Answer Logger
 *
 * This script receives quiz submissions from ChemAssistant and appends
 * them as rows in a Google Sheet. Deploy it as a web app and paste the
 * URL into your GitHub repo's SHEET_WEBHOOK_URL secret.
 *
 * SETUP:
 *   1. Open Google Sheets → create a new spreadsheet
 *   2. Rename the first sheet tab to "Answers" (or leave as "Sheet1")
 *   3. Extensions → Apps Script
 *   4. Delete the default code and paste this entire file
 *   5. Click Deploy → New deployment
 *   6. Type = "Web app"
 *   7. Execute as = "Me"
 *   8. Who has access = "Anyone"
 *   9. Click Deploy → copy the URL (starts with https://script.google.com/...)
 *  10. Go to your GitHub repo → Settings → Secrets and variables → Actions
 *  11. New repository secret:
 *        Name:  SHEET_WEBHOOK_URL
 *        Value: (paste the URL from step 9)
 *  12. Push any commit (or re-run the workflow) to rebuild with the URL
 *
 * The sheet will auto-create headers on the first submission.
 * Each quiz answer appears as one row with: Timestamp, Type, Prompt,
 * Instruction, Answer, Correct, Expected, Feedback, Voice.
 *
 * READ ACCESS (doGet) — for reviewing the log yourself:
 *   This webhook URL is baked into the site's public JavaScript bundle
 *   (it's a NEXT_PUBLIC_ env var), so anyone who inspects the page source
 *   could find it. doGet() is gated behind a secret key that is NOT stored
 *   in this file (and therefore never committed to the public repo):
 *
 *   1. In the Apps Script editor, click Project Settings (gear icon, left sidebar)
 *   2. Scroll to "Script Properties" → click "Add script property"
 *      Property: READ_KEY
 *      Value:    (make up a long random passphrase — this is your private key)
 *   3. Save
 *   4. Deploy → Manage deployments → edit (pencil) the existing deployment →
 *      Version: "New version" → Deploy
 *      (this keeps the same URL — no need to update the GitHub secret)
 *   5. To view the log, visit:
 *        <your webhook URL>?key=<the READ_KEY value you chose>
 *      This returns all logged rows as JSON. Bookmark it for weekly review.
 */

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // Create headers if the sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Timestamp',
      'Type',
      'Prompt',
      'Instruction',
      'Answer',
      'Correct',
      'Expected',
      'Feedback',
      'Voice',
    ]);
  }

  // Parse the POST body — may be a single entry or an array (queued batch)
  var data = JSON.parse(e.postData.contents);
  var entries = Array.isArray(data) ? data : [data];

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    sheet.appendRow([
      entry.ts || '',
      entry.type || '',
      entry.prompt || '',
      entry.instruction || '',
      entry.answer || '',
      entry.correct ? 'Y' : 'N',
      entry.expected || '',
      entry.feedback || '',
      entry.voice ? 'Y' : 'N',
    ]);
  }

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', count: entries.length })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Read-only log viewer, gated by a secret key stored in Script Properties
 * (see the READ ACCESS setup note above the header of this file).
 *
 * Usage: <webhook URL>?key=<your READ_KEY>
 * Returns every logged row as JSON, most recent last.
 */
function doGet(e) {
  var expectedKey = PropertiesService.getScriptProperties().getProperty('READ_KEY');
  var providedKey = e.parameter.key;

  if (!expectedKey || providedKey !== expectedKey) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'error', message: 'Unauthorized' })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) {
    return ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', count: 0, rows: [] }, null, 2)
    ).setMimeType(ContentService.MimeType.JSON);
  }

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var rows = values.map(function (row) {
    var obj = {};
    headers.forEach(function (header, i) {
      obj[header] = row[i];
    });
    return obj;
  });

  return ContentService.createTextOutput(
    JSON.stringify({ status: 'ok', count: rows.length, rows: rows }, null, 2)
  ).setMimeType(ContentService.MimeType.JSON);
}
