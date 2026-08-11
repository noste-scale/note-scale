import { Body, Card, Formula, Heading, RouteAction, Screen } from "../../src/components";
import { lessons } from "../../src/domain";

export default function LearnScreen() {
  return (
    <Screen title="Apprendre" subtitle="Cinq petites leçons pour comprendre avant de mémoriser.">
      <Card><Heading>La formule</Heading><Formula /></Card>
      {lessons.map((lesson) => (
        <Card key={lesson.id}>
          <Heading>{lesson.title}</Heading>
          <Body muted>{lesson.body[0] ?? "Leçon disponible."}</Body>
          <RouteAction href={{ pathname: "/lesson/[id]", params: { id: lesson.id } }} label="Ouvrir la leçon" secondary />
        </Card>
      ))}
      <RouteAction href="/scales" label="Voir toutes les gammes" />
      <RouteAction href="/generator" label="Construire une gamme" secondary />
    </Screen>
  );
}
