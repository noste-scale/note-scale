import { useState } from "react";
import { View } from "react-native";
import { Action, Body, Card, Chip, Formula, Heading, Row, Screen } from "../src/components";
import { scales } from "../src/domain";

export default function GeneratorScreen() {
  const [selectedScaleId, setSelectedScaleId] = useState("C");
  const [constructionStepIndex, setConstructionStepIndex] = useState(0);
  const [showAllTonics, setShowAllTonics] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const scale = scales.find((scaleOption) => scaleOption.id === selectedScaleId);
  const constructionStep = scale?.construction[constructionStepIndex];
  const lastStepIndex = scale ? scale.construction.length - 1 : 0;
  return (
    <Screen nativeHeader subtitle="Pars d’une note, puis avance d’un intervalle à la fois.">
      <View style={{ gap: 12 }}>
        <Heading>Note de départ</Heading>
        <View accessibilityRole="radiogroup" accessibilityLabel="Note de départ de la gamme">
          <Row>
            {scales.filter((scaleOption) => showAllTonics || ["C", "G", "D", selectedScaleId].includes(scaleOption.id)).map((scaleOption) => <Chip
              key={scaleOption.id}
              label={scaleOption.notes[0] ?? scaleOption.tonic}
              selected={scaleOption.id === selectedScaleId}
              onPress={() => {
                setSelectedScaleId(scaleOption.id);
                setConstructionStepIndex(0);
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
          <Body live>Étape {constructionStepIndex + 1} sur {scale.construction.length} : {constructionStep.currentNote} + {constructionStep.intervalLabel} → {constructionStep.result}</Body>
          <Formula activeStep={constructionStepIndex} />
          <Body>{[scale.notes[0], ...scale.construction.slice(0, constructionStepIndex + 1).map((completedStep) => completedStep.result)].join(" – ")}</Body>
          {constructionStepIndex === lastStepIndex ? <Body>Gamme terminée : chaque lettre apparaît une fois, puis on retrouve la note de départ à l’octave.</Body> : null}
          <Row>
            <Action
              label="Étape précédente"
              secondary
              onPress={() => {
                setConstructionStepIndex((value) => Math.max(0, value - 1));
                setShowExplanation(false);
              }}
              disabled={constructionStepIndex === 0}
            />
            <Action
              label={constructionStepIndex === lastStepIndex ? "Recommencer" : "Étape suivante"}
              onPress={() => {
                setConstructionStepIndex((value) => value === lastStepIndex ? 0 : value + 1);
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
