import { View } from "react-native";
import { Body, Notice, RouteAction, Screen } from "../../src/components";
import { lessons } from "../../src/domain";
import { useProgress } from "../../src/progress";

export default function LearnScreen() {
  const { lastLessonId, lessonWarning } = useProgress();
  return (
    <Screen title="Apprendre" subtitle="Cinq petites leçons. Suis l’ordre ou choisis ton point de départ.">
      {lessonWarning ? <Notice danger>{lessonWarning}</Notice> : null}
      {lessons.map((lesson) => (
        <View key={lesson.id} style={{ gap: 6 }}>
          <RouteAction href={{ pathname: "/lesson/[id]", params: { id: lesson.id } }} label={lesson.title} accessibilityLabel={`Ouvrir la leçon : ${lesson.title}`} secondary />
          <Body muted>{lesson.body[0] ?? "Leçon disponible."}</Body>
          {lastLessonId === lesson.id ? <Body muted>Dernière leçon ouverte</Body> : null}
        </View>
      ))}
      <RouteAction href="/generator" label="Construire une gamme" />
      <RouteAction href="/scales" label="Voir toutes les gammes" secondary />
    </Screen>
  );
}
