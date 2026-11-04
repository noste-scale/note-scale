import { normalizeNoteId, pitchClassOf } from "@notescale/music";
import { useRef } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ScrollViewInstance
} from "react-native";
import { useTheme } from "./theme";

const pianoKeys = [
  {
    id: "C",
    label: "Do",
    isBlackKey: false,
    whiteKeyPosition: 0
  },
  {
    id: "C#",
    label: "Do♯ / Ré♭",
    isBlackKey: true,
    whiteKeyPosition: 1
  },
  {
    id: "D",
    label: "Ré",
    isBlackKey: false,
    whiteKeyPosition: 1
  },
  {
    id: "D#",
    label: "Ré♯ / Mi♭",
    isBlackKey: true,
    whiteKeyPosition: 2
  },
  {
    id: "E",
    label: "Mi",
    isBlackKey: false,
    whiteKeyPosition: 2
  },
  {
    id: "F",
    label: "Fa",
    isBlackKey: false,
    whiteKeyPosition: 3
  },
  {
    id: "F#",
    label: "Fa♯ / Sol♭",
    isBlackKey: true,
    whiteKeyPosition: 4
  },
  {
    id: "G",
    label: "Sol",
    isBlackKey: false,
    whiteKeyPosition: 4
  },
  {
    id: "G#",
    label: "Sol♯ / La♭",
    isBlackKey: true,
    whiteKeyPosition: 5
  },
  {
    id: "A",
    label: "La",
    isBlackKey: false,
    whiteKeyPosition: 5
  },
  {
    id: "A#",
    label: "La♯ / Si♭",
    isBlackKey: true,
    whiteKeyPosition: 6
  },
  {
    id: "B",
    label: "Si",
    isBlackKey: false,
    whiteKeyPosition: 6
  },
] as const;

const getNotePitchClass = (note: string): number | undefined => {
  const normalizedNote = normalizeNoteId(note);

  return normalizedNote ? pitchClassOf(normalizedNote) : undefined;
};

export function Piano({
  activeNotes = [],
  soundingPitch,
  onPlayNote,
}: {
  activeNotes?: string[];
  soundingPitch?: number | undefined;
  onPlayNote: (note: string) => void;
}) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const keyboardScale = Math.max(1, fontScale);
  const whiteKeyWidth = 76 * keyboardScale;
  const blackKeyWidth = 48 * keyboardScale;
  const keyboardScroll = useRef<ScrollViewInstance>(null);
  const viewportWidth = useRef(0);
  const tonicPianoKey = pianoKeys.find((pianoKey) => getNotePitchClass(pianoKey.id) === getNotePitchClass(activeNotes[0] ?? "C"));
  const revealTonic = () => keyboardScroll.current?.scrollTo({
    x: Math.max(0, (tonicPianoKey?.whiteKeyPosition ?? 0) * whiteKeyWidth - viewportWidth.current / 2 + whiteKeyWidth / 2),
    animated: false
  });
  const scalePitchClasses = new Set(activeNotes.flatMap((note) => {
    const pitchClass = getNotePitchClass(note);

    return pitchClass === undefined ? [] : [pitchClass];
  }));

  return (
    <View accessibilityLabel="Clavier chromatique interactif">
      <Text accessibilityLiveRegion="none" style={[styles.caption, { color: theme.muted }]}>En jaune : notes de la gamme. Fais glisser le clavier.</Text>
      <ScrollView
        ref={keyboardScroll}
        horizontal
        showsHorizontalScrollIndicator
        onLayout={({ nativeEvent }) => {
          viewportWidth.current = nativeEvent.layout.width;
          revealTonic();
        }}
        onContentSizeChange={revealTonic}
      >
        <View style={{ width: 7 * whiteKeyWidth, height: 180 * keyboardScale }}>
          {pianoKeys.map((pianoKey) => {
            const keyPitchClass = getNotePitchClass(pianoKey.id);
            const isScaleNote = keyPitchClass !== undefined && scalePitchClasses.has(keyPitchClass);
            const isSounding = keyPitchClass === soundingPitch;
            let backgroundColor = pianoKey.isBlackKey ? "#182027" : "#FFFFFF";
            let color = pianoKey.isBlackKey ? "#FFFFFF" : "#182027";

            if (isScaleNote) {
              backgroundColor = theme.accent;
              color = "#182027";
            }
            if (isSounding) {
              backgroundColor = theme.primary;
              color = theme.primaryText;
            }

            return (
              <Pressable
                key={pianoKey.id}
                accessibilityRole="button"
                accessibilityLabel={`${pianoKey.label}${isScaleNote ? ", note de la gamme" : ""}${isSounding ? ", en lecture" : ""}`}
                accessibilityHint="Joue cette hauteur avec un fichier audio local"
                accessibilityState={{ selected: isSounding }}
                onPress={() => onPlayNote(pianoKey.id)}
                style={({ pressed }) => [
                  styles.key,
                  {
                    left: pianoKey.whiteKeyPosition * whiteKeyWidth - (pianoKey.isBlackKey ? blackKeyWidth / 2 : 0),
                    width: pianoKey.isBlackKey ? blackKeyWidth : whiteKeyWidth,
                    height: (pianoKey.isBlackKey ? 108 : 180) * keyboardScale,
                    zIndex: pianoKey.isBlackKey ? 1 : 0,
                    backgroundColor,
                    borderColor: isSounding ? theme.focus : theme.border,
                    opacity: pressed ? 0.75 : 1
                  }
                ]}
              >
                <Text style={[styles.keyText, { color }]}>{pianoKey.label.replace(" / ", "\n")}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 16, lineHeight: 24 },
  key: {
    position: "absolute",
    top: 0,
    alignItems: "center",
    borderWidth: 1,
    justifyContent: "flex-end",
    paddingBottom: 8,
    paddingHorizontal: 4
  },
  keyText: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
});
