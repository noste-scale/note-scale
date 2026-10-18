import { View } from "react-native";
import { useIsFocused } from "expo-router";
import { Body, Card, Heading, RouteAction, Row, Screen } from "../src/components";
import { AudioControls } from "../src/audio";
import { scales } from "../src/domain";
import { useTheme } from "../src/theme";

export default function ScalesScreen() {
  const theme = useTheme();
  const focused = useIsFocused();
  return (
    <Screen nativeHeader subtitle="15 écritures conventionnelles, de Do majeur à Do♭ majeur.">
      <RouteAction href="/generator" label="Construire une gamme pas à pas" secondary />
      {!scales.length ? <Card><Heading>Données indisponibles</Heading><Body>Le catalogue musical partagé n’a pas pu être chargé.</Body></Card> : null}
      {scales.map((scale) => (
        <View key={scale.id} style={{ gap: 8, paddingBottom: 16, borderBottomWidth: 1, borderColor: theme.border }}>
          <Heading>{scale.frenchName}</Heading>
          <Body muted>{scale.keySignatureCount === 0 ? "Aucune altération" : `${scale.keySignatureCount} altération${scale.keySignatureCount > 1 ? "s" : ""} : ${scale.accidentals.join(", ")}`}</Body>
          <Row>
          {focused ? <AudioControls notes={scale.notes} compact scaleLabel={scale.frenchName} /> : null}
          <RouteAction href={{ pathname: "/scale/[id]", params: { id: scale.id } }} label="Voir la construction" accessibilityLabel={`Voir la construction de ${scale.frenchName}`} secondary />
          </Row>
        </View>
      ))}
    </Screen>
  );
}
