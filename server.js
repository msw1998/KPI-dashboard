require('dotenv').config();   // no-op in production if dotenv isn't present
const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '14aljkRRYQTD-7-I2LONY6LJELYqXNIMLkqoy6CVGPWM';
// const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '12lqPJKW4CWAClat7migPmWRH4SgiImGfxOEdQEs0U_4';

app.use(express.static(path.join(__dirname, 'public')));

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getAuthClient() {
  let credentials;

  if (process.env.GOOGLE_CREDENTIALS) {
    // Replit Secrets (or single-line env var)
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else {
    // Local dev fallback: read credentials.json from project root
    const credFile = path.join(__dirname, 'credentials.json');
    if (!fs.existsSync(credFile)) {
      throw new Error(
        'No credentials found. Either set GOOGLE_CREDENTIALS env var or ' +
        'place your service account key file at credentials.json in the project root.'
      );
    }
    credentials = JSON.parse(fs.readFileSync(credFile, 'utf8'));
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return auth;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (s === '' || s === '-' || s === 'N/A' || s === '#DIV/0!') return null;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

// Google Sheets stores dates as serial numbers (days since Dec 30, 1899)
function serialToLabel(serial) {
  if (typeof serial !== 'number' || serial < 40000) return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  return `${months[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function serialToISO(serial) {
  if (typeof serial !== 'number' || serial < 40000) return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().slice(0, 10);
}

// ─── Sheet fetch ──────────────────────────────────────────────────────────────

async function fetchRange(sheets, sheetName, range, renderOption = 'UNFORMATTED_VALUE') {
  // Sheet names with spaces need single-quote wrapping in A1 notation
  const quotedName = sheetName.includes(' ') ? `'${sheetName}'` : sheetName;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${quotedName}!${range}`,
    valueRenderOption: renderOption,
  });
  return res.data.values || [];
}

// ─── Parsers ──────────────────────────────────────────────────────────────────

// Section 1: Websession → Angebot
// Columns: A(0) B(1)=Month C(2)=WS D(3)=Off30 E(4)=CR30 F(5)=TTO30
//          G(6)=Off60 H(7)=CR60 I(8)=TTO60 J(9)=Off90 K(10)=CR90 L(11)=TTO90
function parseWsToOffer(rows) {
  const result = [];
  for (const row of rows) {
    const monthLabel = serialToLabel(row[1]);
    if (!monthLabel) continue;
    const websessions = toNum(row[2]);
    if (websessions === null || websessions === 0) continue;
    result.push({
      month: monthLabel,
      isoDate: serialToISO(row[1]),
      websessions,
      offers_30d:  toNum(row[3]),
      cr_30d:      toNum(row[4]),   // decimal e.g. 0.136
      tto_30d:     toNum(row[5]),
      offers_60d:  toNum(row[6]),
      cr_60d:      toNum(row[7]),
      tto_60d:     toNum(row[8]),
      offers_90d:  toNum(row[9]),
      cr_90d:      toNum(row[10]),
      tto_90d:     toNum(row[11]),
    });
  }
  return result;
}

// Section 2: Angebot → Auftrag
// Columns: A(0) B(1)=Month C(2)=Offers D(3)=Deals30 E(4)=CR30 F(5)=LC30
//          G(6)=Deals60 H(7)=CR60 I(8)=LC60 J(9)=Deals90 K(10)=CR90 L(11)=LC90
function parseOfferToDeal(rows) {
  const result = [];
  for (const row of rows) {
    const monthLabel = serialToLabel(row[1]);
    if (!monthLabel) continue;
    const offers = toNum(row[2]);
    if (offers === null) continue;
    result.push({
      month: monthLabel,
      isoDate: serialToISO(row[1]),
      offers,
      deals_30d:      toNum(row[3]),
      cr_deal_30d:    toNum(row[4]),
      lifecycle_30d:  toNum(row[5]),
      deals_60d:      toNum(row[6]),
      cr_deal_60d:    toNum(row[7]),
      lifecycle_60d:  toNum(row[8]),
      deals_90d:      toNum(row[9]),
      cr_deal_90d:    toNum(row[10]),
      lifecycle_90d:  toNum(row[11]),
    });
  }
  return result;
}

// Aufteilung Websessions sheet
// Row format: A(0)=Month B(1)=Lukas C(2)=Sam D(3)=Tobias E(4)=Total
//             G(6)=Month H(7)=LukasP I(8)=SamP J(9)=TobiasP K(10)=Total
function parseWsDist(rows) {
  const result = [];
  for (const row of rows) {
    const monthLabel = serialToLabel(row[0]);
    const total = toNum(row[4]);
    if (!monthLabel || !total || total === 0) continue;
    result.push({
      month: monthLabel,
      lukas:   toNum(row[1]),
      sam:     toNum(row[2]),
      tobias:  toNum(row[3]),
      total,
      lukasP:  toNum(row[7]),
      samP:    toNum(row[8]),
      tobiasP: toNum(row[9]),
    });
  }
  return result;
}

// ─── API endpoint ─────────────────────────────────────────────────────────────

app.get('/api/data', async (req, res) => {
  try {
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    // Fetch all ranges in parallel
    const [
      lastUpdatedRaw,
      teamWsRaw, teamOdRaw,
      lukasWsRaw, lukasOdRaw,
      samWsRaw, samOdRaw,
      tobiasWsRaw, tobiasOdRaw,
      wsDistRaw,
    ] = await Promise.all([
      fetchRange(sheets, 'Teamview',              'A1', 'FORMATTED_VALUE'),
      fetchRange(sheets, 'Teamview',              'A6:M21'),
      fetchRange(sheets, 'Teamview',              'A28:M43'),
      fetchRange(sheets, 'Lukas Eisele',          'A5:M20'),
      fetchRange(sheets, 'Lukas Eisele',          'A28:M43'),
      fetchRange(sheets, 'Sam Holdenried',        'A5:M20'),
      fetchRange(sheets, 'Sam Holdenried',        'A28:M43'),
      fetchRange(sheets, 'Tobias Hagl',           'A5:M20'),
      fetchRange(sheets, 'Tobias Hagl',           'A28:M43'),
      fetchRange(sheets, 'Aufteilung Websessions','A4:K16'),
    ]);

    // Parse last-updated date from A1 (formatted text, e.g. "Last Updated: 25-02-2026",
    // "25.02.2026", "25/02/2026", or ISO "2026-02-25")
    const rawA1 = lastUpdatedRaw?.[0]?.[0];
    let lastUpdated = null;
    if (rawA1) {
      const s = String(rawA1);
      // Try YYYY-MM-DD (ISO) first
      const mISO = s.match(/(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
      if (mISO) {
        lastUpdated = `${mISO[1]}-${mISO[2]}-${mISO[3]}`;
      } else {
        // Try DD-MM-YYYY / DD.MM.YYYY / DD/MM/YYYY
        const mDMY = s.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/);
        if (mDMY) lastUpdated = `${mDMY[3]}-${mDMY[2].padStart(2,'0')}-${mDMY[1].padStart(2,'0')}`;
      }
    }

    res.json({
      teamview: {
        wsToOffer:   parseWsToOffer(teamWsRaw),
        offerToDeal: parseOfferToDeal(teamOdRaw),
      },
      individuals: {
        'Lukas Eisele': {
          wsToOffer:   parseWsToOffer(lukasWsRaw),
          offerToDeal: parseOfferToDeal(lukasOdRaw),
        },
        'Sam Holdenried': {
          wsToOffer:   parseWsToOffer(samWsRaw),
          offerToDeal: parseOfferToDeal(samOdRaw),
        },
        'Tobias Hagl': {
          wsToOffer:   parseWsToOffer(tobiasWsRaw),
          offerToDeal: parseOfferToDeal(tobiasOdRaw),
        },
      },
      wsDist: parseWsDist(wsDistRaw),
      lastUpdated,
    });
  } catch (err) {
    console.error('API error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Sales Cockpit dashboard running at http://localhost:${PORT}`);
});
