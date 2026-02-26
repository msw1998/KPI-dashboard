# Deployment Guide – Sales Cockpit KPI Dashboard

## Overview
- **Backend:** Node.js + Express
- **Data source:** Google Sheets (fetched on every page refresh)
- **Hosting:** Replit

---

## Step 1 – Google Cloud Setup (one-time)

### 1a. Create a Google Cloud Project
1. Go to https://console.cloud.google.com
2. Click **New Project** → name it (e.g. "KPI Dashboard") → Create

### 1b. Enable Google Sheets API
1. In your project, go to **APIs & Services → Library**
2. Search for "Google Sheets API" → click **Enable**

### 1c. Create a Service Account
1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → Service Account**
3. Name: `kpi-dashboard-reader` → click **Create and Continue**
4. Role: none needed → click **Done**
5. Click the service account email you just created
6. Go to the **Keys** tab → **Add Key → Create new key → JSON**
7. Download the `.json` file – keep it safe!

### 1d. Share the Google Sheet with the Service Account
1. Open your Google Sheet:
   https://docs.google.com/spreadsheets/d/14aljkRRYQTD-7-I2LONY6LJELYqXNIMLkqoy6CVGPWM
2. Click **Share**
3. Paste the service account email (looks like `kpi-dashboard-reader@your-project.iam.gserviceaccount.com`)
4. Set role to **Viewer** → click **Share**

---

## Step 2 – Deploy on Replit

### 2a. Create a new Replit
1. Go to https://replit.com → click **+ Create Repl**
2. Choose **Node.js** template
3. Name it `kpi-dashboard`

### 2b. Upload the code
Upload all files from the `kpi-dashboard/` folder:
```
server.js
package.json
public/
  index.html
  styles.css
  dashboard.js
```
Or connect your GitHub repo if you prefer.

### 2c. Add Secrets (environment variables)
In Replit, go to **Secrets** (lock icon in the left sidebar):

| Key | Value |
|-----|-------|
| `SPREADSHEET_ID` | `14aljkRRYQTD-7-I2LONY6LJELYqXNIMLkqoy6CVGPWM` |
| `GOOGLE_CREDENTIALS` | Paste the **entire contents** of your downloaded JSON key file (as one line) |

**To get the JSON as one line:**
```bash
cat your-key-file.json | tr -d '\n'
```
Or open the file, select all, copy – then paste it into the Secret value field.

### 2d. Install dependencies
In the Replit Shell:
```bash
npm install
```

### 2e. Run
Click the **Run** button (or `npm start` in the Shell).
Replit will give you a public URL like `https://kpi-dashboard.yourname.repl.co`.

---

## How it works
- Every time someone opens the dashboard or refreshes the page, the browser calls `/api/data`
- The server fetches fresh data from Google Sheets via the API
- The frontend renders all charts and KPI cards with the live data
- No caching – always up to date

---

## Local Development
```bash
# 1. Copy .env.example to .env and fill in your credentials
cp .env.example .env

# 2. Install
npm install

# 3. Run
npm start

# 4. Open
open http://localhost:3000
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `GOOGLE_CREDENTIALS environment variable is not set` | Add the Secret in Replit |
| `The caller does not have permission` | Make sure you shared the Sheet with the service account email |
| `Requested entity was not found` | Check the SPREADSHEET_ID is correct |
| Charts show no data | Verify the sheet tab names match exactly: `Teamview`, `Lukas Eisele`, `Sam Holdenried`, `Tobias Hagl`, `Aufteilung Websessions` |
