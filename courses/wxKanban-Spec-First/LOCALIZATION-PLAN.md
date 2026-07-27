# wxKanban Spec-First — Localization Plan

**Source language:** English (Windows) · **Target languages:** 7
**Delivery:** French recorded separately; the other six dubbed over the English video
**Translated:** lesson content and student workbooks · **Not translated:** planning documents

---

## 1. The languages

You asked for the recommended set plus Dutch and Brazilian Portuguese. That comes to **seven**, not five:

| # | Language | Code | Delivery | Why it's on the list |
|---|---|---|---|---|
| 1 | French | fr | **Separate recording** | PCSoft/WINDEV is a French product with its largest community in France. This is the most important non-English language for this course by a distance. |
| 2 | Spanish | es | Dubbed | Spain plus Latin America. |
| 3 | German | de | Dubbed | Strong WINDEV presence; also the most timing-hostile language to dub (see §4). |
| 4 | Italian | it | Dubbed | Significant PCSoft user base. |
| 5 | Portuguese (Portugal) | pt-PT | Dubbed | European Portuguese. |
| 6 | Portuguese (Brazil) | pt-BR | Dubbed | Brazilian market; distinct enough from pt-PT in vocabulary and register to be worth splitting. |
| 7 | Dutch | nl | Dubbed | Benelux. |

### Decided: both Portuguese variants ship

pt-PT and pt-BR were reviewed as a possible merge and **both are being kept**. That decision carries an obligation, because it is not enough to record the same translation in two accents — if the two tracks aren't genuinely differentiated, you have paid for a second dub and delivered nothing.

The divergence is unusually wide for *this* course, because it lands squarely on the vocabulary of software:

| English | pt-PT | pt-BR |
|---|---|---|
| file | ficheiro | arquivo |
| screen | ecrã | tela |
| user | utilizador | usuário |
| database | base de dados | banco de dados |
| application / app | aplicação | aplicativo |
| settings | definições | configurações |
| to download | descarregar / transferir | baixar |
| record (noun) | registo | registro |
| team | equipa | equipe |
| mouse | rato | mouse |

There is a grammar split too: Portugal's *"estou a fazer"* against Brazil's *"estou fazendo"*, and *tu* against *você*.

**What this requires:** a locked two-column glossary, agreed before the first line is translated, extending the table above to every recurring term in the course — scope, spec, task, gate, phase, branch, commit, migration. Both translators work from it. Without that glossary the two tracks drift into each other and a Portuguese student ends up hearing *arquivo*, which is exactly the outcome the second track exists to prevent.

### One related note on Spanish

