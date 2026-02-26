# Sales Cockpit KPI Dashboard

## Overview
A sales KPI dashboard that pulls data from Google Sheets and displays conversion rates, time-to-offer/deal metrics, and team/individual performance charts.

## Architecture
- **Backend**: Node.js + Express server (`server.js`) on port 5000
- **Frontend**: Static HTML/CSS/JS served from `public/` directory, uses Chart.js for visualizations
- **Data Source**: Google Sheets API (requires `GOOGLE_CREDENTIALS` env var or `credentials.json` file)

## Project Structure
```
server.js          - Express server with Google Sheets API integration
public/
  index.html       - Main dashboard HTML
  dashboard.js     - Frontend chart rendering and UI logic
  styles.css       - Dashboard styling
```

## Dependencies
- express: Web server
- googleapis: Google Sheets API client
- dotenv: Environment variable loading

## Configuration
- `GOOGLE_CREDENTIALS`: JSON string of Google service account credentials
- `SPREADSHEET_ID`: Google Sheets spreadsheet ID (has a default value)
- Server listens on `0.0.0.0:5000`

## Workflow
- "Start application" runs `node server.js` on port 5000
