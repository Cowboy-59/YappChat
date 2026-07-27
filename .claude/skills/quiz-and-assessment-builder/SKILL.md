---
name: quiz-and-assessment-builder
description: Builds knowledge checks, quizzes, and end-of-module assessments tied directly to each module's learning objective. Use when someone says "write a quiz for my module", "I need a knowledge check", "make an assessment", "test my students on this", "add questions to module [X]", "build a quiz", or "how do I know if students got it". Reach for this skill after the course outline exists and you need to validate learning at every stage.
---

# Quiz and Assessment Builder

A well-placed knowledge check does two things: it proves the student learned something, and it shows you exactly where the gaps are before they move on. This skill writes purpose-built quizzes for every module in your course, grounded in the learning objective rather than random trivia, using the question types that match the cognitive level required.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run the `course-setup` skill first. Pull: `brand.audience`, `course.topic`, `course.level`, `outcomes.primary_outcome`, `outcomes.modules_estimate`, `voice.tone_words`, `voice.reading_level`.

## Inputs

Ask only for what is missing: the module name or number, the module's learning objective (one sentence: "By the end of this module, students will be able to..."), any key concepts or terms the module introduces, the preferred question format (multiple-choice, true/false, short answer, scenario-based, or a mix), and the desired number of questions. If a full course outline already exists, use it rather than asking again.

## Workflow

1. **Extract the cognitive level.** Read the learning objective's verb (recall, explain, apply, analyze, evaluate, create) and map it to Bloom's Taxonomy. The question types should match: recall objectives get definitions and fact checks; apply objectives get scenario-based and "what would you do next" questions; analyze objectives get case comparisons. State the level before writing the first question so the calibration is visible.

2. **Write the questions.** Draft one question per key concept, plus at least one application scenario if the objective is above recall level. For each question, write the full stem, all answer options (for multiple-choice, four options with one correct and three plausible distractors), and flag the correct answer.

3. **Write the answer rationale.** For every question, add a one-to-two-sentence explanation of why the correct answer is right and why the most tempting wrong answer is wrong. This is the actual teaching moment and the thing most quiz tools skip.

4. **Add a scoring guide.** Specify: total points available, pass threshold (recommend 70-80% for most courses), and what a student who scores below threshold should do (re-read the module, watch a specific lesson again, ask a question in the community).

5. **Format for the platform.** If the course is hosted on a platform that imports CSV or a specific question format (Google Forms, Teachable, Thinkific, Kajabi), output a ready-to-paste version with the correct column structure. Otherwise, output clean markdown the creator can copy directly.

## Output format

A labeled assessment block per module: module name, learning objective, cognitive level, questions with answer options, correct answer flags, rationale for each question, and a scoring guide. If multiple modules are requested, separate each with a clear heading.

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/question-types-and-bloom.md`: full mapping of Bloom's Taxonomy levels to question types, with 3 example questions per level, guidelines for writing effective distractors, and common mistakes to avoid.
- `references/assessment-design-principles.md`: principles for formative vs. summative assessment, recommended question counts per module length, passing-threshold guidance for different course types, and platform-specific import formats.

## Worked example

See `examples/quiz-module-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- Every question connects directly to the stated learning objective; no trivia or off-topic fact checks.
- Cognitive level of questions matches the verb in the objective (apply-level objectives get scenario questions, not just definitions).
- Distractors are plausible, not obviously wrong; no "all of the above" or "none of the above" shortcuts.
- Every question includes a rationale that teaches, not just confirms.
- The scoring guide specifies a pass threshold and a clear remediation path for students who miss it.
- Reading level matches `voice.reading_level` from config; no unnecessarily complex phrasing.
- Output is platform-ready (correct format, clearly labeled, copy-paste or import-ready).
