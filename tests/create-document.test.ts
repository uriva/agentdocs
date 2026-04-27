import { builtinUnaryFields, interpret, parse, tokenize } from "@uri/safescript";
import type { ExecutionContext } from "@uri/safescript";

const identity = Deno.env.get("AGENTDOCS_TEST_IDENTITY");

const source = await Deno.readTextFile(
  new URL("../scripts/create-document.ss", import.meta.url),
);

const ctx: ExecutionContext = {
  fetch: (input, init) => globalThis.fetch(input, init),
};

Deno.test(
  "create-document",
  { ignore: !identity },
  async () => {
    const program = parse(tokenize(source), builtinUnaryFields);
    const result = await interpret(program, "createDocument", {
      title: "Test Document",
      content: "Test content",
      agentdocsIdentity: identity,
    }, ctx) as {
      documentId: string;
      documentKey: string;
      status: number;
    };
    if (result.status !== 201) throw new Error(`Expected 201, got ${result.status}`);
    if (typeof result.documentId !== "string") throw new Error("Expected documentId");
    if (typeof result.documentKey !== "string") throw new Error("Expected documentKey");
  },
);
