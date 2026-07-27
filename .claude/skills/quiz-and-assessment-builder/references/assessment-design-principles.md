# Assessment Design Principles

## Formative vs. summative assessment

**Formative assessment** happens during the learning process. Its job is to surface misunderstanding early so the student can correct course before the stakes are high. Module knowledge checks, mid-lesson polls, and reflection prompts are formative. Low or no stakes. Immediate feedback is more valuable than a score.

**Summative assessment** happens at the end of a module, section, or course. Its job is to confirm that the learning objective was met. Final module quizzes and end-of-course projects are summative. Stakes are higher; a minimum passing score matters.

For most online courses, the most effective approach is:
- One short formative check mid-module (2-5 questions, unscored or low-stakes).
- One summative quiz at the end of each module (5-10 questions, scored with a pass threshold).
- One culminating project or final quiz at the end of the course (optional, but recommended for anything $297 or higher).

---

## Recommended question counts by module length

| Module length (video/lesson time) | Formative check | End-of-module quiz |
|---|---|---|
| Under 15 minutes | 2-3 questions | 4-6 questions |
| 15-30 minutes | 3-4 questions | 6-8 questions |
| 30-60 minutes | 4-5 questions | 8-12 questions |
| Over 60 minutes (or multi-lesson module) | 5-7 questions | 10-15 questions |

Rule of thumb: one question per major concept introduced, plus one application or scenario question for every "here's how you use this" moment in the lesson.

---

## Passing threshold guidance

**70%:** Appropriate for awareness-level courses, introductory material, or topics where partial understanding is acceptable. Common in free or low-cost courses.

**75-80%:** The most common threshold for paid self-paced courses. Signals genuine understanding without being punishing.

**85-90%:** Appropriate for professional certification, compliance training, or any course where the student will apply the knowledge in a context where errors have real consequences.

**Retake policy:** Most platforms allow unlimited retakes. Randomize question order and rotate from a question bank to prevent "answer memorization" retakes. Require a 24-hour wait on third and subsequent attempts if the platform supports it.

---

## Remediation paths (what a failing student should do)

A quiz that just says "you failed, try again" is an incomplete tool. Build in a remediation path:

1. **Score 50% or below:** Return to the full module and complete it again from the start.
2. **Score 51-69% (or below threshold):** Identify the specific questions missed. Re-watch or re-read the lesson sections that cover those concepts. Attempt again.
3. **Score at or above threshold:** Congratulate briefly and move forward. Do not make the student re-review content they already demonstrated understanding of.
4. **Score 95-100%:** Acknowledge the achievement with a short note. Optionally, offer a "challenge" or bonus resource for high scorers who want to go deeper.

---

## Platform-specific import formats

### Teachable
Teachable does not support native quiz CSV import; quizzes must be built in the course builder UI. Export your questions as a clean numbered list with "Correct: [letter]" notation so the creator can paste them efficiently.

### Thinkific
Thinkific supports quiz creation through its course builder. No CSV import for quizzes. Export as a structured markdown list: question, options labeled A/B/C/D, correct answer, rationale.

### Kajabi
Kajabi's Assessments feature supports multiple-choice and short-answer questions, built in-platform. No import format. Output clean copy-paste blocks.

### Google Forms
Google Forms can be exported/imported via the Forms API, but for manual builds, output questions in this format:

```
Question: [stem]
Option A: [text]
Option B: [text]
Option C: [text]
Option D: [text]
Correct answer: [letter]
Points: [number]
Feedback (correct): [rationale]
Feedback (incorrect): [rationale pointing to the right answer]
```

### Typeform
No import format. Output clean structured copy. Label each question block.

### General LMS (Moodle, LearnDash, etc.)
Many LMS platforms support the GIFT format or Aiken format for multiple-choice import. When the creator mentions one of these platforms, ask which format their LMS supports and output accordingly.

**GIFT format example:**
```
::Question title:: Question stem? { =Correct answer ~Wrong answer 1 ~Wrong answer 2 ~Wrong answer 3 }
```

**Aiken format example:**
```
Question stem?
A. Option text
B. Option text
C. Option text
D. Option text
ANSWER: B
```

---

## Principles for quiz feedback

The feedback a student sees after answering is often more instructive than the lesson itself because they are at peak attention (they just found out they were wrong). Make the rationale count:

- **Correct answer rationale:** Confirm why it's right in one sentence. Reinforce the concept.
- **Wrong answer rationale:** Name the misconception and correct it directly. Avoid "that's not right, the correct answer is X." Instead: "This answer confuses [concept A] with [concept B]. The key difference is [one sentence]."
- **Never just give the answer.** A student who reads "Correct answer: B" without context has not learned anything from getting it wrong.

---

## Reflection prompts as assessment alternatives

For topics where right/wrong answers are not appropriate (mindset, strategy, personal application), use structured reflection prompts instead of scored quizzes:

- "Describe one place in your current [workflow/business/practice] where you could apply [concept from this module]. What specifically would you change?"
- "What was the most surprising thing you learned in this module, and why?"
- "Write a one-paragraph plan for implementing [module framework] in the next seven days."

These are assessed by the creator or a community facilitator, not automatically. Include a rubric with the prompt if the course grants a certificate.
