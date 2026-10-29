import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { constructionDetails, filterScales, safeRouteScaleId } from "./app-model";
import { EmptyDomain, NotFound, Page } from "./components";
import { getScale, scales } from "./domain";
import { AudioPlayer, describeKeySignature, NoteRow, Piano } from "./music-components";

export function ScaleList() {
  const [searchQuery, setSearchQuery] = useState("");
  const matchingScales = filterScales(searchQuery);
  return (
    <Page title="Toutes les gammes" intro="15 écritures conventionnelles, de Do majeur à Do♭ majeur.">
      <label className="search">
        Rechercher une gamme
        <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" />
      </label>
      {!scales.length ? (
        <EmptyDomain />
      ) : !matchingScales.length ? (
        <p className="banner" role="status">Aucune gamme ne correspond à « {searchQuery} ».</p>
      ) : null}
      <div className="grid">
        {matchingScales.map((scale) => (
          <article className="card scale-card" key={scale.id}>
            <h2>{scale.frenchName}</h2>
            <p className="muted">{scale.internationalName}</p>
            <NoteRow notes={scale.notes} />
            <p>{describeKeySignature(scale)}</p>
            <div className="inline">
              <AudioPlayer notes={scale.notes} label={scale.frenchName} compact />
              <Link className="button" to={`/gammes/${encodeURIComponent(scale.id)}`} aria-label={`Détails de ${scale.frenchName}`}>Détails</Link>
            </div>
          </article>
        ))}
      </div>
    </Page>
  );
}

export function ScaleDetail() {
  const { id: routeScaleId = "" } = useParams();
  const decodedScaleId = safeRouteScaleId(routeScaleId);
  const scale = decodedScaleId ? getScale(decodedScaleId) : undefined;
  if (!scale) return <NotFound />;
  return (
    <Page title={scale.frenchName} intro={`${scale.internationalName} · ${describeKeySignature(scale)}`}>
      <NoteRow notes={scale.notes} />
      <AudioPlayer notes={scale.notes} label={scale.frenchName} />
      <section className="card">
        <h2>Clavier</h2>
        <Piano notes={scale.notes} />
      </section>
      <section className="card">
        <h2>Construction</h2>
        <div className="intervals">
          {scale.notes.slice(0, -1).map((note, index) => (
            <span key={`${note.id}-${index}`}>
              <b>{note.label}</b>
              <small>{["ton", "ton", "½ ton", "ton", "ton", "ton", "½ ton"][index]}</small>
            </span>
          ))}
        </div>
        {scale.steps.map((step) => <p key={step}>{step}</p>)}
      </section>
      <Link className="primary" to={`/exercices?gamme=${encodeURIComponent(scale.id)}`}>Commencer un exercice</Link>
    </Page>
  );
}

export function Generator() {
  const [selectedScaleId, setSelectedScaleId] = useState(scales[0]?.id ?? "");
  const [completedIntervalCount, setCompletedIntervalCount] = useState(0);
  const scale = getScale(selectedScaleId);
  const construction = constructionDetails(selectedScaleId, completedIntervalCount);
  return (
    <Page title="Générateur" intro="Choisis une tonique, puis avance intervalle par intervalle.">
      <label>
        Note de départ
        <select value={selectedScaleId} onChange={(event) => {
          setSelectedScaleId(event.target.value);
          setCompletedIntervalCount(0);
        }}>
          {scales.map((scaleOption) => <option key={scaleOption.id} value={scaleOption.id}>{scaleOption.frenchName}</option>)}
        </select>
      </label>
      {scale && (
        <section className="card">
          <NoteRow notes={scale.notes.slice(0, completedIntervalCount + 1)} />
          <div aria-live="polite">
            {construction ? (
              <>
                <dl className="construction-data">
                  <div><dt>Note actuelle</dt><dd>{construction.currentNote}</dd></div>
                  <div><dt>Intervalle</dt><dd>{construction.interval}</dd></div>
                  <div><dt>Lettre naturelle attendue</dt><dd>{construction.expectedNatural}</dd></div>
                  <div><dt>Altération requise</dt><dd>{construction.requiredAccidental}</dd></div>
                </dl>
                <p>Note obtenue : <b>{construction.nextNote}</b>.</p>
                <p>{construction.explanation}</p>
              </>
            ) : <p>Commence sur la tonique {scale.notes[0]?.label}.</p>}
          </div>
          <div className="inline">
            <button onClick={() => setCompletedIntervalCount(Math.max(0, completedIntervalCount - 1))} disabled={!completedIntervalCount}>Précédent</button>
            <button className="primary" onClick={() => setCompletedIntervalCount(Math.min(7, completedIntervalCount + 1))} disabled={completedIntervalCount >= 7}>Étape suivante</button>
          </div>
        </section>
      )}
      {!scale ? <EmptyDomain /> : null}
    </Page>
  );
}
