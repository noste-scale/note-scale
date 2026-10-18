import { Body, Heading, Screen } from "../src/components";

export default function PrivacyScreen() {
  return (
    <Screen title="Politique de confidentialité" subtitle="NoteScale pour Android · Mise à jour : 18 octobre 2026" nativeHeader>
      <Body>NoteScale permet d’apprendre les gammes majeures sans compte. Les leçons, les exercices et les sons sont inclus dans l’application et fonctionnent hors ligne.</Body>
      <Heading>Données sur ton appareil</Heading>
      <Body>NoteScale enregistre les résultats et les dates de tes exercices, les gammes travaillées, les révisions prévues, la dernière leçon ouverte et ton choix de thème. Ces données servent uniquement à afficher ta progression, proposer tes révisions et reprendre ton apprentissage.</Body>
      <Heading>Collecte et partage</Heading>
      <Body>NoteScale n’envoie pas ta progression à l’éditeur. L’application ne contient ni publicité, ni outil de suivi publicitaire ou de mesure d’audience. Elle ne demande pas ton nom, ton adresse e-mail ou ta position, et n’accède pas à tes contacts, à tes photos ou au microphone. Les sons sont lus depuis les fichiers fournis avec l’application ; ta voix n’est pas enregistrée. Aucune donnée de progression n’est vendue ou partagée par l’éditeur.</Body>
      <Heading>Stockage et sauvegardes</Heading>
      <Body>Les données sont conservées dans l’espace privé de l’application, protégé par les mécanismes d’Android. NoteScale ne propose pas de synchronisation via un compte. Selon tes réglages et ton appareil, Android peut sauvegarder ou transférer les données de l’application. Ces fonctions dépendent du système et de son fournisseur ; l’éditeur de NoteScale n’a pas accès à ces sauvegardes.</Body>
      <Heading>Conservation et suppression</Heading>
      <Body>Les données restent enregistrées jusqu’à leur suppression. Pour les effacer sur ton appareil : ouvre les paramètres Android, puis Applications → NoteScale → Stockage et cache → Effacer les données. Les intitulés peuvent varier selon l’appareil. Cette action efface définitivement la progression et les préférences locales. Pour supprimer aussi une sauvegarde du système, utilise les réglages de sauvegarde de ton appareil ou de ton compte système. Il n’y a aucun compte NoteScale à supprimer.</Body>
      <Heading>Éditeur et contact</Heading>
      <Body>Éditeur : sanrandry (GitHub). Pour toute question sur NoteScale ou tes données : sinrandry@gmail.com.</Body>
      <Body>Si tu envoies un e-mail, l’éditeur reçoit ton adresse et ton message pour traiter ta demande. Ces échanges sont distincts des données locales de l’application. Tu peux utiliser cette même adresse pour demander la suppression de tes échanges.</Body>
      <Heading>Évolutions</Heading>
      <Body>Cette politique décrit la version Android de NoteScale. Toute évolution du traitement des données sera indiquée dans une politique mise à jour, accessible depuis l’accueil de l’application.</Body>
    </Screen>
  );
}
