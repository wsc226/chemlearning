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
