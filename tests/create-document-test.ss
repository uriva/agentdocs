import { createDocument } from "../scripts/create-document.ss"

testIdentity = (): { bundle: string } => {
  sign = generateEd25519KeyPair()
  enc = generateX25519KeyPair()
  raw = { id: "test-identity", signing: { privateKey: sign.privateKey }, encryption: { privateKey: enc.privateKey } }
  json = jsonStringify({ value: raw })
  encoded = base64urlEncode({ text: json.text })
  return { bundle: encoded.encoded }
}

mockHttpRequest = (host: string, method: string, path: string, headers: { x_timestamp: string }, body: string): { status: number, body: string } => {
  return { status: 201, body: "{\"document\":{\"id\":\"mock-doc-id\"}}" }
}

testCreateDocument = (): { ok: boolean } => {
  id = testIdentity()
  result = override(createDocument, { httpRequest: mockHttpRequest })("Test", "Content", id.bundle)
  assert({ condition: result.status == 201, message: stringConcat({ parts: ["Expected 201, got ", jsonStringify({ value: result.status }).text] }).result })
  assert({ condition: result.documentId == "mock-doc-id", message: "Expected mock-doc-id" })
  return { ok: true }
}
