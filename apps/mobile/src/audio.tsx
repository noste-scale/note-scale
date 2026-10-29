import { normalizeNoteId, pitchClassOf } from "@notescale/music";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  orderedPitchSequence,
  playbackConfigurationKey,
  playbackStatus,
  sampleKeyForPitch,
  scalePlaybackLabel,
  transitionPlayback,
  type PlaybackEvent,
  type PlaybackPhase,
  type SampleKey,
  type SequencedPitch,
} from "./audio-model";
import { Action, Body, Card, Heading, Notice, Row } from "./components";
import { Piano } from "./piano";

interface ActivePlayback {
  playbackOwner: symbol;
  preempt: () => void;
}

let activePlayback: ActivePlayback | undefined;
let audioModeSetup: Promise<void> | undefined;

const samples: Record<SampleKey, number> = {
  C4: require("../assets/audio/C4.wav"),
  Cs4: require("../assets/audio/Cs4.wav"),
  D4: require("../assets/audio/D4.wav"),
  Ds4: require("../assets/audio/Ds4.wav"),
  E4: require("../assets/audio/E4.wav"),
  F4: require("../assets/audio/F4.wav"),
  Fs4: require("../assets/audio/Fs4.wav"),
  G4: require("../assets/audio/G4.wav"),
  Gs4: require("../assets/audio/Gs4.wav"),
  A4: require("../assets/audio/A4.wav"),
  As4: require("../assets/audio/As4.wav"),
  B4: require("../assets/audio/B4.wav"),
  C5: require("../assets/audio/C5.wav"),
  Cs5: require("../assets/audio/Cs5.wav"),
  D5: require("../assets/audio/D5.wav"),
  Ds5: require("../assets/audio/Ds5.wav"),
  E5: require("../assets/audio/E5.wav"),
  F5: require("../assets/audio/F5.wav"),
  Fs5: require("../assets/audio/Fs5.wav"),
  G5: require("../assets/audio/G5.wav"),
  Gs5: require("../assets/audio/Gs5.wav"),
  A5: require("../assets/audio/A5.wav"),
  As5: require("../assets/audio/As5.wav"),
  B5: require("../assets/audio/B5.wav"),
};

function getNotePitchClass(note: string): number | undefined {
  const noteId = normalizeNoteId(note);
  return noteId ? pitchClassOf(noteId) : undefined;
}

function createPitchSequence(notes: readonly string[], direction: "up" | "down"): SequencedPitch[] {
  return orderedPitchSequence(notes.flatMap((note) => {
    const pitchClass = getNotePitchClass(note);
    return pitchClass === undefined ? [] : [pitchClass];
  }), direction);
}

