# Course Profile Guide

Field-by-field notes on the config.json keys: what each one means, how to fill it in well, and examples for common course types.

---

## brand block

**brand_name**
The name the student sees. Could be a personal name, a business name, or just a DBA. If the creator has not decided yet, use a placeholder and update later.

Good: "The Ceramics School", "Marcus J. Finance", "Bloom Copywriting"
Weak: "my brand", "TBD"

**website**
The main URL where the creator is known or where the course will live. Used to keep generated content on-brand. Can be left empty if the course is pre-launch with no site yet.

**niche**
The category the course lives in. Be specific enough to be useful.

Good: "dog training for first-time owners", "bookkeeping for food trucks", "watercolor portraits"
Weak: "business", "art", "health"

**audience**
The ideal student, described with enough detail that you could spot them in a room.

Good: "mid-career HR managers at companies with 50-200 employees who want to move into people operations leadership"
Weak: "anyone interested in HR"

**transformation**
The before-and-after the student experiences. This is the emotional and practical arc, not just a feature list.

Good: "from overwhelmed freelancer who dreads tax season to someone who actually looks forward to quarterly reviews because they have a system"
Weak: "they learn tax stuff"

---

## course block

**topic**
The subject and scope. More specific is better here.

Good: "Quarterly tax planning and retirement contributions for U.S.-based freelancers earning $50k-$200k"
Weak: "taxes for freelancers"

**format**
How it is delivered. This affects how lesson scripts are written, what slide decks look like, and what workbooks need to do.

Examples: "self-paced video, 5-10 min per lesson", "live weekly cohort via Zoom with async replays", "text-based written modules with downloadable PDFs", "hybrid: recorded modules plus a live monthly Q&A"

**level**
Honest level assessment. Skills like `lesson-scripter` and `quiz-and-assessment-builder` use this to calibrate assumed knowledge, vocabulary, and how much to explain from first principles.

Options: "beginner", "intermediate", "advanced", "beginner to intermediate", "intermediate to advanced"

**price_point**
The planned or actual price. Helps `course-sales-page-writer` calibrate the copy length, objection handling, and value justification. A $2,000 course needs more proof than a $97 one.

Examples: "$197 one-time", "$997 with payment plan", "$49/month membership", "free lead magnet, paid upgrade at $297"

---

## voice block

**tone_words**
Three short descriptors that capture the teaching style. These get pulled into every skill to calibrate language.

Good: ["direct", "warm", "story-driven"]
Good: ["technical", "precise", "patient"]
Avoid: ["professional", "helpful", "good"] (too generic)

**we_sound_like**
One or two sentences describing the vibe in the creator's own words, or as if describing a trusted teacher they admire.

Good: "A seasoned practitioner who has made every mistake so the student doesn't have to. Explains technical things plainly, calls out shortcuts, and is honest when something is hard."

**we_never_say**
Things to avoid in all generated content. Can include words, claims, promises, or phrasing styles.

Examples: "no passive income promises", "never say 'simple' or 'easy'", "avoid jargon without explanation", "no before/after income claims"

**reading_level**
"simple" (grade 6-8, conversational) or "technical" (discipline-specific vocabulary is fine, used where appropriate). Default is simple.

---

## outcomes block

**primary_outcome**
The one thing a student can do, have, or feel at the end that they could not before. Keep it concrete and action-oriented, not abstract.

Good: "A fully built Q4 tax plan and a Roth IRA contribution schedule they set up themselves during the course"
Weak: "understand tax planning better"

**modules_estimate**
A rough count. Helps `curriculum-architect` know the scale it is designing for. Can be a range.

Examples: "5 modules", "8-10 modules with 4 lessons each", "unknown, let Claude suggest"

---

## tools block

These mirror the Power Tools available in this pack. If the creator has connected a tool, its name goes here. If not connected, leave the default value and the matching skills will fall back to producing text output instead.

- **design**: "Canva" (for slide templates, workbook layouts, graphics)
- **ai_media**: "Higgsfield" (for course promo visuals, talking-head b-roll, thumbnail images)
- **planner**: "Notion" (for course outline database, lesson tracker, launch calendar)
- **email**: "Klaviyo" (for launch emails and student onboarding sequences)

---

## preferences block

**save_outputs_to**
Where Claude should save or suggest saving completed artifacts. Default is "your working folder". Can also be a subfolder name like "drafts/" or "module-1/".
