"""
HirePrep Backend — Flask API
Handles auth, AI interview practice, quizzes, CV parsing, and skill gap analysis.
Data persistence: Cloud Firestore + Firebase Storage (see db.py).
"""

import os
import json
import uuid
import time
import bcrypt
import pdfplumber
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
from dotenv import load_dotenv

import db  # Firestore + Firebase Storage data access layer

load_dotenv()

app = Flask(__name__)
CORS(app, origins="*")
app.secret_key = os.getenv("SECRET_KEY", "hireprep-dev-secret")

# ─── Groq client ───────────────────────────────────────────────────────────────
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# ─── Models ────────────────────────────────────────────────────────────────────
MODEL_LARGE  = "llama-3.3-70b-versatile"   # interview, CV, skill gap
MODEL_FAST   = "llama-3.1-8b-instant"      # quiz generation

# ─── Local scratch space (CV PDFs are parsed here, then deleted) ──────────────
BASE_DIR   = os.path.dirname(__file__)
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─── Groq call helper ──────────────────────────────────────────────────────────
def groq_json(model, system_prompt, user_prompt, timeout=30):
    """Call Groq and parse JSON from the response."""
    response = groq_client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=4096,
        timeout=timeout,
    )
    raw = response.choices[0].message.content.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


# ══════════════════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/signup", methods=["POST"])
def signup():
    data   = request.json
    name   = data.get("name", "").strip()
    email  = data.get("email", "").strip().lower()
    pw     = data.get("password", "")

    if not name or not email or not pw:
        return jsonify({"success": False, "error": "All fields are required"}), 400
    if len(pw) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400

    if db.get_user_by_email(email):
        return jsonify({"success": False, "error": "An account with this email already exists"}), 409

    user_id = str(uuid.uuid4())
    token   = str(uuid.uuid4())
    pw_hash = bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

    db.create_user(user_id, {
        "id":            user_id,
        "name":          name,
        "email":         email,
        "password_hash": pw_hash,
        "token":         token,
        "cv_text":       None,
        "cv_data":       None,
        "created_at":    datetime.now().isoformat(),
    })
    return jsonify({"success": True, "userId": user_id, "name": name, "token": token})


@app.route("/api/login", methods=["POST"])
def login():
    data  = request.json
    email = data.get("email", "").strip().lower()
    pw    = data.get("password", "")

    user = db.get_user_by_email(email)
    if not user:
        return jsonify({"success": False, "error": "No account found with this email"}), 401
    if not bcrypt.checkpw(pw.encode(), user["password_hash"].encode()):
        return jsonify({"success": False, "error": "Incorrect password"}), 401

    token = str(uuid.uuid4())
    db.update_user(user["id"], {"token": token})
    return jsonify({
        "success": True,
        "userId":  user["id"],
        "name":    user["name"],
        "token":   token,
        "hasCv":   user.get("cv_data") is not None,
    })


def get_user(user_id):
    return db.get_user(user_id)


# ══════════════════════════════════════════════════════════════════════════════
# INTERVIEW PRACTICE
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/interview/generate", methods=["POST"])
def interview_generate():
    data       = request.json
    role       = data.get("role", "Software Developer")
    difficulty = data.get("difficulty", "Intermediate")

    system = (
        "You are an expert technical interviewer. "
        "Return ONLY a valid JSON array of exactly 10 interview question strings. "
        "No markdown, no explanation, just the JSON array. "
        f"Difficulty level: {difficulty}."
    )
    user = (
        f"Generate 10 realistic interview questions for a {role} position at difficulty: {difficulty}. "
        "Mix behavioural and technical questions appropriate for the role. "
        "Return only a JSON array of 10 strings."
    )
    try:
        result = groq_json(MODEL_LARGE, system, user)
        if isinstance(result, list):
            questions = result[:10]
        else:
            questions = result.get("questions", [])
        return jsonify({"success": True, "questions": questions})
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to generate questions: {str(e)}"}), 500


@app.route("/api/interview/submit", methods=["POST"])
def interview_submit():
    data      = request.json
    user_id   = data.get("userId")
    role      = data.get("role", "Unknown Role")
    questions = data.get("questions", [])
    answers   = data.get("answers", [])

    if len(questions) != len(answers):
        return jsonify({"success": False, "error": "Questions and answers length mismatch"}), 400

    qa_pairs = "\n\n".join(
        f"Q{i+1}: {q}\nA{i+1}: {a}" for i, (q, a) in enumerate(zip(questions, answers))
    )

    system = (
        "You are a professional interview coach evaluating a candidate. "
        "Return ONLY valid JSON matching this exact structure:\n"
        '{"scores": [7,8,6,...], "feedback": ["feedback1","feedback2",...], '
        '"overall": "Overall summary paragraph", "total_score": 7.2}\n'
        "scores: array of integers 1-10, one per answer. "
        "feedback: array of 1-2 sentence specific feedback strings. "
        "overall: a 3-4 sentence overall performance summary. "
        "total_score: average of all scores as a float. "
        "No markdown, no extra text."
    )
    user = (
        f"Evaluate these interview answers for a {role} position:\n\n{qa_pairs}\n\n"
        "Score each answer out of 10 and give specific, actionable feedback."
    )
    try:
        result = groq_json(MODEL_LARGE, system, user, timeout=60)

        # Persist result
        session = {
            "id":          str(uuid.uuid4()),
            "type":        "interview",
            "role":        role,
            "questions":   questions,
            "answers":     answers,
            "scores":      result.get("scores", []),
            "feedback":    result.get("feedback", []),
            "overall":     result.get("overall", ""),
            "total_score": result.get("total_score", 0),
            "timestamp":   datetime.now().isoformat(),
        }
        if user_id:
            db.add_result(user_id, session)

        return jsonify({"success": True, **result, "sessionId": session["id"]})
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to score answers: {str(e)}"}), 500


