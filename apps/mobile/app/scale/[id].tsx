import { useIsFocused, useLocalSearchParams } from "expo-router";
import { AudioControls } from "../../src/audio";
import { Body, Card, Formula, Heading, RouteAction, Screen } from "../../src/components";
import { getScale } from "../../src/domain";

export default function ScaleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const focused = useIsFocused();
  const scale = getScale(id);
  if (!scale) return <Screen nativeHeader title="Gamme introuvable"><Body>Cette gamme n’est pas disponible.</Body><RouteAction href="/scales" label="Retour aux gammes" /></Screen>;
  return (
    <Screen nativeHeader title={scale.frenchName} subtitle={scale.internationalName}>
      <Card><Heading>Notes</Heading><Body>{scale.notes.join(" – ")}</Body><Body muted>Altérations à la clé : {scale.keySignatureCount ? scale.accidentals.join(", ") : "aucun dièse ni bémol"}</Body></Card>
      <Card><Heading>Construction</Heading><Formula /><Body>{scale.construction.map((step) => `${step.currentNote} → ${step.interval} → `).join("")}{scale.notes[7]}</Body></Card>
      {focused ? <AudioControls notes={scale.notes} piano scaleLabel={scale.frenchName} /> : null}
      <RouteAction href={{ pathname: "/(tabs)/exercises", params: { scaleId: scale.id } }} label="Exercice sur cette gamme" />
    </Screen>
  );
}
