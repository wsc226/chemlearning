# ChemAssistant — v1 Architecture

Voice-answer-only quiz app. Chemistry quizzes are the primary v1 goal; naturalization interview
prep and free-response academic assessments are later phases that reuse the same pipeline with
an AI grading layer added on top.

## Platform

Web app / PWA (React or Next.js). Works on iOS Safari and Android Chrome without an app store.
Can be wrapped later (Capacitor) if native distribution is ever needed.

## Answer input

Plain text field. The user answers by tapping the device keyboard's dictation mic (iOS/Android
system feature, works in any text field with zero extra code) and speaking. No custom audio
recording, no STT API, no per-answer cost. Question text is optionally read aloud via the
browser's built-in `speechSynthesis` (also free, no API).

Tradeoff accepted: nothing technically stops a user from typing instead of speaking. Fine for
personal/self-directed use. If this ever needs to be enforced (e.g. for other people's use), the
answer-input step can be swapped for a record-and-transcribe (Whisper) flow later without
touching grading — both approaches end at "here's a text transcript, grade it."

## Grading — v1: no AI at all

Every v1 quiz type (element, ion, nomenclature, acids/bases, reaction type) has exactly one
correct answer, so grading is pure text matching against a question's canonical answer, with a
list of accepted aliases and a normalization step. No Gemini/DeepSeek/Claude call is needed
anywhere in v1 — that keeps the whole app runnable with zero API keys.

### Normalization pipeline (applied to transcript before comparing)

1. Lowercase, trim, strip punctuation/extra whitespace.
2. Map spoken number words to digits ("two" → "2") — needed for element counts, ion charges.
3. Compare against `canonicalAnswer` and `acceptedAliases` (exact match after normalization).
4. Optional fallback: small edit-distance tolerance (e.g. Levenshtein ≤ 1) to absorb minor
   dictation slips, before marking wrong.

### Voice-friendly question design

Dictation handles clean spoken words well and struggles with notation (subscripts, ionic
charges like "2+"). So v1 question directions are chosen to keep answers as a single word or
short phrase:

- Element quiz: show symbol or atomic number → answer is the element **name** (not the other
  way around, since spelling out a symbol by voice is awkward).
- Ion quiz: show the formula → answer is the ion **name** ("sulfate," not "SO4 2-").
- Nomenclature: show the formula → answer is the compound **name**.
- Acids/bases: show the formula → answer is the **name**, or ask to classify strong acid vs.
  strong base.
- Reaction type: answer is always one of exactly 5 known category words — the most
  dictation-robust quiz type in the set (see alias table below).

Formula-*writing* (name → formula, spoken aloud) is a fine v2 addition once we're ready to add a
number/symbol parser to the normalizer — not needed for v1 given the above.

## Assessment modes

Two modes, selectable per quiz session:

- **Immediate feedback**: after each answer, show correct/incorrect (and the fun fact, if
  present) before advancing to the next question.
- **Summarized feedback**: no reveal during the quiz; answers are graded and stored silently as
  the user goes, and a results screen (score + per-question breakdown + fun facts) is shown only
  after the final question is submitted.

Since v1 grading is local/instant (no AI call), this is purely a UI-timing choice — both modes
run the same grading logic per answer; they only differ in when the result is displayed. No
extra backend or data model needed beyond storing each answer's result in session state
regardless of mode.

## Question bank — data-driven, not hand-authored per question

For element/ion/nomenclature/acid-base quizzes, questions are generated from small structured
data tables rather than writing every Q&A pair by hand. This avoids repeating the same
symbol/name/formula data across multiple question directions and makes it trivial to add more
elements/ions/compounds later.

```jsonc
// elements.json — one record per element; questions generated from this
{
  "symbol": "C",
  "name": "carbon",
  "atomicNumber": 6,
  "aliases": []  // e.g. alternate acceptable spellings, if any
}
```

```jsonc
// ions.json
{
  "formula": "SO4^2-",
  "name": "sulfate",
  "charge": -2,
  "aliases": ["sulfate ion", "sulphate"]
}
```

```jsonc
// compounds.json — nomenclature + acid/base quizzes
{
  "formula": "H2SO4",
  "name": "sulfuric acid",
  "category": "strong acid",       // or "strong base" / "covalent" / "ionic"
  "constituentIons": ["H+", "SO4^2-"],  // null for covalent
  "aliases": [],
  "funFact": "Sulfuric acid is the highest-volume industrial chemical produced worldwide."
}
```

```jsonc
// reactions.json — hand-authored per question (not generated; each is a specific instance)
{
  "level": 1,                       // 1 = full equation shown, 2 = reactants only
  "reactants": ["2 Na", "Cl2"],
  "products": ["2 NaCl"],           // shown only at level 1
  "correctType": "synthesis"
}
```

Reaction-type answers are checked against a **shared global alias table** (not repeated per
question):

| Category | Accepted aliases |
|---|---|
| synthesis | combination |
| decomposition | — |
| single_replacement | single displacement |
| double_replacement | double displacement, metathesis |
| combustion | — |

"Fun fact" fields (nomenclature, acids/bases) are just a data field shown on the feedback screen
after the user answers — no logic beyond that.

## Ion quiz — charge and formula answer parsing

Ion questions split into two answer styles, per William's guidance:

**Charge-only** (all cations, all monoatomic anions): question shows the ion name (e.g. "Iron
(III) ion," "Fluoride ion"), answer is just the charge. Both phrasing orders are accepted —
"3 plus" and "positive 3" — via a small dedicated parser rather than an alias list per ion
(charge phrasing combinations would otherwise multiply across ~46 ions):

```
parseChargeAnswer(transcript) -> signed integer | null
```

It tokenizes the (normalized) transcript, recognizes a number (digit or word "one".."five") and
a sign word ("plus"/"positive" → +, "minus"/"negative" → -) in either order, and returns the
signed value to compare against the ion's stored charge. Since William noted the *proper*
convention is number-then-sign, the UI can show a one-line tip when a sign-first answer is
graded correct ("Correct — by convention, charge is stated as '3 plus,' not 'positive 3'") without
marking sign-first wrong.

**Formula + charge** (polyatomic anions, primary mode; occasionally charge-only as a mix-in):
question shows the ion name, answer is the full spoken formula and charge (e.g. "S O four two
minus" for SO4^2-). This is the highest speech-recognition risk in the whole app — dictation
transcribing individually-spoken letters is inherently noisier than a whole word like "sulfate."
Needed for this:

```
parseFormulaChargeAnswer(transcript, expectedFormula, expectedCharge) -> bool
```

It splits the transcript into tokens, maps each to either an element symbol (via a lookup table
covering how dictation tends to render spoken letters — "s"/"es" → S, "o"/"oh" → O, "c"/"see" → C,
"cl"/"chlorine" → Cl, etc.), a subscript digit, or the trailing charge phrase (reusing
`parseChargeAnswer`), then reassembles and compares the formula. **Recommend prototyping this
against real on-device dictation before writing much content for it** — accuracy here is
unverified until tested, unlike the rest of the app which is plain word-matching. If it proves
unreliable, fall back to charge-only or name-recall for polyatomic ions and revisit later.

## Grading/AI layer — reserved for v2+

Not used by any v1 quiz, but the architecture reserves a single interface for when free-response
question types are added (naturalization interview, open-ended academic short answer):

```
gradeAnswer(question, answerKey, transcript) -> { correct: bool, feedback: string }
```

- **Free tier**: user supplies their own Gemini API key ("bring your own key"). Stored client-side
  (localStorage). The browser calls Gemini's `generateContent` endpoint directly — this endpoint
  doesn't trigger the CORS issue some newer Gemini endpoints have, so no backend proxy is needed.
  Zero cost and zero API-key liability for us; the user's own free-tier quota governs their usage.
- **Paid tier**: backend proxies to DeepSeek or Qwen (our key, never exposed to the client) behind
  auth + subscription check. Token costs are low enough (~$0.0002–0.0005 per graded answer) that a
  monthly subscription comfortably covers heavy use.

## Ads (free tier) — deferred

William wants ads shown on the free tier; setup deferred until requested. Worth noting now: since
v1 is a plain web app (not a wrapped native app), this points toward a standard web ad network
(e.g. Google AdSense) rather than a mobile ad SDK (e.g. AdMob) — simpler integration, consistent
with the web-first platform choice. Revisit when ready.

## Open items

- First-20-elements list (William providing).
- Ion list for high-school/AP scope (William sending screenshot).
- Reaction-type question content (specific equations for each of the 5 types × 2 levels).
