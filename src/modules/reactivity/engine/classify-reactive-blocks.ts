import { createHash } from "crypto";

type Dependency = {
  blockId: string;
  lastUsedText: string;
  lastUsedHash: string;
};

type TextBlock = { id: string; kind: "text"; text: string };
type ReactiveBlock = {
  id: string;
  kind: "reactive";
  text: string;
  prompt: string;
  dependencies: Dependency[];
};
type Block = TextBlock | ReactiveBlock;

const data: { blocks: Block[]; merges: { fromBlockId: string; intoBlockId: string }[] } = {
  blocks: [
    {
      id: "A1",
      kind: "text",
      text: "Launch in July.",
    },
    {
      id: "A2",
      kind: "text",
      text: "Budget is $20k.",
    },
    {
      id: "C",
      kind: "text",
      text: "Sales are flat. Customers in Europe need local billing.",
    },
    {
      id: "D",
      kind: "text",
      text: "The team has four engineers.",
    },
    {
      id: "R_stable",
      kind: "reactive",
      text: "The team has four engineers.",
      prompt: "State the team size.",
      dependencies: [
        {
          blockId: "D",
          lastUsedText: "The team has four engineers.",
          lastUsedHash: hashText("The team has four engineers."),
        },
      ],
    },
    {
      id: "R_multi",
      kind: "reactive",
      text: "Sales are flat, and the four-person team is addressing billing.",
      prompt: "Summarize the business situation and team.",
      dependencies: [
        {
          blockId: "C",
          lastUsedText: "Sales are flat.",
          lastUsedHash: hashText("Sales are flat."),
        },
        {
          blockId: "D",
          lastUsedText: "The team has four engineers.",
          lastUsedHash: hashText("The team has four engineers."),
        },
      ],
    },
    {
      id: "R_split",
      kind: "reactive",
      text: "The launch is planned for June with a $20k budget.",
      prompt: "Write a one-sentence launch update.",
      dependencies: [
        {
          blockId: "A",
          lastUsedText: "Launch in June. Budget is $20k.",
          lastUsedHash: hashText("Launch in June. Budget is $20k."),
        },
      ],
    },
    {
      id: "R_merge",
      kind: "reactive",
      text: "European customers need local billing.",
      prompt: "Describe the European customer need.",
      dependencies: [
        {
          blockId: "B",
          lastUsedText: "Customers in Europe need local billing.",
          lastUsedHash: hashText("Customers in Europe need local billing."),
        },
      ],
    },
    {
      id: "R_chain",
      kind: "reactive",
      text: "Prioritize local billing with the four-person team.",
      prompt: "Turn the business summary into a priority.",
      dependencies: [
        {
          blockId: "R_multi",
          lastUsedText:
            "Sales are flat, and the four-person team is addressing billing.",
          lastUsedHash: hashText(
            "Sales are flat, and the four-person team is addressing billing."
          ),
        },
      ],
    },
  ],
  merges: [
    {
      fromBlockId: "B",
      intoBlockId: "C",
    },
  ],
};

export function ClassifyReactiveBlocks() {
  const { blocks } = data;
  const reactiveBlocks = new Map<string, ReactiveBlock>();
  const blocksById = new Map<string, Block>();

  blocks.forEach((block) => {
    if (block.kind === "reactive") {
      reactiveBlocks.set(block.id, block);
    }
    blocksById.set(block.id, block);
  });

  const dependencyIndex = buildReverseIndex(reactiveBlocks);

  return { reactiveBlocks, blocksById, dependencyIndex };
}

function buildReverseIndex(reactiveBlocks: Map<string, ReactiveBlock>) {
  const reverseIndex = new Map<string, Set<string>>();

  for (const [reactiveId, block] of reactiveBlocks) {
    for (const dependency of block.dependencies) {
      const dependencyId = dependency.blockId;
      if (!reverseIndex.has(dependencyId)) {
        reverseIndex.set(dependencyId, new Set());
      }

      reverseIndex.get(dependencyId)!.add(reactiveId);
    }
  }

  return reverseIndex;
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function detectStaleBlocks(
  reactiveBlocks: Map<string, ReactiveBlock>,
  blocksById: Map<string, Block>
): { staleBlocks: Set<string>; lostBlocks: Set<string> } {
  const staleBlocks = new Set<string>();
  const lostBlocks = new Set<string>();

  for (const [id, block] of reactiveBlocks) {
    for (const dependency of block.dependencies) {
      const currentBlock = blocksById.get(dependency.blockId);

      if (!currentBlock) {
        lostBlocks.add(id);
        staleBlocks.delete(id);
        break;
      }

      const currentHash = hashText(currentBlock.text);

      if (currentHash !== dependency.lastUsedHash) {
        staleBlocks.add(id);
      }
    }
  }

  return { staleBlocks, lostBlocks };
}
