import { useCallback, useEffect, useRef, useState } from "react";
import { pianoLabels } from "./app-model";
import { WebScaleAudio, type AudioDirection, type AudioSpeed } from "./audio";
import type { UiNote, UiScale } from "./domain";

export function AudioPlayer({ notes, label, compact = false }: {
  notes: UiNote[];
  label: string;
  compact?: boolean
}) {
  const [direction, setDirection] = useState<AudioDirection>("up");
  const [speed, setSpeed] = useState<AudioSpeed>("normal");
  const [isPlaybackActive, setIsPlaybackActive] = useState(false);
  const [error, setError] = useState("");
  const audioPlayer = useRef<WebScaleAudio | undefined>(undefined);

  if (!audioPlayer.current) {
    audioPlayer.current = new WebScaleAudio(
      undefined,
      () => {
        setIsPlaybackActive(false);
        setError("La lecture audio a échoué. Réessaie ou utilise les autres activités.");
      },
      () => setIsPlaybackActive(false)
    );
  }

  const stopPlayback = useCallback(() => {
    audioPlayer.current?.stop();
    setIsPlaybackActive(false);
  }, []);
  const notesKey = notes.map((note) => note.id).join("|");

  useEffect(() => () => audioPlayer.current?.stop(), []);

  useEffect(() => {
    stopPlayback();
  }, [direction, notesKey, speed, stopPlayback]);

  function playScale() {
    const playablePitches = notes.map((note) => note.pitch).filter((pitch) => pitch >= 0);
    const hasStartedPlayback = audioPlayer.current?.play(playablePitches, direction, speed) ?? false;
    setIsPlaybackActive(hasStartedPlayback);
    setError(hasStartedPlayback ? "" : "Audio indisponible sur ce navigateur.");
  }

  if (compact) {
    return (
      <>
        <button onClick={playScale} aria-label={`Écouter ${label}`}>▶ Écouter</button>
        {error && <span role="status">{error}</span>}
      </>
    );
  }

  return (
    <section className="card audio">
      <h2>Écouter</h2>
      <div className="inline">
        <label>
          Sens
          <select value={direction} onChange={(event) => setDirection(event.target.value as AudioDirection)}>
            <option value="up">Ascendant</option>
            <option value="down">Descendant</option>
          </select>
        </label>
        <label>
          Vitesse
          <select value={speed} onChange={(event) => setSpeed(event.target.value as AudioSpeed)}>
            <option value="normal">Normale</option>
            <option value="slow">Lente</option>
          </select>
        </label>
      </div>
      <div className="inline">
        <button className="primary" onClick={playScale}>▶ {isPlaybackActive ? "Recommencer" : "Écouter"}</button>
        <button onClick={() => void audioPlayer.current?.pauseResume().then((isActive) => {
          if (!isActive) setIsPlaybackActive(false);
        })} disabled={!isPlaybackActive}>Pause / reprendre</button>
        <button onClick={stopPlayback} disabled={!isPlaybackActive}>Arrêter</button>
      </div>
      {error && <p role="status">{error}</p>}
    </section>
  );
}

export function Piano({ notes }: { notes: UiNote[] }) {
  const highlightedPitches = new Set(notes.map((note) => note.pitch));
  const [error, setError] = useState("");
  const audioPlayer = useRef<WebScaleAudio | undefined>(undefined);

  if (!audioPlayer.current) {
    audioPlayer.current = new WebScaleAudio(undefined, () => setError("Le son du piano n’a pas pu être lu."));
  }

  useEffect(() => () => audioPlayer.current?.stop(), []);
  const labels = pianoLabels(notes);
  const playNote = (pitch: number) => {
    const hasStartedPlayback = audioPlayer.current?.play([pitch], "up", "normal") ?? false;
    setError(hasStartedPlayback ? "" : "Piano audio indisponible sur ce navigateur.");
  };

  return (
    <>
      <div
        className="piano"
        role="group"
        aria-label={notes.length ? `Clavier montrant ${notes.map((note) => note.label).join(", ")}` : "Clavier de piano interactif"}
      >
        {labels.map((label, pitch) => (
          <button
            type="button"
            key={label}
            onClick={() => playNote(pitch)}
            className={`${[1,3,6,8,10].includes(pitch) ? "black" : "white"} ${highlightedPitches.has(pitch) ? "active" : ""}`}
            aria-label={`Écouter ${label}`}
          >
            <small>{label}</small>
          </button>
        ))}
      </div>
      {error && <p role="status">{error}</p>}
    </>
  );
}

export function NoteRow({ notes }: { notes: UiNote[] }) {
  return (
    <div className="note-row" aria-label={notes.map((note) => note.label).join(", ")}>
      {notes.map((note, index) => <span key={`${note.id}-${index}`}>{note.label}</span>)}
    </div>
  );
}

export function describeKeySignature(scale: UiScale) {
  if (!scale.keySignatureCount) return "Sans altération";

  return `${scale.keySignatureCount} altération${scale.keySignatureCount > 1 ? "s" : ""} : ${scale.accidentals.join(", ")}`;
}
