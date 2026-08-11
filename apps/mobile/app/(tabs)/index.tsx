import { Action, Body, Card, Formula, Heading, Notice, RouteAction, Screen } from "../../src/components";
import { useProgress } from "../../src/progress";
import { useThemePreference } from "../../src/theme";

export default function HomeScreen() {
  const { progress, warning } = useProgress();
  const { preference, cyclePreference } = useThemePreference();
  const correct = progress.attempts.filter((attempt) => attempt.correct).length;
  return (
    <Screen title="NoteScale" subtitle="Apprends à construire toutes les gammes majeures avec une seule formule.">
      {warning ? <Notice danger>{warning}</Notice> : null}
      <Card>
        <Heading>La règle à retenir</Heading>
        <Formula />
        <Body muted>Mi–Fa et Si–Do sont collés.</Body>
      </Card>
      <RouteAction href="/(tabs)/learn" label="Apprendre" />
      <RouteAction href="/scales" label="Toutes les gammes" />
      <RouteAction href="/(tabs)/exercises" label="Exercices" />
      <RouteAction href="/(tabs)/progress" label="Ma progression" secondary />
      <Action label={`Thème : ${preference === "system" ? "automatique" : preference === "light" ? "clair" : "sombre"}`} onPress={cyclePreference} hint="Bascule entre automatique, clair et sombre" />
      {progress.attempts.length ? <Body muted>{correct} bonnes réponses sur {progress.attempts.length} exercices.</Body> : null}
    </Screen>
  );
}
