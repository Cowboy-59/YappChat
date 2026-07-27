---
name: audience-and-outcome-definer
description: Defines exactly who the course is for and the concrete, measurable transformation students will achieve, producing a precise audience profile and a full set of learning outcomes. Use when someone says "who is my course for", "define my target student", "write my learning outcomes", "what transformation does my course deliver", "I need to describe my audience", "my outcomes feel vague", "what should students be able to do after my course", or needs to clarify the promise before writing a single lesson. Run this after course-validator and before curriculum-architect.
---

# Audience and Outcome Definer

A course that tries to serve everyone serves no one. This skill produces two deliverables that every other part of the course builds on: a precise audience profile that describes the exact student you are writing for, and a complete set of learning outcomes that spell out the measurable transformation those students will achieve. Getting these right is what separates a curriculum that flows from one that meanders.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run `course-setup` first. Pull: `brand.audience`, `brand.transformation`, `course.topic`, `course.level`, `outcomes.primary_outcome`, `outcomes.modules_estimate`, `voice.tone_words`.

## Inputs

Ask only for what is missing: a description of the intended student (even a rough one), the core skill or topic the course covers, and the change the student should experience by the end. If the course has already been through course-validator, pull the restated concept from that output.

## Workflow

1. **Draft the audience portrait.** Build a one-page profile of the ideal student using five dimensions:
   - **Situation:** where they are right now (role, life stage, context).
   - **Pain:** the specific frustration, failure, or gap they are experiencing.
   - **Prior attempts:** what they have already tried and why it did not solve the problem.
   - **Goal:** the concrete change they want to see in their work or life.
   - **Vocabulary:** the words and phrases they use to describe the problem (not the expert's language).
   Write the profile in second person ("you are a...") to make it feel direct and resonant.

2. **Define who the course is not for.** Write three to five "this course is not for you if..." statements. These sharpen positioning, reduce refunds, and help the right students self-select in. Be specific and kind, not exclusionary.

3. **Write the primary transformation statement.** One sentence: "[STUDENT TYPE] will go from [BEFORE STATE] to [AFTER STATE] by [MECHANISM]." This is the headline promise. Test it against the specificity criteria in the reference file before moving on.

4. **Write the full learning outcomes set.** For each module in the planned course (use `outcomes.modules_estimate` or ask for a rough module count), write two to three outcomes using the Bloom's Taxonomy action-verb framework. Each outcome must:
   - Begin with a measurable action verb (list, apply, create, evaluate, distinguish, build).
   - Name the specific content or skill.
   - Specify the context or level of performance.
   - Avoid the verbs "understand," "appreciate," "know," and "be aware of" (they are not measurable).

5. **Write the course-level terminal outcomes.** These are the three to five big-picture results a student has by the very end of the course. They are the proof that the transformation happened. Format: "By the end of this course, you will be able to [verb] [specific outcome]."

6. **Produce the audience and outcome snapshot.** A one-page summary combining the audience portrait, the transformation statement, and the terminal outcomes. This is what goes in the course intro, on the sales page, and at the top of every module guide.

## Output format

Return these four deliverables in order: (1) Audience Portrait (second person, five dimensions), (2) "Not for you if..." list, (3) Primary Transformation Statement, (4) Learning Outcomes by Module (table: module name, outcomes 1-3), (5) Terminal Outcomes (bulleted list), (6) Audience and Outcome Snapshot (condensed one-pager combining the above).

## Power Tools (optional, when connected)

If `tools.planner` is Notion, offer to save the Audience and Outcome Snapshot to a Notion page using the notion-create-pages tool. Confirm the workspace and page location before creating. If Notion is absent, produce the snapshot as a formatted markdown block the user can paste into their planning doc.

## File output
This is an internal working artifact that feeds the next skill in the workflow, so keep it as markdown in chat; no document is needed. If the buyer wants to keep or share it, offer to export it as a .docx.

## Reference library

Load these for depth when the task calls for it:
- `references/outcome-frameworks.md`: Bloom's Taxonomy verb banks organized by cognitive level, the ABCD outcome-writing format, audience-portrait templates with five worked examples, and a transformation-statement scoring rubric with good and weak examples.
- `references/audience-research-methods.md`: how to gather primary evidence for audience profiles (survey questions, community listening frameworks, interview templates) and how to synthesize it into a profile when research is unavailable.

## Worked example

See `examples/audience-and-outcome-definer-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The audience portrait names a specific person in a specific situation, not a demographic category.
- The "not for you" list is concrete and kind, not vague or condescending.
- The transformation statement has a clear before state, after state, and mechanism.
- Every learning outcome uses a Bloom's action verb and specifies context or performance level.
- No outcome uses "understand," "appreciate," "know," or "be aware of."
- Terminal outcomes are genuinely terminal: they represent what students hold in their hands (or can do) at the end of the course, not ongoing aspirations.
- The snapshot would read clearly to a prospective student and a curriculum designer equally.
