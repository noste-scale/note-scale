import { Body, Card, Heading, RouteAction, Screen } from "../src/components";
import { AudioControls } from "../src/audio";
import { scales } from "../src/domain";

export default function ScalesScreen() {
  return (
    <Screen title="Toutes les gammes" subtitle="15 écritures conventionnelles, de Do majeur à Do♭ majeur.">
      {!scales.length ? <Card><Heading>Données indisponibles</Heading><Body>Le catalogue musical partagé n’a pas pu être chargé.</Body></Card> : null}
      {scales.map((scale) => (
        <Card key={scale.id}>
          <Heading>{scale.frenchName}</Heading>
          <Body muted>{scale.internationalName}</Body>
          <Body>{scale.notes.join(" – ")}</Body>
          <Body muted>{scale.keySignatureCount === 0 ? "Aucune altération" : `${scale.keySignatureCount} altération${scale.keySignatureCount > 1 ? "s" : ""} : ${scale.accidentals.join(", ")}`}</Body>
          <AudioControls notes={scale.notes} compact scaleLabel={scale.frenchName} />
          <RouteAction href={{ pathname: "/scale/[id]", params: { id: scale.id } }} label="Voir la construction" />
        </Card>
      ))}
      <RouteAction href="/generator" label="Ouvrir le générateur" secondary />
    </Screen>
  );
}
