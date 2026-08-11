import { useMemo, useState } from "react";
import { View } from "react-native";
import { Action, Body, Card, Chip, Formula, Heading, Row, Screen } from "../src/components";
import { scales } from "../src/domain";

export default function GeneratorScreen() {
  const [selectedId, setSelectedId] = useState(scales[0]?.id ?? "");
  const [step, setStep] = useState(0);
  const scale = useMemo(() => scales.find((item) => item.id === selectedId), [selectedId]);
  return (
    <Screen title="Générateur" subtitle="Choisis une tonique, puis construis sa gamme pas à pas.">
      <Card><Heading>1. Note de départ</Heading><View accessibilityRole="radiogroup" accessibilityLabel="Tonique"><Row>{scales.map((item) => <Chip key={item.id} label={item.notes[0] ?? item.tonic} selected={item.id === selectedId} onPress={() => { setSelectedId(item.id); setStep(0); }} />)}</Row></View></Card>
      {scale ? (
        <Card>
          <Heading>2. Construction</Heading>
          <Formula />
          <Body live>{scale.notes.slice(0, step + 1).join(" – ")}</Body>
          {step < 7 && scale.construction[step] ? (
            <View accessibilityLabel={`Détail de l’étape ${step + 1}`}>
              <Body>Note actuelle : {scale.construction[step].currentNote}</Body>
              <Body>Intervalle : {scale.construction[step].intervalLabel}</Body>
              <Body>Candidate naturelle : {scale.construction[step].naturalCandidate}</Body>
              <Body>Altération nécessaire : {scale.construction[step].necessaryAlteration}</Body>
              <Body>Résultat : {scale.construction[step].result}</Body>
              <Body muted>Explication : {scale.construction[step].explanation}</Body>
            </View>
          ) : <Body>Gamme terminée : chaque lettre apparaît une fois et la formule est respectée.</Body>}
          <Row>
            <Action label="Étape précédente" onPress={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} />
            <Action label={step === 7 ? "Recommencer" : "Étape suivante"} onPress={() => setStep((value) => value === 7 ? 0 : value + 1)} />
          </Row>
        </Card>
      ) : <Card><Body>Catalogue musical indisponible.</Body></Card>}
    </Screen>
  );
}
