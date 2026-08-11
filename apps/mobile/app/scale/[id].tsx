import { useLocalSearchParams } from "expo-router";
import { AudioControls } from "../../src/audio";
import { Body, Card, Formula, Heading, RouteAction, Screen } from "../../src/components";
import { getScale } from "../../src/domain";

export default function ScaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const scale = getScale(id);
  if (!scale) return <Screen title="Gamme introuvable"><Body>Cette gamme n’est pas disponible.</Body><RouteAction href="/scales" label="Retour aux gammes" /></Screen>;
  return (
    <Screen title={scale.frenchName} subtitle={scale.internationalName}>
      <Card><Heading>Notes</Heading><Body>{scale.notes.join(" – ")}</Body></Card>
      <Card><Heading>Armure</Heading><Body>{scale.keySignatureCount ? scale.accidentals.join(", ") : "Aucun dièse ni bémol"}</Body></Card>
      <Card><Heading>Construction</Heading><Formula /><Body>{scale.construction.map((step) => `${step.currentNote} → ${step.interval} → `).join("")}{scale.notes[7]}</Body></Card>
      <AudioControls notes={scale.notes} piano scaleLabel={scale.frenchName} />
      <RouteAction href={{ pathname: "/(tabs)/exercises", params: { scaleId: scale.id } }} label="Exercice sur cette gamme" />
    </Screen>
  );
}
