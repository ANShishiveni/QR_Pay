## NamPay Usability Testing Plan

This guide outlines how to plan, run, and analyze usability testing for NamPay. It includes objectives, participant profile, test tasks, metrics to collect, data capture templates, scripts, and reporting structure.

---

### 1) Objectives and Research Questions
- Assess whether first‑time and returning users can complete core flows without assistance.
- Identify usability issues that slow users down or cause errors.
- Measure perceived usability and satisfaction (SUS, SEQ, NPS).
- Validate clarity of terminology (Request Payment (QR), Scan QR, reference, transactions, cards).
- Validate security/auth cues (OTP, “Secure Payment” copy, confirmations).

Key questions:
- Can users discover and complete: sign in, generate a QR with reference, scan QR, confirm payment with OTP?
- Do users understand where to change password, manage cards, and update profile photo?
- Are error messages and toasts helpful and timely?
- Are buttons and labels clear (e.g., Confirm, Cancel) and visually prominent?

Success criteria (example targets):
- ≥ 90% task completion without moderator intervention.
- Median time-on-task within 1.5× of expert baseline per task.
- Mean Single Ease Question (SEQ) ≥ 5.5/7 per task.
- System Usability Scale (SUS) ≥ 80 (Grade A).

---

### 2) Participant Profile and Sample Size
- 5–8 participants per iteration (think-aloud method).
- Mix of demographics typical for target users (age 18–60, smartphone users, basic banking familiarity).
- Screening: owns Android device, can receive SMS; has made digital payments before.

Recruitment notes:
- Avoid coworkers/classmates who know the product intimately.
- Offer small incentive (voucher/airtime) if allowed by ethics policy.

---

### 3) Test Environments
- Primary: Android device running Expo (physical device preferred). Ensure stable internet.
- Optional: Web build in Chrome for quick A/B of copy and layout.
- Backend: point to current test backend (verify IP in `frontend/src/config/api.js`).

Pre‑test checklist:
- Twilio verified number active; OTP is deliverable.
- Backend and database reachable (health check OK).
- Seed at least two accounts/cards for realistic flows.
- Clear any stale OTP sessions if needed.

---

### 4) Tasks (User Scenarios)
Run tasks in the order below. Read the task prompt verbatim, and avoid coaching unless the participant is stuck for >60 seconds.

1. Sign in
   - Prompt: “Please sign in to your account.”
   - Success: Arrives on home with no blocking errors.

2. Generate QR to Request Payment (with mandatory reference)
   - Prompt: “Request N$ 100.00 from a friend. Include reference ‘Movie tickets’.”
   - Success: QR generated; reference visible; able to share image (optional).

3. Scan QR to Send Money
   - Prompt: “Scan the QR you just generated and proceed to pay.”
   - Success: Camera permission granted, request recognized, flows to confirmation screen.

4. Confirm Payment with OTP
   - Prompt: “Complete the payment by confirming with the SMS code you receive.”
   - Success: Enters correct OTP, sees success toast, navigates back to main.

5. Manage Cards
   - Prompt: “Open My Cards, add a card, and set a default card.” (Use test data.)
   - Success: Card appears, default set, success toasts shown.

6. Update Profile
   - Prompt: “Open My Profile, change your profile photo, and update your last name.”
   - Success: Photo updates, data persists on refresh.

7. Change Password (Settings)
   - Prompt: “Change your password to a new secure password (you can change it back later).”
   - Success: Validations work; password changed successfully.

8. Help & Support
   - Prompt: “Find how to contact support.”
   - Success: Participant discovers and understands the Help & Support entry.

---

### 5) Metrics to Collect

Quantitative (per task):
- Task success (Success / Success‑with‑assist / Fail).
- Time on task (sec) – start when prompt finishes, stop at success or abandon.
- Errors: count and description (validation errors, wrong navigation, OTP failures).
- Assists: number and nature of moderator hints.
- Clicks/Taps to completion; backtracks.
- OTP delivery latency (sec) and first‑try success (Y/N).
- QR scan success rate and latency to detect.

