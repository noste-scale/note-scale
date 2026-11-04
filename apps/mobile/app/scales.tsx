import { View } from "react-native";
import { useIsFocused } from "expo-router";
import {
  Body,
  Card,
  Heading,
  RouteAction,
  Row,
  Screen
} from "../src/components";
import { AudioControls } from "../src/audio";
import { scales } from "../src/domain";
import { useTheme } from "../src/theme";

function describeKeySignature(scale: (typeof scales)[number]): string {
  if (scale.keySignatureCount === 0) return "Aucune altération";

  const accidentalWord = scale.keySignatureCount > 1 ? "altérations" : "altération";

  return `${scale.keySignatureCount} ${accidentalWord} : ${scale.accidentals.join(", ")}`;
}

export default function ScalesScreen() {
  const theme = useTheme();
  const isScreenFocused = useIsFocused();

  return (
    <Screen nativeHeader subtitle="15 écritures conventionnelles, de Do majeur à Do♭ majeur.">
      <RouteAction
        href="/generator"
        label="Construire une gamme pas à pas"
        secondary
      />
      {!scales.length ? <Card>
        <Heading>Données indisponibles</Heading>
        <Body>Le catalogue musical partagé n’a pas pu être chargé.</Body>
      </Card> : null}
      {scales.map((scale) => (
        <View key={scale.id} style={{
          gap: 8,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderColor: theme.border
        }}>
          <Heading>{scale.frenchName}</Heading>
          <Body muted>{describeKeySignature(scale)}</Body>
          <Row>
            {isScreenFocused
              ? <AudioControls
                notes={scale.notes}
                compact
                scaleLabel={scale.frenchName}
              />
              : null}
            <RouteAction
              href={{
                pathname: "/scale/[id]",
                params: { id: scale.id }
              }}
              label="Voir la construction"
              accessibilityLabel={`Voir la construction de ${scale.frenchName}`}
              secondary
            />
          </Row>
        </View>
      ))}
    </Screen>
  );
}
