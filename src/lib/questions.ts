/**
 * Question generation from structured data tables.
 *
 * Questions are generated programmatically from elements.json and ions.json rather than
 * hand-authored per question (per ARCHITECTURE.md). This makes it trivial to add more
 * elements/ions later.
 */

import elementsData from '@/data/elements.json';
import ionsData from '@/data/ions.json';
import {
  gradeElementAnswer,
  parseChargeAnswer,
  parseFormulaChargeAnswer,
  isConventionalChargeOrder,
  gradeIonNameAnswer,
  type GradeResult,
} from './grading';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuestionType =
  | 'element_name'
  | 'ion_charge'
  | 'ion_formula_charge'
  | 'ion_name';
export type AssessmentMode = 'immediate' | 'summary';

export interface Question {
  id: string;
  type: QuestionType;
  /** Main display text (e.g. "Na", "11", "Sulfate ion", "Fe³⁺") */
  prompt: string;
  /** Label for the prompt (e.g. "Element Symbol", "Atomic Number", "Ion Name", "Ion Symbol") */
  promptLabel: string;
  /** Instruction text (e.g. "Name this element", "What is the charge?", "Name this ion") */
  instruction: string;
  /** Shown after grading (e.g. "Sodium", "1+", "Iron (III) ion") */
  correctDisplay: string;
  /** Grading function — takes the user's answer text and returns a GradeResult */
  grade: (answer: string) => GradeResult;
  /** Optional fun fact shown on the feedback screen */
  funFact?: string;
  /** Text for browser speechSynthesis to read aloud */
  speakText: string;
}

// ---------------------------------------------------------------------------
// Data types (matching JSON shapes)
// ---------------------------------------------------------------------------

interface ElementRecord {
  symbol: string;
  name: string;
  atomicNumber: number;
  aliases: string[];
  funFact: string | null;
}

interface IonRecord {
  name: string;
  formula: string;
  charge: number;
  group?: string;
  aliases?: string[];
  funFact?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fisher-Yates shuffle (in-place, returns the same array). */
export function shuffleArray<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Format a signed charge integer for display: "2+", "3−", "1+", etc. */
function formatChargeDisplay(charge: number): string {
  const magnitude = Math.abs(charge);
  const sign = charge > 0 ? '+' : '−';
  return `${magnitude}${sign}`;
}

/** Format a charge for speech synthesis: "2 plus", "3 minus", etc. */
function formatChargeSpeak(charge: number): string {
  const magnitude = Math.abs(charge);
  const sign = charge > 0 ? 'plus' : 'minus';
  return `${magnitude} ${sign}`;
}

/** Detect whether an ion name contains a Roman-numeral oxidation state. */
function hasOxidationState(name: string): boolean {
  return /\([IViv]+\)/.test(name);
}

// Unicode superscript/subscript characters for chemical formula display
const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
};
const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

/**
 * Format an ion formula with Unicode sub/superscripts for display.
 * "Fe" charge 3  → "Fe³⁺"
 * "Hg2" charge 2 → "Hg₂²⁺"
 * "Cu" charge 1  → "Cu⁺"
 */
function formatIonSymbol(formula: string, charge: number): string {
  // Convert trailing digits in formula to subscript
  let display = formula.replace(/\d/g, (d) => SUBSCRIPT[d] ?? d);

  // Add superscript charge
  const magnitude = Math.abs(charge);
  const signChar = charge > 0 ? '⁺' : '⁻';

  if (magnitude === 1) {
    display += signChar;
  } else {
    display += (SUPERSCRIPT[String(magnitude)] ?? String(magnitude)) + signChar;
  }

  return display;
}

// ---------------------------------------------------------------------------
// Element questions
// ---------------------------------------------------------------------------

/** Number of elements in the core (first-20) tier. */
export const CORE_ELEMENT_COUNT = 20;

export type ElementScope = 'first20' | 'expanded' | 'all';

