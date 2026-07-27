---
name: course-positioning-and-naming
description: Generates the course name, tagline, one-sentence promise, and positioning angle that make the course the obvious choice for the right student. Use when someone says "name my course", "I need a course title", "what should I call it", "my course name is boring", "course tagline", "positioning for my course", "how do I stand out", "differentiate my course", "what's my angle", or "value proposition for the course". Reach for this skill before writing the sales page or any marketing copy; the name and promise must be locked first.
---

# Course Positioning and Naming

The name of a course does three things at once: it tells the right person they are in the right place, it signals the transformation waiting for them, and it positions the course against every alternative in the market. A weak name makes an excellent course invisible. This skill produces a set of name candidates, a tagline, a sharpened one-sentence promise, and the positioning angle that makes the course the clear choice over "figuring it out alone," competing courses, and doing nothing.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run the `course-setup` skill first. Pull: `brand.brand_name`, `brand.niche`, `brand.audience`, `brand.transformation`, `course.topic`, `course.format`, `course.level`, `course.price_point`, `outcomes.primary_outcome`, `voice.tone_words`, `voice.we_never_say`.

## Inputs

Ask only for what is missing: the core topic of the course (one sentence), the student's biggest frustration before taking the course, the result the student achieves after completing it, any names the creator has already considered (so the skill avoids repeating them), and any names from competing courses the creator wants to differentiate from. If a course outline already exists, use it.

## Workflow

1. **Define the transformation arc.** Restate the student's before state (frustrated, stuck, or missing something) and after state (capable, confident, transformed) in a single sentence. This arc is the raw material for every name and tagline option. Present this arc back to the creator before generating options so any misalignment is caught early.

2. **Generate name candidates across naming formulas.** Produce at least 10 course name options, covering at least 5 of the naming formulas in `references/naming-formulas.md`. Label each with its formula so the creator learns the pattern. A strong name is specific, memorable, and signals the transformation without requiring explanation.

3. **Write a tagline for the top 3 names.** A tagline is the one line below the title that adds context or amplifies the promise. It should answer "what exactly do I get?" or "why this course and not another?" Maximum 12 words. No hype words.

4. **Write the one-sentence course promise.** The promise is the precise, honest statement of what the student will be able to do (or have, or be) after completing the course. Format: "After [course name], you will [specific outcome] even if [the most common objection or prior barrier]." This becomes the lead on the sales page and the anchor for all marketing copy.

5. **Define the positioning angle.** State how this course is positioned relative to the three real alternatives the target student considers: (a) a competing course, (b) figuring it out alone (free content), and (c) doing nothing. For each, write one sentence explaining why this course wins that comparison. This is not about trash-talking competitors; it is about being clear on the specific thing this course does better or differently.

6. **Give a final recommendation.** From the 10 names, recommend one primary name and one backup. Explain the choice in two sentences: what makes it work and why it is the strongest fit for the audience and price point.

## Output format

A structured document with five sections: Transformation Arc, Name Candidates (labeled with formulas), Taglines for Top 3, Course Promise, and Positioning Angle. End with the final recommendation.

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/naming-formulas.md`: 10 course naming formulas with what each does, when to use it, 3 examples per formula, and guidance on matching the formula to price point and audience sophistication.
- `references/positioning-frameworks.md`: the four main positioning frameworks used in course marketing (problem-solution, category creation, against-the-alternative, and identity transformation), with worked examples and the questions to answer for each.

## Worked example

See `examples/course-positioning-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- At least 10 name candidates covering at least 5 distinct naming formulas; no two names feel like the same idea rephrased.
- The transformation arc is specific to this audience; it could not be copied word-for-word for a different course.
- The course promise uses the exact format specified and passes the "could only belong to this course" test.
- The positioning angle addresses all three real alternatives, not just competing courses.
- No hype words appear in any name, tagline, or promise. Names should not require explanation; if it needs parenthetical clarification, it is not ready.
- The final recommendation gives a clear rationale, not just a preference.
- The output respects `voice.we_never_say` throughout.
