---
name: lesson-scripter
description: Writes a single course lesson as a full teaching script with a hook, sequenced teaching beats, concrete examples, and a clear action step the student takes before moving on. Use when someone says "write my lesson script", "script this lesson for me", "I need to record this lesson", "what should I say in this lesson", "write the script for lesson [X]", "I need a teaching script", "help me explain this concept clearly", "write out the teaching for this module", or is about to record and needs words, not an outline. Run this after curriculum-architect for each lesson you are ready to record.
---

# Lesson Scripter

A lesson outline tells you what to teach. A lesson script tells you exactly what to say, in what order, and with which examples, so you sit down in front of a camera or microphone and record without second-guessing yourself. This skill writes the full script: a hook that earns the student's attention, teaching beats that build understanding progressively, at least one concrete example that makes the concept real, and an action step that moves the student forward before they click away.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run `course-setup` first. Pull: `brand.audience`, `brand.transformation`, `course.topic`, `course.level`, `voice.tone_words`, `voice.we_sound_like`, `voice.we_never_say`, `voice.reading_level`.

## Inputs

Ask only for what is missing: the lesson title, the lesson's learning objective (from the curriculum-architect output if available), the lesson type (concept, demonstration, worked example, practice, or synthesis), any key points the lesson must cover, and the target length in minutes. If the full curriculum blueprint exists, pull the lesson entry directly.

## Workflow

1. **Write the hook (30-60 seconds).** The hook must earn the student's attention before teaching begins. Choose from these three hook types:
   - Problem hook: name the exact pain or failure mode this lesson solves ("Before I learned this, I was doing X and getting Y result every time...").
   - Curiosity hook: surface a counterintuitive fact or a surprising contrast ("Most people think [common belief]. Here's why that's exactly backwards...").
   - Promise hook: state the specific outcome this lesson delivers and why it matters now ("By the end of this lesson you will be able to [specific skill], which means you can [concrete benefit] starting today.").
   Write the hook as spoken words, in first person, in the voice defined by `voice.tone_words` and `voice.we_sound_like`.

2. **Write the learning objective statement (15 seconds).** A single spoken sentence that names what the student will be able to do by the end. This is not the same as the hook; it is a direct, calm statement. "In this lesson we are going to cover [topic] so that you can [specific outcome]."

3. **Write the teaching beats.** Break the lesson into three to five beats. Each beat is one idea, one step, or one building block. For each beat:
   - State the point in one sentence (the headline).
   - Explain it in two to four sentences (the body).
   - Give one concrete example that fits the `brand.audience` context (the anchor).
   - Transition to the next beat with one bridging sentence.
   Label each beat clearly in the script so the instructor knows where they are.

4. **Write the anchor example.** At least one beat must contain a fully written-out example: a scenario, a before-and-after, a case, or a demonstration walk-through. The example must be:
   - Specific: a named fictional persona, a specific number, a concrete situation.
   - Complete: it should show the concept in use from start to finish, not just reference it.
   - Honest: do not make the example unrealistically easy or the result impossibly good.

5. **Write the summary and callback (30-45 seconds).** At the end of the teaching beats, summarize in two to three sentences: "We covered [beat 1], [beat 2], and [beat 3]. The key idea is [single most important takeaway]."

6. **Write the action step.** Every lesson ends with one specific thing the student does before the next lesson. The action step must:
   - Be completable in under 30 minutes.
   - Produce a visible output (a written answer, a completed template section, a decision made and recorded, an attempt at the skill).
   - Connect directly to the lesson's learning objective.
   Write the action step as a direct instruction: "Before the next lesson, [specific task]."

7. **Write the bridge to the next lesson (15 seconds).** One sentence connecting this lesson's outcome to what is coming next, creating forward momentum.

## Output format

Return the full script with labeled sections: HOOK, OBJECTIVE, BEAT 1 through N, SUMMARY, ACTION STEP, and BRIDGE. Add [PAUSE] markers where the instructor should let a point land before continuing. Add [SHOW: visual description] markers where a screen share, diagram, or image should appear. Include a word count and an estimated reading time at the top of the script (average reading speed is 130 words per minute at a calm instructional pace).

## Power Tools (optional, when connected)

If `tools.design` is Canva, offer to generate a simple title card or lesson intro graphic for the lesson using generate-design. Describe the visual concept first and confirm before generating. If Canva is absent, describe the visual as a note in the script (e.g., "[VISUAL: title card showing lesson number, title, and the single learning objective in large text]").

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/lesson-structures-and-teaching-patterns.md`: the five lesson type scripts in detail (concept, demonstration, worked example, practice, synthesis), example beats for each type, hook formulas with worked examples, explanation patterns (ELI5, analogy, contrast, example-first), and common script failure modes to avoid.
- `references/action-step-and-example-bank.md`: 30 plug-and-play action step formats across lesson types, five fully written anchor-example patterns with [BRACKET] slots, and calibration notes for beginner, intermediate, and advanced students.

## Worked example

See `examples/lesson-scripter-run.md` for a full lesson script to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The hook is written as spoken words, not a bullet point list.
- Every teaching beat follows the point-explanation-example-transition structure.
- At least one anchor example is fully written out with a specific fictional scenario, not just referenced.
- The action step is completable in under 30 minutes and produces a visible output.
- The script reads as natural spoken language, not formal prose or bullet points read aloud.
- [PAUSE] and [SHOW] markers are included where they genuinely help the instructor.
- The script matches the voice defined by `voice.tone_words` and avoids words in `voice.we_never_say`.
- Estimated reading time is within 20% of the target lesson length.