Spanish ships as a **single track** covering both Spain and Latin America, which is the mirror image of the Portuguese decision. Brief that translator explicitly to use neutral Spanish: avoid *vosotros*, avoid regionalisms, prefer the vocabulary that reads naturally on both sides of the Atlantic (*computadora*/*ordenador* is the usual flashpoint). One track can serve both audiences well, but only if it is written to, rather than defaulting to the translator's own variety.

---

## 2. Delivery model per language

### French — its own production run

French is not a dub. It is recorded separately, which has one enormous advantage that is easy to miss:

**A separate recording is not constrained by the English video's timing.** The French script can be a proper adaptation rather than a translation squeezed to fit someone else's pacing. Idioms can change. The house-renovation analogy in Lesson 1.1 can become whatever actually lands in French. Examples can use French names and a French context — Thierry already does.

Treat the French scripts as first-class scripts, not as translated English. They should be written to the same lesson objectives and the same beat structure, then allowed to diverge in wording wherever that produces better French.

### Spanish, German, Italian, pt-PT, pt-BR, Dutch — dubbed

One English video, six alternate audio tracks. The video, the screen action, and the on-screen timing are all fixed by the English recording. The translated narration has to fit inside it.

That constraint is the single biggest risk in this plan, and §4 is about nothing else.

---

## 3. Screen captures: the marker system

You asked that the scripts say when a localized screen capture is needed. They now do. Every capture point in every script carries one of three markers:

| Marker | Meaning | Who acts |
|---|---|---|
| `[SHOW ×L: ...]` | **Must be re-captured per language.** Contains text that a student reads. | Localization — one capture per language |
| `[SHOW ×L?: ...]` | **Conditional.** Depends on whether that surface ships localized. Resolve before recording. | You — confirm, then reclassify |
| `[SHOW: ...]` | **Universal.** Capture once, reuse in all seven languages. | Nobody |

### Current counts, from the six scripts written so far

| File | Total | `×L` | `×L?` | Universal |
|---|---|---|---|---|
| Module 1 (1.1, 1.2, 1.3) | 8 | 8 | 0 | 0 |
| Module 2 (2.1, 2.2, 2.3) | 16 | 9 | 1 | 6 |
| **Total** | **24** | **17** | **1** | **6** |

Module 1 is 100% localized because it is all title cards and text diagrams. Module 2 is only 56% localized because half of it is terminal output, File Explorer, and code — none of which changes with language.

### The three kinds of localized asset, in ascending order of cost

**Title cards** — one per lesson. Text only, generated from a template. Seventy-two lessons × seven languages is 504 cards, which sounds enormous and is actually a batch job: one template, one spreadsheet of translated titles, one export. Budget hours, not weeks.

**Text diagrams** — the chain diagram, the six-phase strip, the two-column comparison. Also template work, but each needs a designer's eye because translated labels are longer than English ones and will break a layout that was tuned to English. Design them with room to grow.

**Application screen captures** — the expensive one, and the one with a hard dependency below.

### The dependency you need to resolve

A localized capture of the wxKanban web app is **only possible if the wxKanban UI exists in that language.** I can't verify which locales the product ships from this repository — it's a different codebase.

So, before any localized capture work starts, confirm for each of the seven: does the app UI exist in that language?

- **Where it does:** capture per language. Those `×L` markers stand.
- **Where it doesn't:** the capture stays English, the marker becomes universal, and the dubbed narration needs one added line — something like *"the screen here is in English; your own may differ"* — so the student isn't confused by hearing Dutch while reading English. That line has to be written into the dub script, not improvised in the booth.

This is a genuine fork in the plan. It changes the asset count for six of the seven languages, and it is the first thing to settle.

---

## 4. The timing problem, and what to do about it

Translated speech is longer than English. Not occasionally — reliably.

| Language | Typical expansion over English |
|---|---|
| Spanish | +20–25% |
| German | +20–35% (widest variance; compound nouns cut both ways) |
| Italian | +15–20% |
| Portuguese (both) | +15–20% |
| Dutch | +10–20% |
| French | +15–20% *(not a constraint — French is recorded separately)* |

For a dubbed track over a fixed video, that expansion has nowhere to go. And the six scripts already written split cleanly into two very different risk profiles.

**The demonstrations are fine.** Lessons 2.1, 2.2 and 2.3 narrate at 7.8, 6.7 and 8.3 minutes inside 11, 10 and 14-minute slots. That headroom exists because a demo viewer spends real time watching a download run or setup output scroll — and it happens to be exactly the slack a dub needs. German at +35% on Lesson 2.3 is 11.2 minutes into a 14-minute slot. Comfortable.

**The talking-head lessons are tight.** Lesson 1.1 narrates at 9.7 minutes in a 10-minute slot. German at +30% is 12.6 minutes. There is nowhere for that to go inside a 10-minute video.

### Three ways to handle it, in order of preference

**1. Design headroom into the remaining English scripts.** From here on, target English narration at **roughly 85% of the lesson slot** for every lesson type, not just demonstrations. That single rule makes every future script dubbable without a fight. It affects the 66 scripts not yet written, which is most of them — which is why it is worth adopting now rather than after another ten are done.

**2. Re-time the video for long dubs.** For talking-head lessons the picture is a person and some cards; holding a card three seconds longer is invisible. This is the fallback for the six lessons where headroom cannot be retrofitted, including Lesson 1.1.

**3. Let translators cut.** Brief them that **fit beats literalness**. A dub that races to keep up is worse than one that drops a subordinate clause. Give them explicit permission to compress, and mark which sentences in each script are load-bearing and must survive.

### What must survive compression, in every language

- The three failure-mode names in 1.1 (lost context, silent drift, work nobody can verify).
- The rule in 1.2: *change the document first, then the code*.
- The placeholder-token warning in 2.3.
- Every action step, in full. A student who mishears the action step does nothing at all.

---

## 5. Translation scope

**Translated:** lesson scripts, on-screen text and title cards, action steps, and the student workbooks, worksheets and quizzes that the workbook and assessment skills will generate later.

**Not translated:** the curriculum blueprint, the Core Path document, and this plan. Those are production documents for you and anyone producing with you, not student-facing material.

One consequence worth naming: workbooks are translated but are generated *later* in the pack's workflow. Do not translate a workbook until its module's scripts are locked, or you will pay for the same translation twice.

---

## 6. Folder structure

```
courses/wxKanban-Spec-First/
  config.json
  LOCALIZATION-PLAN.md            this file
  wxKanban-Spec-First-Curriculum-Blueprint.md/.docx
  wxKanban-Spec-First-Core-Path.md/.docx
  scripts/
    en/                           source scripts (currently at the top level; move on first translation)
    fr/                           adaptations, not translations — first-class scripts
    es/  de/  it/  pt-PT/  pt-BR/  nl/     dub scripts, timed to the English video
  assets/
    universal/                    captures reused across all languages
    en/ fr/ es/ de/ it/ pt-PT/ pt-BR/ nl/  localized captures, title cards, diagrams
  workbooks/
    en/ fr/ es/ de/ it/ pt-PT/ pt-BR/ nl/
```

Dub scripts should carry the **English timecode** of each beat once the English video is cut, so the voice artist knows what has to land where. Until the English is recorded, they carry beat labels only.

---

## 7. Order of work

1. **Resolve the app-locale dependency** (§3). Everything downstream of it changes shape depending on the answer.
2. **Adopt the 85% headroom rule** for all remaining English scripts (§4). Cheap now, expensive later.
3. **Finish and lock the English Core Path scripts.** Translating a script that is still being edited means translating it twice, times seven.
4. **Record English.** Only then do dub scripts get real timecodes.
5. **Write the French adaptations.** Independent of English timing, so this can run in parallel with step 4.
6. **Dub the remaining six.**
7. **Workbooks last**, per §5.

---

## 8. Open questions

1. **Does the wxKanban UI ship in each of these seven languages?** Blocking — see §3.
2. ~~Keep both pt-PT and pt-BR?~~ **Resolved: both ship.** The follow-on action is the two-column glossary in §1 — it must be locked before translation begins, not during.
3. **Synthetic or human voice for the six dubs?** Synthetic is far cheaper at this volume (six languages × ~11 hours) and has become good enough for instructional narration; human is warmer and better matches the "patient expert" voice the course is written in. This decision does not block script work, but it does change how tightly the dub scripts need to be timed — synthetic voices can be speed-adjusted after the fact, human ones effectively cannot.
4. **Is the French recording presenter-led by you, or a French-speaking presenter?** If it is a different presenter, the French scripts should be adapted to their voice rather than yours, and the `we_sound_like` line in `config.json` needs a French counterpart.

---

*Companion to `wxKanban-Spec-First-Curriculum-Blueprint.md` and `wxKanban-Spec-First-Core-Path.md`.*
