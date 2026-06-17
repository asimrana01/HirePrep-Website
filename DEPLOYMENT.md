# Deploying HirePrep — Firebase + Render + Vercel

This guide takes HirePrep from "running on my laptop" to a real live URL,
using three free-tier services:

- **Firebase** — Firestore (database only — Storage is not used)
- **Render** — hosts the Flask backend (the API)
- **Vercel** — hosts the static frontend (the website you actually visit)

Do these in order. Each step depends on the one before it.

---

## Part 1 — Firebase (database)

### 1.1 Create the project

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project**. Name it `hireprep` (or anything you like).
3. You can disable Google Analytics for this project — not needed.
4. Click **Create project** and wait for it to finish.

### 1.2 Create the Firestore database

1. In the left sidebar, click **Build → Firestore Database**.
2. Click **Create database**.
3. Choose **Start in production mode** (we'll rely on the backend's admin
   access, not open client rules).
4. Pick a location close to where most of your users are (e.g. a region
   near Pakistan if that's your primary audience). This can't be changed
   later, so choose deliberately.
5. Click **Enable**.

You don't need to create any collections manually — the backend code
creates the `users` and `results` collections automatically the first
time someone signs up or saves a result.

> **Note:** You do NOT need to set up Firebase Storage. CV PDFs are
> parsed in memory and only the extracted text is saved to Firestore.
> This keeps everything on the free Spark plan.

### 1.3 Generate a service account key

This is the credential that lets your *backend* (not your users) talk to
Firestore with full access.

1. Click the gear icon next to **Project Overview** → **Project settings**.
2. Go to the **Service accounts** tab.
3. Click **Generate new private key**. Confirm.
4. A `.json` file downloads. **Treat this file like a password.** Don't
   commit it to GitHub, don't share it, don't paste it into a chat.
5. Save it somewhere safe on your computer, e.g.
   `C:\Users\Asim\secrets\hireprep-firebase.json`.

You now have everything Firebase-side. Keep the downloaded JSON file
handy — you'll need it in the next two parts.

---

## Part 2 — Local backend setup (verify before deploying)

Before pushing to Render, confirm Firestore actually works from your machine.

1. In `backend/.env`, add this line (adjust the path to wherever you
   saved the file):

   ```
   GOOGLE_APPLICATION_CREDENTIALS=C:\Users\Asim\secrets\hireprep-firebase.json
   ```

2. Install the dependencies:

   ```
   cd backend
   pip install -r requirements.txt
   ```

3. Run the backend as usual:

   ```
   python app.py
   ```

4. If it starts without errors and `http://localhost:5000/api/health`
   returns `{"status": "ok"}`, Firestore is wired up correctly. Try
   signing up through the frontend — then check the Firebase Console →
   Firestore Database. You should see a new `users` collection with your
   account in it.

If you get a `RuntimeError: Firebase credentials not found`, double-check
the `GOOGLE_APPLICATION_CREDENTIALS` path — on Windows, use either double
backslashes (`C:\\Users\\...`) or forward slashes (`C:/Users/...`) since a
single backslash can be misread.

---

## Part 3 — Render (backend hosting)

### 3.1 Push your code to GitHub

Render deploys from a Git repository, so the project needs to live on
GitHub first.

```
cd hireprep
git init
git add .
git commit -m "Initial commit"
```

Create a new empty repository on https://github.com/new (don't add a
README there), then:

```
git remote add origin https://github.com/YOUR_USERNAME/hireprep.git
git branch -M main
git push -u origin main
```

Because `.env` is in `.gitignore`, your Groq key and any local secrets
will **not** be uploaded. Good — Render needs you to enter them separately
anyway.

### 3.2 Create the Render web service

1. Go to https://render.com and sign up (GitHub sign-in is easiest).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account if prompted, then select the `hireprep`
   repository.
