import { Link } from "react-router-dom";
import { LESSONS, type Lesson } from "@notescale/music";
import { Page } from "./components";
import { getScale, type UiScale } from "./domain";
import { Piano } from "./music-components";

export function Home() {
  return (
    <section className="hero">
      <p className="eyebrow">La musique, pas à pas</p>
      <h1>Construis toutes les gammes majeures</h1>
      <p className="lead">Une seule formule. Des explications claires. Quelques minutes par jour.</p>
      <div className="formula" aria-label="Ton, ton, demi-ton, ton, ton, ton, demi-ton">
        <span>T · T · ½</span><span><b aria-hidden="true">|</b> T · T · T · ½</span>
      </div>
      <div className="actions">
        <Link className="primary" to="/apprendre">Apprendre</Link>
        <Link className="button" to="/gammes">Toutes les gammes</Link>
        <Link className="button" to="/exercices">Exercices</Link>
        <Link className="button" to="/progression">Ma progression</Link>
      </div>
      <Link className="daily" to="/quotidien">
        <b>Entraînement du jour</b>
        <span>3 à 5 minutes →</span>
      </Link>
    </section>
  );
}

const MAJOR_INTERVALS = ["ton", "ton", "demi-ton", "ton", "ton", "ton", "demi-ton"] as const;

function IntervalPattern() {
  return (
    <div className="interval-pattern" aria-label="Ton, ton, demi-ton, ton, ton, ton, demi-ton">
      {MAJOR_INTERVALS.map((interval, index) => (
        <span className={interval === "ton" ? "tone" : "semitone"} key={index}>
          <b>{interval === "ton" ? "T" : "½"}</b>
          <small>{interval}</small>
        </span>
      ))}
    </div>
  );
}

function LessonBody({ lesson }: { lesson: Lesson }) {
  let exampleScale: UiScale | undefined;
  if (lesson.id === "c-major") exampleScale = getScale("C");
  else if (lesson.id === "d-major") exampleScale = getScale("D");
  return (
    <>
      {lesson.summary && <p className="notes">{lesson.summary}</p>}
      {lesson.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {lesson.notes && <p>{lesson.notes.join(" · ")}</p>}
      {lesson.id === "tones" && (
        <>
          <div className="tone-guide">
            <span className="semitone"><b>½ ton</b> · 1 touche</span>
            <span className="tone"><b>1 ton</b> · 2 demi-tons</span>
          </div>
          <Piano notes={[]} />
        </>
      )}
      {["formula", "c-major", "d-major"].includes(lesson.id) && <IntervalPattern />}
      {exampleScale && (
        <ol className="lesson-steps">
          {exampleScale.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
      )}
    </>
  );
}

export function Learn() {
  return (
    <Page title="Apprendre" intro="Comprends la règle avant de mémoriser.">
      <div className="stack">
        {LESSONS.map((lesson, index) => (
          <details className="card lesson" key={lesson.id} open={index === 0}>
            <summary><span>{index + 1}</span>{lesson.title.replace(/^\d+\.\s*/, "")}</summary>
            <div><LessonBody lesson={lesson} /></div>
          </details>
        ))}
      </div>
      <div className="actions">
        <Link className="primary" to="/generateur">Essayer le générateur</Link>
        <Link className="button" to="/gammes">Voir les 15 gammes</Link>
      </div>
    </Page>
  );
}
