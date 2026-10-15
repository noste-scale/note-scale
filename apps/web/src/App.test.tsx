import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LESSONS, MAJOR_SCALES, createEmptyProgress, createExercise, recordAttempt } from "@notescale/music";
import App, { ExerciseCard, ProgressContext, ProgressPage } from "./App";
import { getScale } from "./domain";

function render(path: string): string {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe("web route states", () => {
  it("keeps primary navigation before main content on desktop while retaining one mobile tab bar", () => {
    const html = render("/");
    expect(html.match(/aria-label="Navigation principale"/g)).toHaveLength(1);
    expect(html.indexOf("Navigation principale")).toBeLessThan(html.indexOf("id=\"contenu\""));
    expect(html).toContain('<button type="button" class="skip"');
    expect(html).not.toContain('href="#contenu"');
    expect(html).toContain('id="contenu" tabindex="-1"');
  });

  it("renders the shared lesson catalog with complete interval guidance", () => {
    const html = render("/apprendre");
    for (const lesson of LESSONS) {
      expect(html).toContain(lesson.title.replace(/^\d+\.\s*/, ""));
      for (const paragraph of lesson.paragraphs) expect(html).toContain(paragraph);
    }
    expect(html).toContain("Do–Ré : ton");
    expect(html).toContain("Après Mi, il faut un ton");
    expect(html).toContain('class="interval-pattern"');
    expect(html).toContain('class="semitone"');
  });

  it("shows loading rather than empty statistics before progress hydration", () => {
    const html = render("/progression");
    expect(html).toContain("Lecture des données locales");
    expect(html).not.toContain("class=\"stats\"");
  });

  it("renders explicit non-crashing states for invalid query and route input", () => {
    expect(render("/exercices?gamme=H")).toContain("La gamme « H » n’est pas prise en charge");
    expect(render("/exercices?gamme=")).toContain("Le paramètre de gamme est vide");
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(() => render("/gammes/%E0%A4%A")).not.toThrow();
    expect(render("/gammes/%E0%A4%A")).toContain("Page introuvable");
    warning.mockRestore();
  });

  it("renders canonical flat black-key labels on a flat-key page", () => {
    const html = render("/gammes/Db");
    expect(html).toContain("Écouter Ré♭");
    expect(html).toContain("Écouter Si♭");
    expect(html).not.toContain("Écouter Do♯");
  });

  it("gives compact audio controls unique scale-aware labels", () => {
    const html = render("/gammes");
    expect(html).toContain("Écouter Do majeur");
    expect(html).toContain("Écouter Sol majeur");
  });

  it("names each catalog destination without changing its visible label", () => {
    const html = render("/gammes");
    for (const scale of MAJOR_SCALES) {
      expect(html).toContain(`aria-label="Détails de ${getScale(scale.id)!.frenchName}" href="/gammes/${encodeURIComponent(scale.id)}"`);
    }
    expect(html.match(/>Détails<\/a>/g)).toHaveLength(15);
  });

  it("keeps formula groups intact and exposes one labeled exercise selector", () => {
    expect(render("/")).toContain('<span>T · T · ½</span><span><b aria-hidden="true">|</b> T · T · T · ½</span>');
    const html = render("/exercices");
    expect(html).toContain('Type d’exercice<select');
    expect(html.match(/<option /g)).toHaveLength(5);
    expect(html.match(/selected=""/g)).toHaveLength(1);
    expect(html).toContain('<button type="button" disabled="">Nouvelle question</button>');
    expect(html).not.toContain('class="chips"');
  });

  it("renders native radio rows without text-entry help and describes text answers", () => {
    for (const type of ["identify-interval", "build-scale"] as const) {
      const exercise = createExercise(type, MAJOR_SCALES[0]!, () => 0);
      const html = renderToStaticMarkup(<ExerciseCard scale={getScale("C")!} exercise={exercise} />);
      if (exercise.options) {
        expect(html).toContain('<legend>Ta réponse</legend>');
        expect(html.match(/type="radio"/g)).toHaveLength(exercise.options.length);
        expect(html).not.toContain("answer-help-");
        expect(html).not.toContain("Sépare plusieurs notes");
      } else {
        expect(html).toContain(`aria-describedby="answer-help-${exercise.id}"`);
        expect(html).toContain(`id="answer-help-${exercise.id}"`);
        expect(html).toContain("Sépare plusieurs notes");
      }
      expect(html).toContain('<div class="actions"><button class="primary">Valider ma réponse</button></div>');
    }
  });

  it("offers an empty-progress continuation and uses singular and plural count labels", () => {
    const now = new Date();
    let progress = createEmptyProgress();
    for (let attempts = 0; attempts <= 2; attempts += 1) {
      const html = renderToStaticMarkup(<MemoryRouter><ProgressContext.Provider value={{ progress, ready: true, record: () => undefined }}><ProgressPage /></ProgressContext.Provider></MemoryRouter>);
      expect(html).toContain(`<b>${attempts}</b><span>${attempts === 1 ? "exercice" : "exercices"}</span>`);
      expect(html).toContain(`<b>${attempts}</b><span>${attempts === 1 ? "bonne réponse" : "bonnes réponses"}</span>`);
      expect(html).toContain(attempts === 0 ? '<b>0</b><span>jours de suite</span>' : '<b>1</b><span>jour de suite</span>');
      if (attempts === 0) expect(html).toContain('href="/exercices"');
      else expect(html).not.toContain("Ta première gamme t’attend");
      progress = recordAttempt(progress, { scaleId: "C", exerciseType: "build-scale", correct: true }, now, () => attempts / 3);
    }
  });
});