# ══════════════════════════════════════════════════════════════════════════════
# QUIZ SYSTEM
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/quiz/generate", methods=["POST"])
def quiz_generate():
    data  = request.json
    topic = data.get("topic", "General Knowledge")
    count = int(data.get("count", 10))

    system = (
        "You are a quiz generator. Return ONLY valid JSON — no markdown, no extra text.\n"
        "Return a JSON object with key 'questions' containing an array of question objects.\n"
        "Each question object must have:\n"
        '  "question": string\n'
        '  "options": array of exactly 4 strings (A, B, C, D answers)\n'
        '  "correct_index": integer 0-3 (index of correct option)\n'
        '  "explanation": string (1-2 sentences explaining why the answer is correct)\n'
    )
    user = (
        f"Generate {count} multiple-choice quiz questions about: {topic}.\n"
        "Questions should range from easy to challenging. "
        "Make sure explanations are educational and clear."
    )
    try:
        result = groq_json(MODEL_FAST, system, user)
        questions = result.get("questions", result) if isinstance(result, dict) else result
        return jsonify({"success": True, "questions": questions[:count]})
    except Exception as e:
        return jsonify({"success": False, "error": f"Failed to generate quiz: {str(e)}"}), 500


@app.route("/api/quiz/submit", methods=["POST"])
def quiz_submit():
    data      = request.json
    user_id   = data.get("userId")
    topic     = data.get("topic", "Unknown")
    user_answers  = data.get("answers", [])   # list of chosen indices
    questions = data.get("questions", [])

    score    = 0
    breakdown = []
    for i, (q, chosen) in enumerate(zip(questions, user_answers)):
        correct = q.get("correct_index", 0)
        is_correct = (chosen == correct)
        if is_correct:
            score += 1
        breakdown.append({
            "question":      q.get("question"),
            "chosen":        chosen,
            "correct_index": correct,
            "correct":       is_correct,
            "explanation":   q.get("explanation", ""),
        })

    total      = len(questions)
    percentage = round((score / total) * 100) if total else 0

    session = {
        "id":         str(uuid.uuid4()),
        "type":       "quiz",
        "topic":      topic,
        "score":      score,
        "total":      total,
        "percentage": percentage,
        "breakdown":  breakdown,
        "timestamp":  datetime.now().isoformat(),
    }
    if user_id:
        db.add_result(user_id, session)

    return jsonify({
        "success":    True,
        "score":      score,
        "total":      total,
        "percentage": percentage,
        "breakdown":  breakdown,
        "sessionId":  session["id"],
    })


# ══════════════════════════════════════════════════════════════════════════════
# CV UPLOAD & EXTRACTION
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/cv/upload", methods=["POST"])
def cv_upload():
    user_id = request.form.get("userId")
    file    = request.files.get("cv")

    if not file:
        return jsonify({"success": False, "error": "No file uploaded"}), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify({"success": False, "error": "Only PDF files are accepted"}), 400

    # Save temporarily (local scratch disk) to extract text and to upload to Storage
    tmp_path = os.path.join(UPLOAD_DIR, f"{user_id or 'anon'}_{int(time.time())}.pdf")
    file.save(tmp_path)

    try:
        with pdfplumber.open(tmp_path) as pdf:
            cv_text = "\n".join(page.extract_text() or "" for page in pdf.pages)

        # Upload the original PDF to Firebase Storage for safekeeping (best-effort;
        # if no bucket is configured, cv_url stays None and we proceed anyway).
        cv_url = None
        if user_id:
            try:
                cv_url = db.upload_cv_pdf(user_id, tmp_path, file.filename)
            except Exception:
                cv_url = None
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    if not cv_text.strip():
        return jsonify({"success": False, "error": "Could not extract text from PDF. Try a text-based PDF."}), 400

    system = (
        "You are an expert CV analyser. Return ONLY valid JSON with this exact structure:\n"
        '{"technical_skills": ["Python","SQL",...], '
        '"soft_skills": ["Communication","Teamwork",...], '
        '"education": "BSc Computer Science, XYZ University", '
        '"experience_years": 0, '
        '"summary": "One paragraph professional summary of this candidate"}\n'
        "Extract all skills mentioned. experience_years should be 0 for fresh grads. "
        "No markdown, no explanation."
    )
    user = f"Analyse this CV and extract skills, education, experience, and write a professional summary:\n\n{cv_text[:8000]}"

    try:
        cv_data = groq_json(MODEL_LARGE, system, user, timeout=45)

        if user_id:
            update_fields = {"cv_text": cv_text[:12000], "cv_data": cv_data}
            if cv_url:
                update_fields["cv_url"] = cv_url
            db.update_user(user_id, update_fields)

        return jsonify({"success": True, "cv_data": cv_data})
    except Exception as e:
        return jsonify({"success": False, "error": f"CV analysis failed: {str(e)}"}), 500


