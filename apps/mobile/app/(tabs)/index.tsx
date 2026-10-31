import {
  Action,
  Body,
  Card,
  Formula,
  Heading,
  Notice,
  RouteAction,
  Row,
  Screen
} from "../../src/components";
import { lessons } from "../../src/domain";
import { useProgress } from "../../src/progress";
import { useThemePreference } from "../../src/theme";

export default function HomeScreen() {
  const {
    progress,
    warning,
    lastLessonId,
    lessonHydrated,
    lessonWarning
  } = useProgress();
  const { preference, cyclePreference } = useThemePreference();
  const correctAttemptCount = progress.attempts.filter((attempt) => attempt.correct).length;
  const bookmarkedLesson = lessons.find((lesson) => lesson.id === lastLessonId);
  const nextLesson = bookmarkedLesson ?? lessons[0]!;
  let lessonIntroduction = "Préparation de ta reprise…";

  if (lessonHydrated) {
    lessonIntroduction = bookmarkedLesson
      ? "Reprends la dernière leçon ouverte, à ton rythme."
      : "Commence par les sept notes, puis construis ta première gamme.";
  }

  let themeLabel = "sombre";

  if (preference === "system") themeLabel = "automatique";
  else if (preference === "light") themeLabel = "clair";

  return (
    <Screen title="NoteScale" subtitle="Apprends à construire toutes les gammes majeures avec une seule formule.">
      {warning
        ? <Notice danger>{warning}</Notice>
        : null}
      {lessonWarning
        ? <Notice danger>{lessonWarning}</Notice>
        : null}
      <Card>
        <Heading>{lessonHydrated ? nextLesson.title : "Ton parcours"}</Heading>
        <Body>{lessonIntroduction}</Body>
        {lessonHydrated ? <RouteAction
          href={{
            pathname: "/lesson/[id]",
            params: { id: nextLesson.id }
          }}
          label={bookmarkedLesson ? "Continuer la leçon" : "Commencer"}
          accessibilityLabel={`${bookmarkedLesson ? "Continuer" : "Commencer"} : ${nextLesson.title}`}
        /> : null}
      </Card>
      <RouteAction
        href="/(tabs)/learn"
        label="Choisir une leçon"
        secondary
      />
      <Row>
        <RouteAction
          href="/scales"
          label="Toutes les gammes"
          secondary
        />
        <RouteAction
          href="/(tabs)/exercises"
          label="Exercices"
          secondary
        />
      </Row>
      <Card>
        <Heading>La règle à retenir</Heading>
        <Formula />
        <Body muted>Mi–Fa et Si–Do sont collés.</Body>
      </Card>
      <Action
        label={`Thème : ${themeLabel}`}
        onPress={cyclePreference}
        hint="Bascule entre automatique, clair et sombre"
        secondary
      />
      {progress.attempts.length
        ? <Body muted>{correctAttemptCount} bonnes réponses sur {progress.attempts.length} exercices.</Body>
        : null}
      <RouteAction
        href="/privacy"
        label="Confidentialité"
        secondary
      />
    </Screen>
  );
}
