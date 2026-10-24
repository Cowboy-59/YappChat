---
name: slide-deck-builder
description: Builds a complete slide-by-slide deck for a course lesson or module, with on-slide text, speaker notes, and visual direction for each slide. Use when someone says "build my slides", "create a slide deck for this lesson", "I need PowerPoint slides for my course", "turn this lesson into slides", "design the slides for module [X]", "what should my slides say", "write speaker notes for my slides", "I'm presenting this and need a deck", or is preparing to record a slide-based lesson or deliver a live module. Run this after lesson-scripter or with a lesson outline in hand.
---

# Slide Deck Builder

A slide deck for a course lesson is not a document that works on its own. It is a visual companion to a spoken performance. This skill builds that companion: a slide-by-slide plan with the exact on-slide text (kept short, never a wall of prose), speaker notes for what to say alongside each slide, and a visual direction note that tells you or your designer what to put on screen so the student sees and hears the idea at the same time.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run `course-setup` first. Pull: `brand.brand_name`, `course.topic`, `voice.tone_words`, `tools.design`, `voice.reading_level`.

## Inputs

Ask only for what is missing: the lesson title and learning objective, the key teaching beats (from the lesson-scripter output if available), any branding direction (colors, fonts, or a style described in config), and whether this is for a recorded video lesson or a live presentation. If a complete lesson script exists, use it as the primary source.

## Workflow

1. **Map the slide types.** Before writing a single slide, identify how many slides the lesson needs and what type each one is. Use this type menu:
   - **Title slide:** lesson number, title, and optional learning objective.
   - **Objective slide:** one sentence stating what the student will be able to do.
   - **Concept slide:** the main idea of one teaching beat, in a headline and at most three supporting points.
   - **Diagram/framework slide:** a visual that shows a model, a process, a comparison, or a structure (described in visual notes for the designer or the instructor to build).
   - **Example slide:** a short case or worked scenario, presented as a two-column before/after, a narrative snippet, or a step sequence.
   - **Quote or stat slide:** a single strong line in large type with a minimal visual.
   - **Practice/prompt slide:** the instruction for the student's action step, displayed while they work.
   - **Summary slide:** three to five bullets recapping the key points of the lesson.
   - **Action step slide:** the specific task the student does before the next lesson.
   - **Bridge slide:** one line pointing to the next lesson.
   Map the slide types across the lesson beats before writing content.

2. **Write each slide.** For every slide, produce three elements:
   - **On-slide text:** the headline (8 words maximum), and if needed, up to three supporting bullet points (eight words each, maximum). If a slide needs more text than this, split it into two slides. No full sentences on slides; no paragraphs.
   - **Speaker notes:** what the instructor says while this slide is visible (two to five sentences). This is the spoken explanation, the example, the transition. It matches the tone from `voice.tone_words` and is written as natural spoken language.
   - **Visual note:** a specific description of what appears on the slide beyond the text: a chart type, an icon, a diagram layout, a color emphasis, an image direction. Write this as a clear brief for a designer or for a Canva template. If the visual is a diagram, describe it in enough detail to build it from scratch.

3. **Apply the three-sentence slide rule.** Read each slide's on-slide text. If the student would spend more than 10 seconds reading it, it has too much text. Edit down until reading time is under 10 seconds. Move the rest to the speaker notes.

4. **Check visual variety.** Review the full deck. If more than three slides in a row are the same type (e.g., three consecutive concept slides with text and bullets), insert a diagram, a quote, an example, or a visual break. Monotony kills retention.

5. **Build the slide summary table.** Produce a table with one row per slide: slide number, slide type, on-slide headline, speaker notes (condensed to one sentence), and visual note. This is the production brief the instructor uses to build the actual deck.

6. **Write the production notes.** At the end of the deck brief, include: recommended total slide count and expected presentation time, any slides that need custom visuals built (flag them), and a note on any slide that would benefit most from animation or a reveal effect.

## Output format

Return two parts: (1) the full slide-by-slide brief (each slide with on-slide text, speaker notes, and visual note clearly labeled), and (2) the slide summary table. Flag any slide that requires a diagram or custom visual with [DESIGN NEEDED].

## Power Tools (optional, when connected)

If `tools.design` is Canva, offer to generate a slide deck using create-design-from-brand-template (if a brand template exists) or generate-design (with a visual direction brief) for the most complex or flagship slides. Confirm which slides to generate and confirm before creating. If Canva is absent, the visual notes section of each slide serves as the brief to build the deck in any presentation tool (PowerPoint, Keynote, Google Slides). Point to `connectors/POWER-TOOLS-SETUP.html` for setup.

## File output
Deliver this as a PowerPoint deck (.pptx), not a list of slides in markdown. Draft the slide content and speaker notes, show the outline in chat, then build the deck with the pptx skill and save it to your working folder.

## Reference library

Load these for depth when the task calls for it:
- `references/slide-patterns.md`: full pattern library for each slide type with labeled examples, the five most common slide mistakes with fixes, a visual-brief writing guide, and a complete reference deck structure for a 10-15 minute lesson.
- `references/visual-direction-guide.md`: how to write visual notes that a designer (or Canva) can execute, diagram types and when to use them, chart selection guide, and image direction conventions.

## Worked example

See `examples/slide-deck-builder-run.md` for a complete lesson slide deck to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- No slide has a headline longer than eight words.
- No bullet point is longer than eight words.
- Speaker notes are written as spoken language, not formal prose.
- Every visual note is specific enough to build from without guessing.
- Slide types vary across the deck: not all concept slides.
- The action step slide contains the complete instruction the student needs without the speaker's narration.
- The deck tells a coherent story when flipped through without audio.
- Total slide count is proportional to lesson length (approximately one slide per 45-60 seconds of instruction is a reasonable benchmark).
