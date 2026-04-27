import { createDocument } from "../scripts/create-document.ss"

mockHttpRequest = (host: string, method: string, path: string, headers: { x_timestamp: string }, body: string): { status: number, body: string } => {
  return { status: 201, body: "{\"document\":{\"id\":\"mock-doc-id\"}}" }
}

testCreateDocument = (id: string): { ok: boolean } => {
  result = override(createDocument, { httpRequest: mockHttpRequest })("Test", "Content", id)
  assert({ condition: result.status == 201, message: stringConcat({ parts: ["Expected 201, got ", jsonStringify({ value: result.status }).text] }).result })
  assert({ condition: result.documentId == "mock-doc-id", message: "Expected mock-doc-id" })
  return { ok: true }
}
