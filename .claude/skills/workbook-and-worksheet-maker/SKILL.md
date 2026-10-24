---
name: workbook-and-worksheet-maker
description: Builds a companion workbook, exercises, and action steps for a course module, giving students a structured place to apply what they learned and produce real outputs. Use when someone says "make a workbook for my course", "create worksheets for module [X]", "I need exercises for my students", "build the companion materials", "make a fillable workbook", "create practice activities", "design the student workbook", "I need reflection questions and exercises", or wants to give students something to do between lessons. Run this after curriculum-architect for any module you are ready to produce.
---

# Workbook and Worksheet Maker

The workbook is where learning becomes doing. A student who watches a lesson is informed; a student who completes the workbook exercise has practiced the skill, made a decision, or built a real artifact. This skill produces the full companion workbook for a module: one worksheet per lesson, a module summary, reflection prompts, and a capstone action that integrates everything the student covered.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run `course-setup` first. Pull: `brand.audience`, `brand.transformation`, `course.topic`, `course.level`, `voice.tone_words`, `voice.reading_level`, `tools.design`, `preferences.save_outputs_to`.

## Inputs

Ask only for what is missing: the module name, the list of lessons in the module (titles and learning objectives), the module's completion marker (from the curriculum-architect output if available), and the student level. If a full lesson script exists for any lesson, use it to inform the exercises.

## Workflow

1. **Write the module overview page.** Every workbook module opens with a one-page orientation:
   - Module name and number.
   - Two to three sentences on what this module covers and what the student will have at the end.
   - A "Before You Start" prompt: one question the student answers before the first lesson, based on their current knowledge or situation. This sets a baseline they can compare against after the module.
   - A visual progress tracker: a simple checklist of the lessons in the module (fill in the checkboxes as you complete each lesson).

2. **Write one worksheet per lesson.** Each worksheet has four elements:
   - **Lesson recap (one to two lines):** the core point of the lesson in plain language. This is written for the student, not the instructor.
   - **The exercise:** the specific task tied to this lesson's action step. It is not a comprehension quiz; it is a doing task that produces a visible output. Match the exercise to the lesson type (concept lesson: reflection or categorization; demonstration: replication; practice: original production; synthesis: integration task).
   - **Output placeholder:** a labeled space, a template, a table, or a text box where the student writes, fills in, or builds their output. Make the output format explicit: lines, a table, a labeled diagram, a fill-in-the-blank sentence, a decision matrix.
   - **Reflection question:** one question the student answers after completing the exercise, connecting the lesson to their own situation. "What surprised you about your answer?" or "Where in your current [PROJECT/WORK] does this apply?"

3. **Write the module synthesis exercise.** After all lesson worksheets, add a capstone exercise that integrates the skills from the whole module. This exercise:
   - Requires the student to use outputs from at least two earlier worksheets.
   - Produces the module's completion marker artifact (the named deliverable from the curriculum-architect output).
   - Is more open-ended than individual lesson exercises: it gives a prompt and a structure, not a step-by-step fill-in.

4. **Write the module reflection page.** After the synthesis exercise, a brief reflection:
   - "What is the single most important thing you learned in this module?"
   - "What will you do differently starting this week?"
   - "What is one question you still have?"
   These three questions take under five minutes and dramatically increase retention and transfer.

5. **Write the progress commitment.** The last element of each module's workbook section is a commitment: "Before the next module, I will [SPECIFIC ACTION] by [DATE/TIMEFRAME]." This is a written commitment the student makes to themselves, not a mandatory check-in.

6. **Apply the workbook quality checks.** Review every exercise against these standards before delivering:
   - Does every exercise produce a visible output the student can hold, save, or share?
   - Is every output placeholder specific enough that the student knows what to write without re-watching the lesson?
   - Is the reading level appropriate for the audience (per `voice.reading_level`)?
   - Does the module as a whole build toward the completion marker defined in the curriculum?

## Output format

Return the full workbook module as markdown, formatted for easy conversion to a designed document. Use clear section headers, labeled placeholders (shown as [STUDENT FILLS IN]), and logical spacing. Include a note at the top: "Workbook for [COURSE TITLE], Module [N]: [MODULE NAME]. Print or use in a fillable PDF tool."

## Power Tools (optional, when connected)

If `tools.design` is Canva, offer to lay out the workbook module as a designed PDF using create-design-from-brand-template or generate-design. Describe the layout and confirm before generating. Export as PDF using export-design. If Canva is absent, the markdown output can be formatted in Google Docs, Word, or any document tool using the structure as a layout guide. Point to `connectors/POWER-TOOLS-SETUP.html` for setup.

## File output
This is a finished, shareable asset, so deliver it as a polished PDF. Draft and confirm the content, then build the file with the pdf skill and save it to your working folder. Offer a .docx version too if the buyer will edit it. Do not hand over raw markdown as the final artifact.

## Reference library

Load these for depth when the task calls for it:
- `references/exercise-types-and-worksheet-templates.md`: full taxonomy of exercise types (recall, application, analysis, creation, reflection, planning), when to use each, and 10 ready-to-adapt worksheet templates with labeled output placeholders.
- `references/workbook-design-principles.md`: how to write instructions students actually follow, output placeholder design, reading level calibration, and a quality rubric for evaluating workbook exercises before delivery.

## Worked example

See `examples/workbook-and-worksheet-maker-run.md` for a complete module workbook to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- Every exercise produces a visible, specific output, not a general reflection.
- Output placeholders are labeled and specific: the student knows exactly what to put in each field.
- The module synthesis exercise genuinely requires outputs from at least two earlier worksheets.
- The module reflection page uses the exact three questions from the workflow (not variations).
- The workbook can be completed without re-watching any lesson, but rewards re-watching.
- Reading level matches `voice.reading_level` throughout.
- The progress commitment at the end is a specific action, not an aspiration.
- The total workbook for one module takes a motivated student 45-90 minutes to complete.
