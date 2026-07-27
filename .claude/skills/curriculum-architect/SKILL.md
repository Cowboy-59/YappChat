---
name: curriculum-architect
description: Builds the complete course outline from modules to individual lessons, each with a learning objective, sequence rationale, and estimated length, giving you a finished curriculum blueprint ready to record. Use when someone says "build my course outline", "create my curriculum", "what modules should my course have", "map out my course structure", "I need a lesson plan for my course", "how should I sequence my course", "what should each module cover", "how many lessons do I need", or is ready to move from course concept to a full buildable plan. This is the flagship skill of the Course Creator pack; run it after audience-and-outcome-definer.
---

# Curriculum Architect

A great course is not a collection of things you know about a topic. It is a sequenced journey from a specific before state to a specific after state, where every lesson earns its place. This skill builds that journey: a complete curriculum blueprint with modules, lessons, learning objectives, sequence rationale, and time estimates, structured so a student progresses with momentum and finishes with a real result.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run `course-setup` first. Pull: `brand.audience`, `brand.transformation`, `course.topic`, `course.format`, `course.level`, `outcomes.primary_outcome`, `outcomes.modules_estimate`, `voice.tone_words`, `voice.reading_level`.

## Inputs

Ask only for what is missing: the course topic, the primary transformation (from audience-and-outcome-definer if available), the target student level (beginner, intermediate, or advanced), the intended format (self-paced video, cohort, hybrid), and a rough target for total course length in hours. If a completed audience-and-outcome-definer output exists, use its terminal outcomes to anchor the curriculum.

## Workflow

1. **Establish the learning arc.** Before writing a single module, map the journey:
   - Start state: what the student knows and can do on day one (assume nothing beyond this).
   - End state: what the student knows, can do, and has built by the final lesson.
   - The arc: identify two to four major "turning points" between start and end, where the student's mental model or capability shifts significantly. These become the module boundaries.
   Write the arc as a one-paragraph narrative ("The student arrives knowing X and leaves with Y, moving through three shifts: from [A] to [B], from [B] to [C], from [C] to [D]..."). This is the spine of the curriculum.

2. **Design the module structure.** Break the arc into modules. Each module must:
   - Represent one major shift in capability or understanding.
   - Have a clear module-level outcome ("By the end of this module, the student will be able to...").
   - Contain three to seven lessons (aim for five as the default; fewer than three suggests a topic too thin for a module, more than seven suggests splitting).
   - End with a completion marker: something the student has done, made, or decided (not just watched).
   Name each module with a student-facing title that describes the outcome, not just the topic (e.g., "How to Price Your Services for Profit" not "Pricing").

3. **Map every lesson.** For each module, write a lesson entry with:
   - Lesson number and title (student-facing, outcome-oriented).
   - Learning objective (one Bloom's verb + specific content + context, referencing the verb bank in the reference files).
   - Core teaching point: the single most important idea the student leaves with (one sentence).
   - Estimated length (minutes, for a video lesson: aim for 8-15 minutes; 20 minutes max for dense material).
   - Lesson type: concept lesson, demonstration lesson, worked example lesson, practice lesson, or synthesis lesson.

4. **Sequence audit.** Review the full lesson list and apply four sequence checks:
   - **Prerequisite order:** does every lesson assume only what was taught in earlier lessons? Flag any lesson that assumes knowledge introduced later.
   - **Momentum curve:** does the difficulty and complexity rise progressively? Flag any sharp jumps.
   - **Practice distribution:** is there at least one practice or application lesson in every module? Flag modules that are all concept.
   - **Completion markers:** does every module end with something the student has created or decided? Add a synthesis or action lesson if not.

5. **Write the "Quick Win" first.** Identify which lesson in Module 1 (or early in Module 2) delivers the fastest, most tangible result. Confirm it is positioned as a hook: a student who gets a quick win in the first 30 minutes of a course is far more likely to complete it. Name the quick win explicitly in the curriculum notes.

6. **Produce the curriculum blueprint.** Deliver the full structured outline in this format: one row per lesson, columns for module, lesson number, lesson title, learning objective, lesson type, and estimated length. Precede the table with the learning arc narrative and the module summaries. Follow the table with the sequence audit findings and fixes.

## Output format

Return three parts in order: (1) Learning Arc Narrative (paragraph), (2) Module Summaries (one block per module: title, module outcome, completion marker, lesson count, total estimated time), (3) Full Curriculum Table (module, lesson number, title, learning objective, type, minutes), (4) Sequence Audit (four checks, any flags, and fixes applied).

## Power Tools (optional, when connected)

If `tools.planner` is Notion, offer to create the curriculum as a Notion database with columns for module, lesson title, objective, type, length, and status (not started / scripted / recorded / published). Confirm before creating. Use notion-create-database and then notion-create-pages for each lesson row. If Notion is absent, deliver the curriculum table in markdown and suggest copying it to any spreadsheet or project tool.

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/curriculum-blueprints.md`: five full module-to-lesson blueprint patterns (linear skill build, project-based, problem-solution, habit formation, professional certification style) with structural rules and when to use each; sequence heuristics; lesson type guide with examples; and completion-marker menu.
- `references/lesson-types-and-timing.md`: the five lesson types in depth (concept, demonstration, worked example, practice, synthesis), how to mix them across a module, pacing tables by course format, and a time-estimation guide for video, text, and live instruction.

## Worked example

See `examples/curriculum-architect-run.md` for a full curriculum blueprint to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The learning arc narrative names specific turning points, not generic "you will grow" language.
- Every module has a student-facing outcome statement and a named completion marker.
- Every lesson has a single-sentence learning objective with a Bloom's action verb.
- Lesson types are mixed across each module: not all concept, not all demo.
- The sequence audit is honest: any prerequisite gaps, momentum drops, or missing practice lessons are flagged and fixed, not glossed over.
- Total estimated course time is consistent with the format and price point.
- The Quick Win lesson is named and positioned in the first 30 minutes of the course.
- No module has fewer than three or more than seven lessons without an explicit rationale.