/**
 * Generate element-name questions from the elements data.
 *
 * Core (first-20) elements get BOTH a symbol-prompt question and an
 * atomic-number-prompt question, to maximize practice on the set students
 * are expected to memorize by number. Expanded-set elements (beyond the
 * first 20) get symbol-prompt questions only — atomic number isn't part
 * of what's being quizzed for that tier. The full set is shuffled before
 * returning.
 *
 * @param scope — which elements to include:
 *   'first20'  → H–Ca (indices 0–19)
 *   'expanded' → elements beyond the first 20 (indices 20+)
 *   'all'      → everything
 */
export function generateElementQuestions(scope: ElementScope = 'first20'): Question[] {
  const all: ElementRecord[] = elementsData.elements;
  const elements =
    scope === 'first20'
      ? all.slice(0, CORE_ELEMENT_COUNT)
      : scope === 'expanded'
        ? all.slice(CORE_ELEMENT_COUNT)
        : all;
  const questions: Question[] = [];

  for (const el of elements) {
    const isCore = el.atomicNumber <= CORE_ELEMENT_COUNT;

    // Symbol-prompt: show "Na" → answer "sodium"
    questions.push({
      id: `element-symbol-${el.symbol.toLowerCase()}`,
      type: 'element_name',
      prompt: el.symbol,
      promptLabel: 'Element Symbol',
      instruction: 'Name this element',
      correctDisplay: el.name.charAt(0).toUpperCase() + el.name.slice(1),
      grade: (answer: string) => gradeElementAnswer(answer, el),
      funFact: el.funFact ?? undefined,
      speakText: `What element has the symbol ${el.symbol.split('').join(' ')}?`,
    });

    // Atomic-number-prompt (core elements only): show "11" → answer "sodium"
    if (isCore) {
      questions.push({
        id: `element-number-${el.atomicNumber}`,
        type: 'element_name',
        prompt: String(el.atomicNumber),
        promptLabel: 'Atomic Number',
        instruction: 'Name this element',
        correctDisplay: el.name.charAt(0).toUpperCase() + el.name.slice(1),
        grade: (answer: string) => gradeElementAnswer(answer, el),
        funFact: el.funFact ?? undefined,
        speakText: `What element has atomic number ${el.atomicNumber}?`,
      });
    }
  }

  return shuffleArray(questions);
}

// ---------------------------------------------------------------------------
// Ion charge questions (fixed-charge ions only)
// ---------------------------------------------------------------------------

/**
 * Generate charge-only questions for fixed-charge ions.
 *
 * Shows the ion name → answer is the charge (e.g. "3 plus" or "positive 3").
 * Variable-charge ions (with oxidation state in name) are excluded —
 * those get name-from-symbol questions instead via generateIonNameQuestions().
 */
export function generateIonChargeQuestions(
  categories: { cations: boolean; monoatomicAnions: boolean },
): Question[] {
  const questions: Question[] = [];

  if (categories.cations) {
    const cations: IonRecord[] = ionsData.cations;
    for (const ion of cations) {
      if (hasOxidationState(ion.name)) continue; // handled by name questions
      questions.push(makeChargeQuestion(ion));
    }
  }

  if (categories.monoatomicAnions) {
    const anions: IonRecord[] = ionsData.monoatomicAnions;
    for (const ion of anions) {
      questions.push(makeChargeQuestion(ion));
    }
  }

  return shuffleArray(questions);
}

