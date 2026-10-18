import { useCallback } from "react";
import { useFocusEffect, useIsFocused, useLocalSearchParams } from "expo-router";
import { LESSONS } from "@notescale/music";
import { AudioControls } from "../../src/audio";
import { Body, Card, Formula, Heading, Notice, RouteAction, Screen } from "../../src/components";
import { useProgress } from "../../src/progress";

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const focused = useIsFocused();
  const { rememberLesson, lessonWarning } = useProgress();
  const lessonIndex = LESSONS.findIndex((item) => item.id === id);
  const lesson = LESSONS[lessonIndex];
  const nextLesson = LESSONS[lessonIndex + 1];
  useFocusEffect(useCallback(() => { if (lesson) rememberLesson(lesson.id); }, [lesson, rememberLesson]));
  if (!lesson) return <Screen nativeHeader title="Leçon introuvable"><Body>Cette leçon n’est pas disponible.</Body><RouteAction href="/(tabs)/learn" label="Retour aux leçons" /></Screen>;
  return (
    <Screen key={lesson.id} nativeHeader title={lesson.title} subtitle={`Leçon ${lessonIndex + 1} sur ${LESSONS.length} · ${lesson.summary}`}>
      {lessonWarning ? <Notice danger>{lessonWarning}</Notice> : null}
      {lesson.id === "formula" ? <Card><Formula /></Card> : null}
      {lesson.paragraphs.map((paragraph) => <Body key={paragraph}>{paragraph}</Body>)}
      {lesson.notes ? <Card><Heading>Les mêmes notes, deux notations</Heading><Body>{lesson.notes.join("\n")}</Body></Card> : null}
      {lesson.id === "tones" && focused ? <AudioControls notes={["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si", "Do"]} piano /> : null}
      <Card><Heading>À retenir</Heading><Body>{lesson.id === "tones" ? "Mi–Fa et Si–Do sont collés." : "Chaque gamme utilise les sept noms de note dans l’ordre."}</Body></Card>
      {nextLesson ? <RouteAction href={{ pathname: "/lesson/[id]", params: { id: nextLesson.id } }} label={`Suivant : ${nextLesson.title.replace(/^\d+\. /, "")}`} /> : <RouteAction href="/generator" label="À toi de construire une gamme" />}
      <RouteAction href="/(tabs)/learn" label="Toutes les leçons" secondary />
    </Screen>
  );
}