Subjective (per task):
- Single Ease Question (SEQ, 1–7): “Overall, how easy or difficult was this task?”
- Confidence rating (1–5): “How confident are you you did this correctly?”

Post‑test (global):
- System Usability Scale (SUS, 10 items, 1–5 Likert).
- Net Promoter Score (NPS, 0–10): “How likely would you recommend NamPay?”
- Overall satisfaction (1–7) and top 3 issues.

Optional workload: NASA‑TLX (if you expect cognitive/temporal load to matter).

---

### 6) Data Capture Templates

Task log (one row per task per participant):

```
Participant ID | Task | Success(S/SA/F) | Time(s) | Errors (# + short notes) | Assists | Taps | Backtracks | Notes (verbatim quotes)
```

Per‑task SEQ:

```
Task | SEQ (1–7) | Confidence (1–5) | Comments
```

Post‑test:

```
SUS total (0–100): __
NPS (0–10): __
Overall satisfaction (1–7): __
Top issues (free text):
1)
2)
3)
```

Bug severity rubric:
- Blocker: prevents task completion; security/auth failure; crash.
- Major: confusing flow; wrong or missing feedback; long latency.
- Minor: cosmetic; copy; spacing; iconography.

---

### 7) Moderator Script (Think‑Aloud)
Opening:
- “Thank you for helping today. We’re testing the app, not you. Please think aloud as you go.”
- “If you get stuck, say what you’re looking for. There are no right or wrong answers.”
- Consent: confirm recording permission and anonymous reporting.

During tasks:
- Remind to think aloud; avoid coaching. If stuck >60s, offer a neutral nudge (e.g., “What would you try next?”). Record any hints given.

Closing:
- Administer SUS + NPS + satisfaction. Ask: “What was the most frustrating part? What was the best part?”

---

### 8) Analysis
Steps:
1. Compute per‑task completion rates, median time, error and assist counts.
2. Summarize OTP metrics (delivery latency, first‑try pass rate), QR scan success/latency.
3. Aggregate SEQ per task; compute SUS and NPS.
4. Thematic analysis of observations/quotes; group by feature (QR Generate, Scan, OTP, Cards, Profile, Settings).
5. Prioritize issues with Impact × Frequency × Effort matrix. Propose fixes.

Reporting template:
- Executive summary (key findings, SUS/NPS, 5–8 bullets of critical issues).
- Methods (participants, environment, tasks, metrics).
- Results (tables/graphs for completion, time, SEQ, OTP/QR metrics).
- Issues & Recommendations (grouped by severity with mockups if needed).
- Appendix (raw task logs, questionnaires).

---

### 9) Privacy, Ethics, and Consent
- Store data anonymously (use Participant IDs). Remove phone numbers and OTPs from shared docs.
- Obtain informed consent for participation and any recording.
- Allow participants to skip tasks or withdraw at any time.

---

### 10) Operational Checklist (Day of Test)
- [ ] Backend up; IPs correct; test accounts seeded; SMS OTP working.
- [ ] Devices charged; screen recording (optional) configured.
- [ ] Consent forms and questionnaires printed/digital.
- [ ] Timer and templates ready; note‑taking roles assigned.
- [ ] Dry‑run complete; rollback plan if backend fails.

---

### 11) Artifacts Included (copy/paste ready)

Single Ease Question (SEQ):
```
“Overall, how easy or difficult was this task?” 1(Very difficult)…7(Very easy)
```

System Usability Scale (SUS):
Use the standard 10‑item questionnaire (1=Strongly disagree…5=Strongly agree). Score 0–100.

NPS question:
```
“How likely are you to recommend NamPay to a friend or colleague?” 0–10
```

Raw notes template (per participant):
```
ID: P__  Date: __  Device/OS: __  App build: __  Network: __

Observations:
-
-

Notable quotes:
- “…”
- “…”

Issues observed (with severity):
- [Severity] Description → Suggested fix
```

---

### 12) After the Study
- Synthesize results within 48 hours while memories are fresh.
- Share a short readout with prioritized next steps and owners.
- Plan a follow‑up iteration (test → fix → re‑test) focused on the top 5 issues.