function makeChargeQuestion(ion: IonRecord): Question {
  const chargeDisplay = formatChargeDisplay(ion.charge);

  return {
    id: `ion-charge-${ion.formula.toLowerCase()}-${ion.charge > 0 ? 'p' : 'n'}${Math.abs(ion.charge)}`,
    type: 'ion_charge',
    prompt: ion.name,
    promptLabel: 'Ion Name',
    instruction: 'What is the charge?',
    correctDisplay: chargeDisplay,
    grade: (answer: string): GradeResult => {
      const parsed = parseChargeAnswer(answer);
      if (parsed === null) {
        return {
          correct: false,
          feedback: `Could not understand the charge. Say something like "${formatChargeSpeak(ion.charge)}." The correct answer is ${chargeDisplay}.`,
        };
      }
      if (parsed === ion.charge) {
        if (!isConventionalChargeOrder(answer)) {
          return {
            correct: true,
            feedback: `Correct — by convention, charge is stated as "${formatChargeSpeak(ion.charge)}," not the other way around.`,
          };
        }
        return { correct: true };
      }
      return { correct: false, feedback: `The correct charge is ${chargeDisplay}.` };
    },
    funFact: ion.funFact,
    speakText: `What is the charge of the ${ion.name}?`,
  };
}

// ---------------------------------------------------------------------------
// Ion name questions (variable-charge ions: show symbol → answer name)
// ---------------------------------------------------------------------------

/**
 * Generate name-from-symbol questions for variable-charge cations.
 *
 * Shows the ion symbol with charge (e.g. "Fe³⁺") → answer is the ion name
 * (e.g. "Iron (III) ion" / "iron 3" / "iron three").
 *
 * This is more pedagogically useful than asking for charge when the oxidation
 * state is already in the name — the student must recognize the element symbol
 * and associate the correct oxidation state.
 */
export function generateIonNameQuestions(): Question[] {
  const questions: Question[] = [];
  const cations: IonRecord[] = ionsData.cations;

  for (const ion of cations) {
    if (!hasOxidationState(ion.name)) continue; // only variable-charge ions

    const symbolDisplay = formatIonSymbol(ion.formula, ion.charge);

    questions.push({
      id: `ion-name-${ion.formula.toLowerCase()}-${ion.charge > 0 ? 'p' : 'n'}${Math.abs(ion.charge)}`,
      type: 'ion_name',
      prompt: symbolDisplay,
      promptLabel: 'Ion Symbol',
      instruction: 'Name this ion',
      correctDisplay: ion.name,
      grade: (answer: string) => gradeIonNameAnswer(answer, ion),
      funFact: ion.funFact,
      speakText: `Name the ion with symbol ${ion.formula.split('').join(' ')} and charge ${formatChargeSpeak(ion.charge)}.`,
    });
  }

  return shuffleArray(questions);
}

// ---------------------------------------------------------------------------
// Ion formula + charge questions (polyatomic anions — experimental)
// ---------------------------------------------------------------------------

/**
 * Generate formula + charge questions for polyatomic anions.
 *
 * Shows the ion name → answer is the spoken formula and charge
 * (e.g. "S O 4 2 minus" for SO₄²⁻).
 *
 * This is the highest speech-recognition risk in the app (per ARCHITECTURE.md).
 */
export function generateIonFormulaQuestions(): Question[] {
  const anions: IonRecord[] = ionsData.polyatomicAnions;
  const questions: Question[] = [];

  for (const ion of anions) {
    const chargeDisplay = formatChargeDisplay(ion.charge);
    const formulaDisplay = `${ion.formula} ${chargeDisplay}`;

    questions.push({
      id: `ion-formula-${ion.formula.toLowerCase()}-${ion.charge > 0 ? 'p' : 'n'}${Math.abs(ion.charge)}`,
      type: 'ion_formula_charge',
      prompt: ion.name,
      promptLabel: 'Ion Name',
      instruction: 'Say the formula and charge',
      correctDisplay: formulaDisplay,
      grade: (answer: string): GradeResult => {
        const isCorrect = parseFormulaChargeAnswer(
          answer,
          ion.formula,
          ion.charge,
        );
        if (isCorrect) return { correct: true };
        return {
          correct: false,
          feedback: `The correct answer is ${formulaDisplay}.`,
        };
      },
      funFact: ion.funFact,
      speakText: `What is the formula and charge of the ${ion.name}?`,
    });
  }

  return shuffleArray(questions);
}
