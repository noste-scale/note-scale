import { Body, Card, Heading, Notice, RouteAction, Screen } from "../../src/components";
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
          {summary.total === 0 ? <Card><Heading>Ta première gamme t’attend</Heading><Body>Commence un exercice pour suivre tes réponses et les gammes à revoir.</Body><RouteAction href="/exercises" label="Commencer un exercice" /></Card> : null}
          <Card><Heading>{summary.total}</Heading><Body muted>{summary.total === 1 ? "exercice réalisé" : "exercices réalisés"}</Body></Card>
          <Card><Heading>{summary.accuracy} %</Heading><Body muted>{summary.correct} {summary.correct === 1 ? "bonne réponse" : "bonnes réponses"}</Body></Card>
          <Card><Heading>{summary.streak} {summary.streak === 1 ? "jour" : "jours"}</Heading><Body muted>série d’entraînement</Body></Card>
          <Card><Heading>Gammes maîtrisées</Heading><Body>{mastered.length ? mastered.map((scale) => scale.frenchName).join(", ") : "Aucune pour le moment. Il faut cinq réussites sur les six essais récents, avec un dernier essai réussi."}</Body></Card>
          <Card><Heading>À revoir</Heading><Body>{toReview.length ? toReview.map((scale) => scale.frenchName).join("\n") : summary.total === 0 ? "Commence un exercice pour obtenir une recommandation." : "Aucune gamme à revoir pour le moment."}</Body></Card>
        </>
      )}
    </Screen>
  );
}
