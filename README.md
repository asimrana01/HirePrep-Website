# HirePrep

An interview-preparation platform that turns a candidate's CV into a personalized prep plan: extracted skills, targeted practice questions, quizzes, and a skill-gap report against a chosen role.

**Live:** https://hire-prep-website.vercel.app/#home

![Flask](https://img.shields.io/badge/-Flask-000000?style=flat-square&logo=flask&logoColor=white)
![Firestore](https://img.shields.io/badge/-Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![Vercel](https://img.shields.io/badge/-Vercel-000000?style=flat-square&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/-Render-46E3B7?style=flat-square&logo=render&logoColor=black)

---

## Why this exists

Most interview prep is generic — the same question bank for every candidate regardless of what's actually on their CV. HirePrep starts from the candidate's own document: it parses the CV, extracts the skills it can find, compares them against the requirements of a target role, and generates practice material aimed at the gap rather than the whole field.

This is the second iteration of the project. It originally shipped as a React Native mobile app backed by FastAPI and a Groq/LLaMA inference layer; it was rebuilt as a web platform to remove the install barrier and make the prep sessions shareable.

---

## Features

- **CV upload and skill extraction** — parses an uploaded CV and pulls out a structured skill list
- **Skill-gap analysis** — compares extracted skills against a target role's expected skill set and reports what's missing
- **Interview practice sessions** — generates role-relevant questions from the candidate's own profile
- **Quiz mode** — scored multiple-choice rounds for quick self-assessment
- **Session persistence** — past sessions and results stored per user

---

## Architecture

```
Browser (frontend, Vercel)
        |
        |  HTTPS / JSON
        v
Flask API (Render)
        |
        +--> CV parsing + skill extraction
        +--> LLM inference  <!-- FILL: which provider/model the web version uses — Groq/LLaMA? something else? -->
        +--> Firestore (users, sessions, results)
```

The frontend and backend are deployed independently — the frontend is a static build on Vercel, the API runs as a Flask service on Render, and the two communicate over a configured API base URL. Firestore holds user records, saved sessions, and quiz results.

<!-- FILL: if the repo is a monorepo, add the folder tree here (frontend/ + backend/) so a reader knows where the API code lives. Right now GitHub reports CSS as the primary language, which hides the backend work. -->

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | HTML,CSS , VANILLA JS |
| Backend | Flask (Python) |
| Database | Firestore |
| LLM | GROQ |
| Hosting | Vercel (frontend), Render (backend) |

---

## Running locally

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
flask run

# Frontend
cd frontend
<!-- FILL: npm install && npm run dev, or just open index.html -->
```

### Environment variables

Create a `.env` in the backend directory:

```
FIREBASE_CREDENTIALS=path/to/serviceAccount.json
<!-- FILL: LLM API key variable name -->
CLIENT_URL=http://localhost:5173
```

---

## Project history

| Iteration | Stack | Outcome |
|---|---|---|
| v1 — mobile | React Native + FastAPI + Groq/LLaMA | Working prototype, install friction |
| v2 — web | Flask + Firestore + Vercel/Render | Current deployed version |

---


## Author

Muhammad Asim Sadiq — [GitHub](https://github.com/asimrana01) · [LinkedIn](https://www.linkedin.com/in/muhammad-asim-sadiq-449942270)
