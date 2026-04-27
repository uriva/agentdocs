/// <reference lib="deno.ns" />

import { assertEquals, assertExists } from "@std/assert";
import {
  builtinRegistry,
  builtinUnaryFields,
  interpret,
  parse,
  tokenize,
  type OpEntry,
} from "@uri/safescript";
import type { ExecutionContext } from "@uri/safescript";

const identity = Deno.env.get("AGENTDOCS_TEST_IDENTITY");

const source = await Deno.readTextFile(
  new URL("../../scripts/create-document.ss", import.meta.url),
);

const recordingRegistry: Map<string, OpEntry> = new Map();
for (const [name, entry] of builtinRegistry) {
  recordingRegistry.set(name, {
    ...entry,
    create: (params: Record<string, unknown>) => {
      const dagOp = entry.create(params);
      const originalRun = dagOp.run.bind(dagOp);
      dagOp.run = async (dynamicParams: Record<string, unknown>) => {
        console.log(`[op:${name}] params=${JSON.stringify(dynamicParams).slice(0, 200)}`);
        const result = await originalRun(dynamicParams);
        console.log(`[op:${name}] result=${JSON.stringify(result).slice(0, 200)}`);
        return result;
      };
      return dagOp;
    },
  });
}

const recordingFetch = (...args: Parameters<typeof fetch>): Promise<Response> => {
  console.log(
    `[fetch] ${args[1]?.method} ${args[0]} bodyLen=${
      (args[1]?.body as string)?.length ?? "undefined"
    }`,
  );
  return globalThis.fetch(...args);
};

const ctx: ExecutionContext = { fetch: recordingFetch };
const program = parse(tokenize(source), builtinUnaryFields);

Deno.test("create-document - creates and edits successfully", { ignore: !identity }, async () => {
  const result = await interpret(
    program,
    "createDocument",
    {
      title: "Test Document",
      content: "Test content",
      agentdocsIdentity: identity,
    },
    ctx,
    recordingRegistry,
  ) as {
    documentId: string;
    documentKey: string;
    status: number;
    body: string;
  };

  assertEquals(result.status, 201, "Expected 201 status from API");
  assertExists(result.documentId, "Expected documentId");
  assertExists(result.documentKey, "Expected documentKey");
});
