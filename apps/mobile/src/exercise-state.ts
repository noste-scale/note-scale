export type ExerciseSelectionMode = "single" | "multiple" | "ordered";

export interface ExerciseResponse<TGrade> {
  exerciseId: string;
  selected: readonly string[];
  grade?: TGrade;
}

export function responseForExercise<TGrade>(
  current: ExerciseResponse<TGrade>,
  exerciseId: string,
): ExerciseResponse<TGrade> {
  return current.exerciseId === exerciseId ? current : { exerciseId, selected: [] };
}

export function updateSelection(
  mode: ExerciseSelectionMode,
  current: readonly string[],
  option: string,
  maximum: number,
  exclusiveOption?: string,
): readonly string[] {
  if (mode === "single") return [option];
  if (mode === "ordered") return current.length < maximum ? [...current, option] : current;
  if (option === exclusiveOption) return current.length === 1 && current[0] === option ? [] : [option];
  const withoutExclusive = exclusiveOption ? current.filter((item) => item !== exclusiveOption) : current;
  return withoutExclusive.includes(option)
    ? withoutExclusive.filter((item) => item !== option)
    : [...withoutExclusive, option];
}

export function selectionPayload(
  selected: readonly string[],
  optionPayloads: Readonly<Record<string, readonly string[]>>,
): readonly string[] {
  return selected.flatMap((option) => optionPayloads[option] ?? []);
}

export function routeValue(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

export function shouldRecordAttempt(
  lastRecordedExerciseId: string | undefined,
  exerciseId: string,
  graded: boolean,
): boolean {
  return graded && lastRecordedExerciseId !== exerciseId;
}

export function attemptRecordingDecision(
  lastRecordedExerciseId: string | undefined,
  exerciseId: string,
  graded: boolean,
): { record: boolean; lastRecordedExerciseId: string | undefined } {
  const record = shouldRecordAttempt(lastRecordedExerciseId, exerciseId, graded);
  return { record, lastRecordedExerciseId: record ? exerciseId : lastRecordedExerciseId };
}
