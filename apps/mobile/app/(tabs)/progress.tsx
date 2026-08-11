import { Body, Card, Heading, Notice, Screen } from "../../src/components";
import { scales } from "../../src/domain";
import { summarizeProgress } from "@notescale/music";
import { useProgress } from "../../src/progress";

export default function ProgressScreen() {
  const { progress, hydrated, warning } = useProgress();
  const summary = summarizeProgress(progress);
  const mastered = scales.filter((scale) => summary.mastered.some((id) => id === scale.id));
  const toReview = scales.filter((scale) => summary.toReview.some((id) => id === scale.id));
  return (
    <Screen title="Ma progression" subtitle="Données enregistrées uniquement sur cet appareil.">
      {warning ? <Notice danger>{warning}</Notice> : null}
      {!hydrated ? <Card><Heading>Chargement…</Heading><Body muted>Lecture de ta progression locale.</Body></Card> : (
        <>
          <Card><Heading>{summary.total}</Heading><Body muted>exercices réalisés</Body></Card>
          <Card><Heading>{summary.accuracy} %</Heading><Body muted>{summary.correct} bonnes réponses</Body></Card>
          <Card><Heading>{summary.streak} jour{summary.streak > 1 ? "s" : ""}</Heading><Body muted>série d’entraînement</Body></Card>
          <Card><Heading>Gammes maîtrisées</Heading><Body>{mastered.length ? mastered.map((scale) => scale.frenchName).join(", ") : "Aucune pour le moment. Il faut cinq réussites sur les six essais récents, avec un dernier essai réussi."}</Body></Card>
          <Card><Heading>À revoir</Heading><Body>{toReview.length ? toReview.map((scale) => scale.frenchName).join("\n") : "Commence un exercice pour obtenir une recommandation."}</Body></Card>
        </>
      )}
    </Screen>
  );
}
