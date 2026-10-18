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
      {!hydrated ? <Card><Heading>Chargement…</Heading><Body muted>Lecture de ta progression locale.</Body></Card> : summary.total === 0 ? (
        <Card>
          <Heading>Ta première gamme t’attend</Heading>
          <Body>Essaie un exercice, même sans être sûr de ta réponse. Tu recevras une explication pour comprendre.</Body>
          <RouteAction href="/exercises" label="Commencer un exercice" />
          <Body muted>Tes réponses et les gammes à revoir apparaîtront ici, au fil de tes essais.</Body>
        </Card>
      ) : (
        <>
          <Card>
            <Heading>Tes entraînements</Heading>
            <Body>{summary.total} {summary.total === 1 ? "exercice réalisé" : "exercices réalisés"} · {summary.correct} {summary.correct === 1 ? "bonne réponse" : "bonnes réponses"} ({summary.accuracy} %)</Body>
            <Body muted>{summary.streak} {summary.streak === 1 ? "jour" : "jours"} de suite</Body>
          </Card>
          <Card><Heading>Gammes maîtrisées</Heading><Body>{mastered.length ? mastered.map((scale) => scale.frenchName).join(", ") : "Aucune pour le moment. Il faut cinq réussites sur les six essais récents, avec un dernier essai réussi."}</Body></Card>
          <Card><Heading>À revoir</Heading><Body>{toReview.length ? toReview.map((scale) => scale.frenchName).join("\n") : "Aucune gamme à revoir pour le moment."}</Body></Card>
          <RouteAction href="/exercises" label="Continuer à s’entraîner" />
        </>
      )}
    </Screen>
  );
}
