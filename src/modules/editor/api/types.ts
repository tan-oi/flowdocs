export type Origin = "user" | "agent" | "engine";

export type ReactiveFormat = "text" | "chart";

export type Dependency = {
  sourceId: string;
  external: boolean;
  lastUsedText: string;
  lastUsedHash: string;
};

export type Source = Pick<Dependency, "sourceId" | "external">;

export type TextBlock = {
  id: string;
  kind: "text";
  type: string;
  text: string;
};

export type ReactiveBlock = {
  id: string;
  kind: "reactive";
  type: "reactive";
  format: ReactiveFormat;
  prompt: string;
  output: string;
  dependencies: Dependency[];
  text: string;
};

export type Block = TextBlock | ReactiveBlock;

export type NewBlock = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
};
