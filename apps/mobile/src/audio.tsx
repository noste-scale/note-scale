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
import { Action, Body, Card, Heading, Notice, Piano, Row } from "./components";

interface ActivePlayback {
  owner: symbol;
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

function pitch(note: string): number | undefined {
  const id = normalizeNoteId(note);
  return id ? pitchClassOf(id) : undefined;
}

function sequenceFor(notes: readonly string[], direction: "up" | "down"): SequencedPitch[] {
  return orderedPitchSequence(notes.flatMap((note) => {
    const value = pitch(note);
    return value === undefined ? [] : [value];
  }), direction);
}

export function AudioControls({ notes, compact = false, piano = false, scaleLabel }: { notes: string[]; compact?: boolean; piano?: boolean; scaleLabel?: string }) {
  const player = useAudioPlayer(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const deadline = useRef(0);
  const remaining = useRef(0);
  const currentIndex = useRef(0);
  const sequence = useRef<SequencedPitch[]>([]);
  const generation = useRef(0);
  const owner = useRef(Symbol("notescale-audio"));
  const phaseRef = useRef<PlaybackPhase>("stopped");
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [slow, setSlow] = useState(false);
  const [phase, setPhase] = useState<PlaybackPhase>("stopped");
  const [soundingPitch, setSoundingPitch] = useState<number>();
  const [message, setMessage] = useState<{ text: string; danger: boolean }>();
  const configurationKey = playbackConfigurationKey(notes, direction, slow);
  const previousConfiguration = useRef(configurationKey);

  const updatePhase = (event: PlaybackEvent) => {
    const next = transitionPlayback(phaseRef.current, event);
    phaseRef.current = next;
    setPhase(next);
  };

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
  };

  const releaseOwnership = () => {
    if (activePlayback?.owner === owner.current) activePlayback = undefined;
  };

  const resetPlayer = () => {
    generation.current += 1;
    clearTimer();
    remaining.current = 0;
    currentIndex.current = 0;
    sequence.current = [];
    player.pause();
    void player.seekTo(0).catch(() => undefined);
    setSoundingPitch(undefined);
    releaseOwnership();
  };

  const stop = (event: "stop" | "preempt" = "stop") => {
    resetPlayer();
    updatePhase(event);
    setMessage({
      text: event === "preempt" ? "Lecture interrompue par une autre lecture." : "Lecture arrêtée.",
      danger: false,
    });
  };

  const complete = (token: number) => {
    if (token !== generation.current) return;
    clearTimer();
    remaining.current = 0;
    setSoundingPitch(undefined);
    updatePhase("complete");
    setMessage({ text: "Lecture terminée.", danger: false });
    releaseOwnership();
  };

  const playAt = (index: number, token: number) => {
    if (token !== generation.current) return;
    const entry = sequence.current[index];
    const source = entry ? samples[entry.sampleKey] : undefined;
    if (!entry || source === undefined) {
      resetPlayer();
      updatePhase("stop");
      setMessage({ text: "Cette note ne peut pas être lue. Réessaie avec une autre gamme.", danger: true });
      return;
    }
    try {
      currentIndex.current = index;
      player.replace(source);
      player.setPlaybackRate(slow ? 0.75 : 1);
      player.play();
      setSoundingPitch(entry.pitchClass);
      const delay = slow ? 1100 : 650;
      remaining.current = delay;
      deadline.current = Date.now() + delay;
      timer.current = setTimeout(() => {
        if (index + 1 < sequence.current.length) playAt(index + 1, token);
        else complete(token);
      }, delay);
    } catch {
      resetPlayer();
      updatePhase("stop");
      setMessage({ text: "La lecture a échoué. Les autres contrôles restent disponibles.", danger: true });
    }
  };

  const startSequence = (nextSequence: SequencedPitch[], restart: boolean) => {
    if (activePlayback?.owner !== owner.current) activePlayback?.preempt();
    resetPlayer();
    if (nextSequence.length === 0) {
      updatePhase("stop");
      setMessage({ text: "Aucune note lisible n’est disponible.", danger: true });
      return;
    }
    sequence.current = nextSequence;
    activePlayback = { owner: owner.current, preempt: () => stop("preempt") };
    setMessage(undefined);
    updatePhase(restart ? "restart" : "start");
    const token = generation.current;
    playAt(0, token);
  };

  const start = () => startSequence(sequenceFor(notes, direction), phaseRef.current !== "stopped");

  const playOne = (note: string) => {
    const value = pitch(note);
    const sampleKey = value === undefined ? undefined : sampleKeyForPitch(value, 4);
    if (value === undefined || !sampleKey) {
      setMessage({ text: "Cette note ne peut pas être lue.", danger: true });
      return;
    }
    startSequence([{ pitchClass: value, octave: 4, sampleKey }], phaseRef.current !== "stopped");
  };

  const pause = () => {
    if (phaseRef.current !== "playing") return;
    remaining.current = Math.max(0, deadline.current - Date.now());
    clearTimer();
    player.pause();
    updatePhase("pause");
    setMessage({ text: "Lecture en pause.", danger: false });
  };

  const resume = () => {
    if (phaseRef.current !== "paused") return;
    try {
      player.play();
      updatePhase("resume");
      setMessage(undefined);
      const token = generation.current;
      const delay = remaining.current;
      deadline.current = Date.now() + delay;
      timer.current = setTimeout(() => {
        const index = currentIndex.current;
        if (index + 1 < sequence.current.length) playAt(index + 1, token);
        else complete(token);
      }, delay);
    } catch {
      stop();
      setMessage({ text: "La reprise de la lecture a échoué.", danger: true });
    }
  };

  const configure = (nextDirection: "up" | "down", nextSlow: boolean) => {
    if (nextDirection === direction && nextSlow === slow) return;
    if (phaseRef.current === "playing" || phaseRef.current === "paused") stop();
    setDirection(nextDirection);
    setSlow(nextSlow);
  };

  useEffect(() => {
    if (previousConfiguration.current === configurationKey) return;
    previousConfiguration.current = configurationKey;
    if (phaseRef.current !== "stopped") {
      resetPlayer();
      updatePhase("stop");
      setMessage({ text: "Lecture réinitialisée après le changement de gamme, de sens ou de vitesse.", danger: false });
    }
  }, [configurationKey]);

  useEffect(() => {
    audioModeSetup ??= setAudioModeAsync({ playsInSilentMode: true });
    void audioModeSetup.catch(() => setMessage({ text: "L’audio local est indisponible sur cet appareil.", danger: true }));
    return () => {
      generation.current += 1;
      clearTimer();
      player.pause();
      if (activePlayback?.owner === owner.current) activePlayback = undefined;
    };
  }, [player]);

  const active = phase === "playing" || phase === "paused";
  const mainAction = active || phase === "completed" || phase === "preempted" ? "Recommencer" : "Lire";
  const pauseAction = phase === "paused" ? "Reprendre" : "Pause";
  const controls = (
    <Row>
      <Action label={mainAction} accessibilityLabel={scalePlaybackLabel(mainAction, scaleLabel)} onPress={start} />
      <Action label={pauseAction} accessibilityLabel={scalePlaybackLabel(pauseAction, scaleLabel)} onPress={phase === "paused" ? resume : pause} disabled={!active} />
      <Action label="Arrêter" accessibilityLabel={scalePlaybackLabel("Arrêter", scaleLabel)} onPress={() => stop()} disabled={!active} />
    </Row>
  );
  const statusText = playbackStatus(phase, message?.text);
  const status = message ? <Notice danger={message.danger}>{statusText}</Notice> : <Body live>{statusText}</Body>;

  if (compact) {
    return <View>{controls}{message || active ? status : null}</View>;
  }

  return (
    <Card>
      <Heading>Écouter la gamme</Heading>
      <Body muted>Lecture locale, sans connexion.</Body>
      {piano ? <Piano activeNotes={notes} soundingPitch={soundingPitch} onPlayNote={playOne} /> : null}
      <Body>Écouter une note</Body>
      <Row>{notes.slice(0, 7).map((note, index) => <Action key={`${note}-${index}`} label={note} onPress={() => playOne(note)} hint={`Écouter la note ${note}`} />)}</Row>
      <View accessibilityRole="radiogroup" accessibilityLabel="Sens de lecture"><Row><Action role="radio" label="Ascendante" onPress={() => configure("up", slow)} selected={direction === "up"} /><Action role="radio" label="Descendante" onPress={() => configure("down", slow)} selected={direction === "down"} /></Row></View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Vitesse de lecture"><Row><Action role="radio" label="Normale" onPress={() => configure(direction, false)} selected={!slow} /><Action role="radio" label="Lente" onPress={() => configure(direction, true)} selected={slow} /></Row></View>
      {controls}
      {status}
    </Card>
  );
}
