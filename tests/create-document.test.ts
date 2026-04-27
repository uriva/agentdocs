import { builtinUnaryFields, interpret, parse, tokenize } from "@uri/safescript";
import type { ExecutionContext } from "@uri/safescript";

const identity = Deno.env.get("AGENTDOCS_TEST_IDENTITY");

const testSource = await Deno.readTextFile(
  new URL("create-document-test.ss", import.meta.url),
);

const program = parse(tokenize(testSource), builtinUnaryFields);

const ctx: ExecutionContext = {
  fetch: (() => { throw new Error("fetch should not be called"); }) as typeof fetch,
};

const testPath = new URL("create-document-test.ss", import.meta.url).pathname;

Deno.test(
  "create-document - override httpRequest",
  { ignore: !identity, sanitizeResources: false, sanitizeOps: false },
  async () => {
    const result = await interpret(program, "testCreateDocument", {
      id: identity,
    }, ctx, undefined, testPath) as { documentId: string; documentKey: string; status: number };
    if (result.status !== 201) throw new Error(`Expected 201, got ${result.status}`);
    if (result.documentId !== "mock-doc-id") throw new Error("Expected mock-doc-id");
  },
);
