import { builtinUnaryFields, interpret, parse, tokenize } from "@uri/safescript";
import type { ExecutionContext } from "@uri/safescript";

const identity = Deno.env.get("AGENTDOCS_TEST_IDENTITY");

const source = await Deno.readTextFile(
  new URL("../scripts/create-document.ss", import.meta.url),
);

Deno.test(
  "create-document",
  { ignore: !identity, sanitizeResources: false, sanitizeOps: false },
  async () => {
    let callCount = 0;
    let firstBody = "";
    const ctx: ExecutionContext = {
      fetch: ((_input, init?) => {
        callCount++;
        firstBody = firstBody || ((init as RequestInit)?.body as string ?? "");
        if (callCount === 1) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ document: { id: "mock-doc-id" } }),
              { status: 201 },
            ),
          );
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({ edit: { id: "mock-edit-id" } }),
            { status: 201 },
          ),
        );
      }) as typeof fetch,
    };
    const program = parse(tokenize(source), builtinUnaryFields);
    const result = await interpret(program, "createDocument", {
      title: "Test",
      content: "Content",
      agentdocsIdentity: identity,
    }, ctx) as {
      documentId: string;
      documentKey: string;
      status: number;
    };
    if (callCount !== 2) throw new Error(`Expected 2 fetch calls, got ${callCount}`);
    const parsed = JSON.parse(firstBody);
    if (parsed.algorithm !== "AES-GCM-256") throw new Error("Missing algorithm");
    if (!parsed.encryptedSnapshot) throw new Error("Missing encryptedSnapshot");
    if (result.status !== 201) throw new Error(`Expected 201, got ${result.status}`);
    if (result.documentId !== "mock-doc-id") throw new Error("Expected mock-doc-id");
  },
);
