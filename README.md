# Megan Franks – Seller Consultation Website

Static site (HTML/CSS/JS). No build step. Forms send to Google Sheets via a Google Apps Script Web App.

## 1. Add the photos (images/ folder)
- `images/megan.jpg` – Megan's professional photo (download it from the Drive link and rename it).
- `images/hero.jpg` – an Arizona home at sunset (use a photo you have rights to).
Keep each under ~300 KB (export as JPG, about 1600px wide). Until added, a soft sunset gradient shows instead.

## 2. Google Sheets + Apps Script
1. Create a new Google Sheet. Open **Extensions > Apps Script**.
2. Delete the sample code and paste all of `apps-script/Code.gs`.
3. Optional: set `NOTIFY_EMAIL` to Megan's email for new-lead alerts.
4. **Deploy > New deployment > Web app**. Execute as: **Me**. Who has access: **Anyone**. Authorize when asked (Sheets, Drive, Mail).
5. Copy the Web App URL (ends in `/exec`).
6. Open `js/config.js` and paste it as `APPS_SCRIPT_URL`.
7. After any later change to Code.gs, use **Deploy > Manage deployments > Edit > New version**.
The "Leads" tab and its columns are created automatically. Photos are saved in a Drive folder and their links go in the "Photo URLs" column.

## 3. GitHub + Netlify
1. Create a GitHub repo and upload everything in this folder (keep the folder structure).
2. Netlify: **Add new site > Import from Git**, choose the repo. Build command: empty. Publish directory: `.`
3. After deploying, update the `og:image` URL in `index.html` to your full image URL.

## Environment variables
None needed. The Web App URL is public by design and holds no secrets; the notification email lives only inside Apps Script.

## Testing checklist
Submit each of the three forms, check a new row appears, test a bad URL in config.js (you should see an error, never success), upload and remove photos, and test on your phone.
