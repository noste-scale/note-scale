import { useState } from "react";
import { View } from "react-native";
import { Action, Body, Card, Chip, Formula, Heading, Row, Screen } from "../src/components";
import { scales } from "../src/domain";

export default function GeneratorScreen() {
  const [selectedId, setSelectedId] = useState("C");
  const [step, setStep] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [showWhy, setShowWhy] = useState(false);
  const scale = scales.find((item) => item.id === selectedId);
  const current = scale?.construction[step];
  const lastStep = scale ? scale.construction.length - 1 : 0;
  return (
    <Screen nativeHeader subtitle="Pars d’une note, puis avance d’un intervalle à la fois.">
      <View style={{ gap: 12 }}>
        <Heading>Note de départ</Heading>
        <View accessibilityRole="radiogroup" accessibilityLabel="Note de départ de la gamme">
          <Row>{scales.filter((item) => showAll || ["C", "G", "D", selectedId].includes(item.id)).map((item) => <Chip key={item.id} label={item.notes[0] ?? item.tonic} selected={item.id === selectedId} onPress={() => { setSelectedId(item.id); setStep(0); setShowWhy(false); }} />)}</Row>
        </View>
        <Action label={showAll ? "Réduire le choix de notes" : "Voir les 15 notes de départ"} secondary expanded={showAll} onPress={() => setShowAll((value) => !value)} />
      </View>
      {scale && current ? (
        <Card>
          <Heading>{scale.frenchName}</Heading>
          <Body live>Étape {step + 1} sur {scale.construction.length} : {current.currentNote} + {current.intervalLabel} → {current.result}</Body>
          <Formula activeStep={step} />
          <Body>{[scale.notes[0], ...scale.construction.slice(0, step + 1).map((item) => item.result)].join(" – ")}</Body>
          {step === lastStep ? <Body>Gamme terminée : chaque lettre apparaît une fois, puis on retrouve la note de départ à l’octave.</Body> : null}
          <Row>
            <Action label="Étape précédente" secondary onPress={() => { setStep((value) => Math.max(0, value - 1)); setShowWhy(false); }} disabled={step === 0} />
            <Action label={step === lastStep ? "Recommencer" : "Étape suivante"} onPress={() => { setStep((value) => value === lastStep ? 0 : value + 1); setShowWhy(false); }} />
          </Row>
          <Action label={showWhy ? "Masquer l’explication" : "Pourquoi cette note ?"} secondary expanded={showWhy} onPress={() => setShowWhy((value) => !value)} />
          {showWhy ? (
            <View style={{ gap: 8 }}>
              <Body>Note naturelle suivante : {current.naturalCandidate}</Body>
              <Body>Altération nécessaire : {current.necessaryAlteration}</Body>
              <Body>{current.explanation}</Body>
            </View>
          ) : null}
        </Card>
      ) : <Card><Body>Catalogue musical indisponible.</Body></Card>}
    </Screen>
  );
}
