import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LESSONS } from "@notescale/music";
import App from "./App";

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
});
