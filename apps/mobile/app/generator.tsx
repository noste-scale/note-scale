import { useState } from "react";
import { View } from "react-native";
import { Action, Body, Card, Chip, Formula, Heading, Row, Screen } from "../src/components";
import { scales } from "../src/domain";

export default function GeneratorScreen() {
  const [selectedScaleId, setSelectedScaleId] = useState("C");
  const [stepIndex, setStepIndex] = useState(0);
  const [showAllTonics, setShowAllTonics] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const scale = scales.find((item) => item.id === selectedScaleId);
  const constructionStep = scale?.construction[stepIndex];
  const lastStepIndex = scale ? scale.construction.length - 1 : 0;
  return (
    <Screen nativeHeader subtitle="Pars d’une note, puis avance d’un intervalle à la fois.">
      <View style={{ gap: 12 }}>
        <Heading>Note de départ</Heading>
        <View accessibilityRole="radiogroup" accessibilityLabel="Note de départ de la gamme">
          <Row>
            {scales.filter((item) => showAllTonics || ["C", "G", "D", selectedScaleId].includes(item.id)).map((item) => <Chip
              key={item.id}
              label={item.notes[0] ?? item.tonic}
              selected={item.id === selectedScaleId}
              onPress={() => {
                setSelectedScaleId(item.id);
                setStepIndex(0);
                setShowExplanation(false);
              }}
            />)}
          </Row>
        </View>
        <Action
          label={showAllTonics ? "Réduire le choix de notes" : "Voir les 15 notes de départ"}
          secondary
          expanded={showAllTonics}
          onPress={() => setShowAllTonics((value) => !value)}
        />
      </View>
      {scale && constructionStep ? (
        <Card>
          <Heading>{scale.frenchName}</Heading>
          <Body live>Étape {stepIndex + 1} sur {scale.construction.length} : {constructionStep.currentNote} + {constructionStep.intervalLabel} → {constructionStep.result}</Body>
          <Formula activeStep={stepIndex} />
          <Body>{[scale.notes[0], ...scale.construction.slice(0, stepIndex + 1).map((item) => item.result)].join(" – ")}</Body>
          {stepIndex === lastStepIndex ? <Body>Gamme terminée : chaque lettre apparaît une fois, puis on retrouve la note de départ à l’octave.</Body> : null}
          <Row>
            <Action
              label="Étape précédente"
              secondary
              onPress={() => {
                setStepIndex((value) => Math.max(0, value - 1));
                setShowExplanation(false);
              }}
              disabled={stepIndex === 0}
            />
            <Action
              label={stepIndex === lastStepIndex ? "Recommencer" : "Étape suivante"}
              onPress={() => {
                setStepIndex((value) => value === lastStepIndex ? 0 : value + 1);
                setShowExplanation(false);
              }}
            />
          </Row>
          <Action
            label={showExplanation ? "Masquer l’explication" : "Pourquoi cette note ?"}
            secondary
            expanded={showExplanation}
            onPress={() => setShowExplanation((value) => !value)}
          />
          {showExplanation ? (
            <View style={{ gap: 8 }}>
              <Body>Note naturelle suivante : {constructionStep.naturalCandidate}</Body>
              <Body>Altération nécessaire : {constructionStep.necessaryAlteration}</Body>
              <Body>{constructionStep.explanation}</Body>
            </View>
          ) : null}
        </Card>
      ) : <Card>
        <Body>Catalogue musical indisponible.</Body>
      </Card>}
    </Screen>
  );
}
