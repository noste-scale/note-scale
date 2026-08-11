import { useLocalSearchParams } from "expo-router";
import { AudioControls } from "../../src/audio";
import { Body, Card, Formula, Heading, RouteAction, Screen } from "../../src/components";
import { lessons } from "../../src/domain";

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson) return <Screen title="Leçon introuvable"><Body>Cette leçon n’est pas disponible.</Body><RouteAction href="/(tabs)/learn" label="Retour aux leçons" /></Screen>;
  return (
    <Screen title={lesson.title} subtitle="Avance à ton rythme.">
      {lesson.id === "formula" ? <Card><Formula /></Card> : null}
      {lesson.id === "tones" ? <AudioControls notes={["Do", "Ré", "Mi", "Fa", "Sol", "La", "Si", "Do"]} piano /> : null}
      {lesson.body.map((paragraph) => <Card key={paragraph}><Body>{paragraph}</Body></Card>)}
      <Card><Heading>À retenir</Heading><Body>{lesson.id === "tones" ? "Mi–Fa et Si–Do sont collés." : "Chaque gamme utilise les sept noms de note dans l’ordre."}</Body></Card>
      <RouteAction href="/(tabs)/learn" label="Continuer les leçons" />
    </Screen>
  );
}
