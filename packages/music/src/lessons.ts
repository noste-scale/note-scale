import type { Lesson } from "./types";

export const LESSONS: readonly Lesson[] = [
  {
    id: "notes",
    title: "1. Les notes",
    summary: "Sept noms, dans le même ordre.",
    paragraphs: [
      "Les notes se répètent toujours dans cet ordre : Do, Ré, Mi, Fa, Sol, La, Si.",
      "La notation internationale utilise C, D, E, F, G, A et B.",
    ],
    notes: ["Do = C", "Ré = D", "Mi = E", "Fa = F", "Sol = G", "La = A", "Si = B"],
  },
  {
    id: "tones",
    title: "2. Ton et demi-ton",
    summary: "Compte chaque touche, blanche ou noire.",
    paragraphs: [
      "Un demi-ton est le plus petit déplacement entre deux notes. Un ton contient deux demi-tons.",
      "Mi–Fa et Si–Do sont naturellement séparés par un demi-ton : ils sont collés.",
      "Do–Ré et Ré–Mi sont séparés par un ton.",
    ],
  },
  {
    id: "formula",
    title: "3. La formule majeure",
    summary: "T – T – ½ | T – T – T – ½",
    paragraphs: ["Deux tons, un demi-ton, puis trois tons et un demi-ton."],
  },
  {
    id: "c-major",
    title: "4. Do majeur",
    summary: "Do – Ré – Mi – Fa – Sol – La – Si – Do",
    paragraphs: [
      "Do majeur suit exactement la formule sans dièse ni bémol.",
      "Do–Ré : ton, Ré–Mi : ton, Mi–Fa : demi-ton, Fa–Sol : ton, Sol–La : ton, La–Si : ton, Si–Do : demi-ton.",
    ],
  },
  {
    id: "d-major",
    title: "5. Ré majeur",
    summary: "Ré – Mi – Fa♯ – Sol – La – Si – Do♯ – Ré",
    paragraphs: [
      "Commence par les lettres Ré, Mi, Fa, Sol, La, Si, Do, Ré.",
      "Après Mi, il faut un ton : Fa devient Fa♯. Après Si, il faut un ton : Do devient Do♯.",
      "Chaque nom de note apparaît une seule fois et la formule reste respectée.",
    ],
  },
] as const;
