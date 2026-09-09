export type Fact =
  | { kind: 'prompt'; text: string; ts: string }
  | { kind: 'turn-end'; ts: string }
  | { kind: 'turn-aborted'; ts: string }
  | { kind: 'activity'; ts: string };