4. Render should detect the `render.yaml` file in the repo root and offer
   to use it — accept that. If it doesn't auto-detect, fill in manually:
   - **Root Directory**: `backend`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app --bind 0.0.0.0:$PORT`
   - **Plan**: Free

### 3.3 Add environment variables

In the service's **Environment** tab, add these **3 variables** (no Storage bucket needed):

| Key | Value |
|---|---|
| `GROQ_API_KEY` | your Groq API key |
| `SECRET_KEY` | any random string (e.g. generate one at https://randomkeygen.com) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the **entire contents** of the JSON file from Part 1.3 |

For `FIREBASE_SERVICE_ACCOUNT_JSON`: open the downloaded `.json` file in a
text editor, select all, copy, and paste the whole thing — including the
curly braces — as the value of that one environment variable. Render
encrypts environment variables at rest, so this is the correct way to get
a credentials file onto a platform where you don't control the disk.

### 3.4 Deploy

Click **Create Web Service** (or **Save Changes** if it already exists).
Render will install dependencies and start the app. Watch the **Logs** tab
— you should see:

```
🚀 HirePrep backend running at http://localhost:10000
[INFO] Starting gunicorn
[INFO] Listening at: http://0.0.0.0:10000
```

Render gives you a URL like `https://hireprep-backend.onrender.com`. Test
it: visit `https://hireprep-backend.onrender.com/api/health` in your
browser. You should see `{"status": "ok", "version": "1.0.0"}`.

**Free tier note:** Render's free web services spin down after 15 minutes
of no traffic, and the next request takes about a minute to wake it back
up. This is normal and fine for a personal project — just don't be
surprised by a slow first request after idle time.

---

## Part 4 — Vercel (frontend hosting)

### 4.1 Point the frontend at your live backend

Before deploying, open `frontend/app.js` and find this near the top:

```js
const PRODUCTION_API_URL = "https://your-backend.onrender.com/api";
```

Replace it with your actual Render URL from Part 3.4:

```js
const PRODUCTION_API_URL = "https://hireprep-backend.onrender.com/api";
```

Commit and push this change:

```
git add frontend/app.js
git commit -m "Point frontend at live Render backend"
git push
```

### 4.2 Deploy to Vercel

1. Go to https://vercel.com and sign up (GitHub sign-in is easiest).
2. Click **Add New...** → **Project**.
3. Import your `hireprep` GitHub repository.
4. Vercel will ask for project settings:
   - **Framework Preset**: Other
   - **Root Directory**: click **Edit** and set it to `frontend`
   - Leave Build Command and Output Directory empty — there's no build
     step for plain HTML/CSS/JS.
5. Click **Deploy**.

Vercel gives you a URL like `https://hireprep.vercel.app`. Open it — you
should see the HirePrep homepage, served from Vercel's CDN, talking to
your Flask backend on Render, which talks to Firestore.

### 4.3 Update CORS (recommended hardening)

Right now the backend accepts requests from any origin (`CORS(app,
origins="*")` in `app.py`). That's fine to get started, but once you know
your real Vercel URL, you can lock it down:

```python
CORS(app, origins=["https://hireprep.vercel.app"])
```

Commit, push, and Render will auto-redeploy with the tighter setting.

---

## Verifying the full stack end-to-end

Once all three are live:

1. Visit your Vercel URL.
2. Sign up for a new account.
3. Check Firebase Console → Firestore → `users` collection — your new
   account should appear there within a few seconds.
4. Upload a CV PDF, run a quiz, generate an interview.
5. Check the `results` collection in Firestore — quiz/interview/skill-gap
   sessions should be appearing there.

If something doesn't show up, the Render **Logs** tab is the first place
to look — it will show the real Python error if a Groq call or Firestore
write fails.

---

## What changes if you redeploy later

- **Frontend changes** (HTML/CSS/JS): push to GitHub, Vercel auto-redeploys.
- **Backend changes** (`app.py`, `db.py`, routes): push to GitHub, Render
  auto-redeploys.
- **Rotating your Groq key or Firebase credentials**: update the value in
  Render's Environment tab — no code change or redeploy of the frontend
  needed.
