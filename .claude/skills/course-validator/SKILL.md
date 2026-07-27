---
name: course-validator
description: Pressure-tests a course idea against real demand, competitive landscape, and promise viability before a single lesson is built. Use when someone says "is my course idea good", "will anyone buy this", "validate my course", "should I build this course", "test my course concept", "is there demand for this", "is the market too crowded", "can I charge [price] for this", or wants to avoid wasting months building something nobody wants. Run this before curriculum-architect any time the course concept has not yet been vetted.
---

# Course Validator

Most courses fail before the first lesson is written, because the creator skipped the step that matters most: finding out whether real people want what they are building. This skill pressure-tests your course idea across four lenses (demand, competition, promise, and fit) and returns a clear go / refine / stop verdict with specific reasons and fixes.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run `course-setup` first. Pull: `brand.niche`, `brand.audience`, `brand.transformation`, `course.topic`, `course.format`, `course.price_point`, `voice.tone_words`.

## Inputs

Ask only for what is missing: a one-sentence course idea or working title, the intended audience, and the price point (or range). If the user already has a course title and description, use those.

## Workflow

1. **Restate the concept.** Write back the course idea in one clean sentence: "[AUDIENCE] will learn [SKILL/TRANSFORMATION] so they can [OUTCOME]." Ask the user to confirm or correct before continuing.

2. **Run the demand audit.** Score the idea on three demand signals:
   - Search intent: does the problem have a name people type into Google or YouTube? List 3-5 specific search phrases the audience would use.
   - Community evidence: where does this audience congregate, and are they actively complaining about or asking for help with this problem? Name specific forum types, subreddit categories, or community platforms (without linking to live pages).
   - Willingness to pay: does this audience already buy courses, coaching, or tools to solve this problem? What price range is plausible for the format and depth?

3. **Map the competitive landscape.** Identify three competitor archetypes (not real brands): a free alternative (YouTube/blog content), a low-price competitor (under [PRICE_LOW]), and a premium competitor (over [PRICE_HIGH]). For each, note what it does well and what gap it leaves. The gap is where the course lives.

4. **Stress-test the promise.** Take the transformation from step 1 and run it through four questions:
   - Is the outcome specific enough to be believable?
   - Can a student achieve it within the course (not after years of practice)?
   - Can the creator credibly teach it?
   - Does the price match the perceived value of the outcome?
   Flag any answer that is weak and explain why.

5. **Creator-fit check.** Ask the user (or infer from config): does the creator have direct experience producing this outcome? Do they have existing proof (results, a portfolio, testimonials, a track record)? Note the credibility gap if one exists.

6. **Produce the verdict.** Score each of the four lenses (demand, competition, promise, fit) on a 1-5 scale. Aggregate to a verdict:
   - All 4 scores at 3 or above: **Go** (with any caveats noted).
   - One score at 2 or below: **Refine** (with specific fixes).
   - Two or more scores at 2 or below, or any score at 1: **Stop and rethink** (with a reframe suggestion).

7. **Write the fix list.** For every score below 4, write one actionable fix the creator can apply in a day. Prioritize the lowest score first.

## Output format

Return a structured report with these sections: Restated Concept, Demand Audit (three signals with findings), Competitive Landscape (three archetypes and the gap), Promise Stress-Test (four questions with answers), Creator-Fit Check, Verdict Scorecard (table: lens, score 1-5, one-line note), and Fix List (ordered by priority). Keep the total under 600 words unless a section genuinely needs more depth.

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/validation-frameworks.md`: the full demand-signal scoring rubrics, competitive-gap analysis method with five examples, promise-strength criteria, creator-fit assessment guide, and a worked scorecard showing how to calibrate 1-5 scores.
- `references/price-and-market-fit.md`: price-point benchmarks by format and audience type, willingness-to-pay signals, and repositioning strategies for saturated niches.

## Worked example

See `examples/course-validator-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The restated concept is concrete: audience, skill, and outcome are all specific.
- Demand signals name real search phrases, community types, and buying behaviors, not vague generalities.
- The competitive gap is identified precisely, not just "there is room in the market."
- The promise stress-test gives honest assessments, including flagging weak points even when the overall verdict is Go.
- Scores are discriminating: not every lens scores a 4 or 5.
- Every low score has a paired fix that is actionable within a day.
- The verdict is unambiguous: Go, Refine, or Stop, with a reason.
- No hype language; no false reassurance; no generic advice that could apply to any course.