export function AudioControls({
  notes,
  compact = false,
  piano = false,
  scaleLabel,
}: {
  notes: string[];
  compact?: boolean;
  piano?: boolean;
  scaleLabel?: string;
}) {
  const player = useAudioPlayer(null);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const noteDeadlineMs = useRef(0);
  const remainingNoteDurationMs = useRef(0);
  const currentNoteIndex = useRef(0);
  const pitchSequence = useRef<SequencedPitch[]>([]);
  const playbackGeneration = useRef(0);
  const playbackOwner = useRef(Symbol("notescale-audio"));
  const playbackPhaseRef = useRef<PlaybackPhase>("stopped");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [slow, setSlow] = useState(false);
  const [showPiano, setShowPiano] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackPhase, setPlaybackPhase] = useState<PlaybackPhase>("stopped");
  const [soundingPitch, setSoundingPitch] = useState<number>();
  const [playbackMessage, setPlaybackMessage] = useState<{ text: string; danger: boolean }>();
  const configurationKey = playbackConfigurationKey(notes, direction, slow);
  const previousConfigurationKey = useRef(configurationKey);

  const updatePlaybackPhase = (event: PlaybackEvent) => {
    const nextPhase = transitionPlayback(playbackPhaseRef.current, event);
    playbackPhaseRef.current = nextPhase;
    setPlaybackPhase(nextPhase);
  };

  const clearPlaybackTimer = () => {
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    playbackTimer.current = undefined;
  };

  const releaseOwnership = () => {
    if (activePlayback?.playbackOwner === playbackOwner.current) activePlayback = undefined;
  };

  const resetPlayer = () => {
    playbackGeneration.current += 1;
    clearPlaybackTimer();
    remainingNoteDurationMs.current = 0;
    currentNoteIndex.current = 0;
    pitchSequence.current = [];
    player.pause();
    void player.seekTo(0).catch(() => undefined);
    setSoundingPitch(undefined);
    releaseOwnership();
  };

  const stopPlayback = (event: "stop" | "preempt" = "stop") => {
    resetPlayer();
    updatePlaybackPhase(event);
    setPlaybackMessage({
      text: event === "preempt" ? "Lecture interrompue par une autre lecture." : "Lecture arrêtée.",
      danger: false,
    });
  };

  const completePlayback = (playbackToken: number) => {
    if (playbackToken !== playbackGeneration.current) return;
    clearPlaybackTimer();
    remainingNoteDurationMs.current = 0;
    setSoundingPitch(undefined);
    updatePlaybackPhase("complete");
    setPlaybackMessage({ text: "Lecture terminée.", danger: false });
    releaseOwnership();
  };

  const playNoteAtIndex = (noteIndex: number, playbackToken: number) => {
    if (playbackToken !== playbackGeneration.current) return;
    const sequencedPitch = pitchSequence.current[noteIndex];
    const sampleSource = sequencedPitch ? samples[sequencedPitch.sampleKey] : undefined;
    if (!sequencedPitch || sampleSource === undefined) {
      resetPlayer();
      updatePlaybackPhase("stop");
      setPlaybackMessage({ text: "Cette note ne peut pas être lue. Réessaie avec une autre gamme.", danger: true });
      return;
    }
    try {
      currentNoteIndex.current = noteIndex;
      player.replace(sampleSource);
      player.setPlaybackRate(slow ? 0.75 : 1);
      player.play();
      setSoundingPitch(sequencedPitch.pitchClass);
      const noteDurationMs = slow ? 1100 : 650;
      remainingNoteDurationMs.current = noteDurationMs;
      noteDeadlineMs.current = Date.now() + noteDurationMs;
      playbackTimer.current = setTimeout(() => {
        if (noteIndex + 1 < pitchSequence.current.length) playNoteAtIndex(noteIndex + 1, playbackToken);
        else completePlayback(playbackToken);
      }, noteDurationMs);
    } catch {
      resetPlayer();
      updatePlaybackPhase("stop");
      setPlaybackMessage({ text: "La lecture a échoué. Les autres contrôles restent disponibles.", danger: true });
    }
  };

  const startSequence = (nextSequence: SequencedPitch[], restart: boolean) => {
    if (activePlayback?.playbackOwner !== playbackOwner.current) activePlayback?.preempt();
    resetPlayer();
    if (nextSequence.length === 0) {
      updatePlaybackPhase("stop");
      setPlaybackMessage({ text: "Aucune note lisible n’est disponible.", danger: true });
      return;
    }
    pitchSequence.current = nextSequence;
    activePlayback = { playbackOwner: playbackOwner.current, preempt: () => stopPlayback("preempt") };
    setPlaybackMessage(undefined);
    updatePlaybackPhase(restart ? "restart" : "start");
    const playbackToken = playbackGeneration.current;
    playNoteAtIndex(0, playbackToken);
  };

  const startPlayback = () => startSequence(createPitchSequence(notes, direction), playbackPhaseRef.current !== "stopped");

  const playSingleNote = (note: string) => {
    const pitchClass = getNotePitchClass(note);
    const sampleKey = pitchClass === undefined ? undefined : sampleKeyForPitch(pitchClass, 4);
    if (pitchClass === undefined || !sampleKey) {
      setPlaybackMessage({ text: "Cette note ne peut pas être lue.", danger: true });
      return;
    }
    startSequence([{ pitchClass, octave: 4, sampleKey }], playbackPhaseRef.current !== "stopped");
  };

  const pausePlayback = () => {
    if (playbackPhaseRef.current !== "playing") return;
    remainingNoteDurationMs.current = Math.max(0, noteDeadlineMs.current - Date.now());
    clearPlaybackTimer();
    player.pause();
    updatePlaybackPhase("pause");
    setPlaybackMessage({ text: "Lecture en pause.", danger: false });
  };

  const resumePlayback = () => {
    if (playbackPhaseRef.current !== "paused") return;
    try {
      player.play();
      updatePlaybackPhase("resume");
      setPlaybackMessage(undefined);
      const playbackToken = playbackGeneration.current;
      const noteDurationMs = remainingNoteDurationMs.current;
      noteDeadlineMs.current = Date.now() + noteDurationMs;
      playbackTimer.current = setTimeout(() => {
        const noteIndex = currentNoteIndex.current;
        if (noteIndex + 1 < pitchSequence.current.length) playNoteAtIndex(noteIndex + 1, playbackToken);
        else completePlayback(playbackToken);
      }, noteDurationMs);
    } catch {
      stopPlayback();
      setPlaybackMessage({ text: "La reprise de la lecture a échoué.", danger: true });
    }
  };

  const configurePlayback = (nextDirection: "up" | "down", nextSlow: boolean) => {
    if (nextDirection === direction && nextSlow === slow) return;
    if (playbackPhaseRef.current === "playing" || playbackPhaseRef.current === "paused") stopPlayback();
    setDirection(nextDirection);
    setSlow(nextSlow);
  };

  useEffect(() => {
    if (previousConfigurationKey.current === configurationKey) return;
    previousConfigurationKey.current = configurationKey;
    if (playbackPhaseRef.current !== "stopped") {
      resetPlayer();
      updatePlaybackPhase("stop");
      setPlaybackMessage({
        text: "Lecture réinitialisée après le changement de gamme, de sens ou de vitesse.",
        danger: false
      });
    }
  }, [configurationKey]);

  useEffect(() => {
    audioModeSetup ??= setAudioModeAsync({ playsInSilentMode: true });
    void audioModeSetup.catch(() => setPlaybackMessage({ text: "L’audio local est indisponible sur cet appareil.", danger: true }));
    return () => {
      playbackGeneration.current += 1;
      clearPlaybackTimer();
      // ponytail: useAudioPlayer already releases native audio; this cleanup owns only our JS work.
      if (activePlayback?.playbackOwner === playbackOwner.current) activePlayback = undefined;
    };
  }, [player]);

  const isPlaybackActive = playbackPhase === "playing" || playbackPhase === "paused";
  const mainAction = isPlaybackActive || playbackPhase === "completed" || playbackPhase === "preempted" ? "Recommencer" : "Lire";
  const pauseAction = playbackPhase === "paused" ? "Reprendre" : "Pause";
  let handleMainAction = startPlayback;
  if (playbackPhase === "paused") handleMainAction = resumePlayback;
  else if (playbackPhase === "playing") handleMainAction = pausePlayback;
  const controls = (
    <Row>
      <Action
        label={isPlaybackActive ? pauseAction : mainAction}
        accessibilityLabel={scalePlaybackLabel(isPlaybackActive ? pauseAction : mainAction, scaleLabel)}
        onPress={handleMainAction}
        secondary={compact}
      />
      {isPlaybackActive ? <Action
        label="Arrêter"
        accessibilityLabel={scalePlaybackLabel("Arrêter", scaleLabel)}
        onPress={() => stopPlayback()}
        secondary
      /> : null}
      {isPlaybackActive ? <Action
        label="Recommencer"
        accessibilityLabel={scalePlaybackLabel("Recommencer", scaleLabel)}
        onPress={startPlayback}
        secondary
      /> : null}
    </Row>
  );
  const statusText = playbackStatus(playbackPhase, playbackMessage?.text);
  const status = playbackMessage ? <Notice danger={playbackMessage.danger}>{statusText}</Notice> : <Body live>{statusText}</Body>;

  if (compact) {
    return (
      <View>
        {controls}
        {playbackMessage || isPlaybackActive ? status : null}
      </View>
    );
  }

  return (
    <Card>
      <Heading>Écouter la gamme</Heading>
      <Body muted>Lecture locale, sans connexion.</Body>
      {controls}
      {status}
      {piano && showPiano ? <Piano key={notes[0]} activeNotes={notes} soundingPitch={soundingPitch} onPlayNote={playSingleNote} /> : <>
        <Body>Écouter une note, depuis {notes[0]}</Body>
        <Row>
          {notes.slice(0, 7).map((note, index) => <Action
            key={`${note}-${index}`}
            label={note}
            onPress={() => playSingleNote(note)}
            hint={`Écouter la note ${note}`}
            selected={getNotePitchClass(note) === soundingPitch}
            secondary
          />)}
        </Row>
      </>}
      {piano ? <Action
        label={showPiano ? "Revenir aux notes de la gamme" : "Afficher le piano"}
        expanded={showPiano}
        onPress={() => setShowPiano(!showPiano)}
        secondary
      /> : null}
      <Action
        label={showSettings ? "Masquer les réglages d’écoute" : "Réglages d’écoute"}
        expanded={showSettings}
        onPress={() => setShowSettings(!showSettings)}
        secondary
      />
      {showSettings ? <>
        <Body>Sens de lecture</Body>
        <View accessibilityRole="radiogroup" accessibilityLabel="Sens de lecture">
          <Row>
            <Action
              role="radio"
              label="Ascendante"
              onPress={() => configurePlayback("up", slow)}
              selected={direction === "up"}
              secondary
            />
            <Action
              role="radio"
              label="Descendante"
              onPress={() => configurePlayback("down", slow)}
              selected={direction === "down"}
              secondary
            />
          </Row>
        </View>
        <Body>Vitesse de lecture</Body>
        <View accessibilityRole="radiogroup" accessibilityLabel="Vitesse de lecture">
          <Row>
            <Action role="radio" label="Normale" onPress={() => configurePlayback(direction, false)} selected={!slow} secondary />
            <Action role="radio" label="Lente" onPress={() => configurePlayback(direction, true)} selected={slow} secondary />
          </Row>
        </View>
      </> : null}
    </Card>
  );
}