# ══════════════════════════════════════════════════════════════════════════════
# SKILL GAP ANALYZER
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/skill-gap/analyze", methods=["POST"])
def skill_gap_analyze():
    data           = request.json
    user_id        = data.get("userId")
    job_description = data.get("job_description", "")

    if not job_description.strip():
        return jsonify({"success": False, "error": "Job description is required"}), 400

    user = get_user(user_id) if user_id else None
    if not user or not user.get("cv_data"):
        return jsonify({"success": False, "error": "Please upload your CV first"}), 400

    cv_data = user["cv_data"]
    cv_skills = cv_data.get("technical_skills", []) + cv_data.get("soft_skills", [])

    system = (
        "You are a career coach and skills matcher. Return ONLY valid JSON with this exact structure:\n"
        "{\n"
        '  "match_percentage": 68,\n'
        '  "matched_skills": ["Python", "SQL"],\n'
        '  "missing_skills": ["Docker", "AWS"],\n'
        '  "roadmap": [\n'
        "    {\n"
        '      "skill": "Docker",\n'
        '      "estimated_weeks": "1-2 weeks",\n'
        '      "what_it_is": "2-3 sentence plain English explanation",\n'
        '      "why_employers_want_it": "1-2 sentences on business value",\n'
        '      "core_concepts": ["Containers", "Images", "Volumes", "Dockerfile"],\n'
        '      "practice_task": "One concrete beginner task to do this week",\n'
        '      "resources": [\n'
        '        {"name": "Docker Official Docs", "url": "https://docs.docker.com"},\n'
        '        {"name": "Play with Docker", "url": "https://labs.play-with-docker.com"}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        "Be realistic with match_percentage. Include a roadmap entry for EVERY missing skill. "
        "Resources must have real, working URLs. No markdown, no extra text."
    )
    user_prompt = (
        f"Candidate skills: {', '.join(cv_skills)}\n\n"
        f"Job Description:\n{job_description[:4000]}\n\n"
        "Compare the candidate's skills against the job description requirements. "
        "Return the analysis JSON."
    )

    try:
        result = groq_json(MODEL_LARGE, system, user_prompt, timeout=60)

        session = {
            "id":              str(uuid.uuid4()),
            "type":            "skill_gap",
            "match_percentage": result.get("match_percentage", 0),
            "matched_skills":  result.get("matched_skills", []),
            "missing_skills":  result.get("missing_skills", []),
            "roadmap":         result.get("roadmap", []),
            "timestamp":       datetime.now().isoformat(),
        }
        if user_id:
            db.add_result(user_id, session)

        return jsonify({"success": True, **result, "sessionId": session["id"]})
    except Exception as e:
        return jsonify({"success": False, "error": f"Skill gap analysis failed: {str(e)}"}), 500


# ══════════════════════════════════════════════════════════════════════════════
# RESULTS HISTORY
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/results/<user_id>", methods=["GET"])
def get_results(user_id):
    user_results = db.get_results_for_user(user_id)
    return jsonify({"success": True, "results": user_results})


@app.route("/api/profile/<user_id>", methods=["GET"])
def get_profile(user_id):
    user = db.get_user(user_id)
    if not user:
        return jsonify({"success": False, "error": "User not found"}), 404
    return jsonify({
        "success":  True,
        "name":     user["name"],
        "email":    user["email"],
        "hasCv":    user.get("cv_data") is not None,
        "cv_data":  user.get("cv_data"),
    })


@app.route("/api/stats/<user_id>", methods=["GET"])
def get_stats(user_id):
    sessions = db.get_results_for_user(user_id)

    interviews = [s for s in sessions if s["type"] == "interview"]
    quizzes    = [s for s in sessions if s["type"] == "quiz"]
    analyses   = [s for s in sessions if s["type"] == "skill_gap"]

    avg_quiz = 0
    if quizzes:
        avg_quiz = round(sum(q["percentage"] for q in quizzes) / len(quizzes))

    best_match = 0
    if analyses:
        best_match = max(a["match_percentage"] for a in analyses)

    return jsonify({
        "success":           True,
        "interviews_count":  len(interviews),
        "avg_quiz_score":    avg_quiz,
        "best_skill_match":  best_match,
        "total_sessions":    len(sessions),
        "recent":            sessions[:5],
    })


# ══════════════════════════════════════════════════════════════════════════════
# HEALTH CHECK
# ══════════════════════════════════════════════════════════════════════════════

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    print(f"🚀 HirePrep backend running at http://localhost:{port}")
    app.run(debug=debug, port=port, host="0.0.0.0", use_reloader=False)
