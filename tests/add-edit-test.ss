import { addEdit } from "../scripts/add-edit.ss"

testIdentity = (): { bundle: string } => {
  sign = generateEd25519KeyPair()
  enc = generateX25519KeyPair()
  raw = { id: "test-identity", signing: { privateKey: sign.privateKey }, encryption: { privateKey: enc.privateKey } }
  json = jsonStringify({ value: raw })
  encoded = base64urlEncode({ text: json.text })
  return { bundle: encoded.encoded }
}

mockHttpRequest = (host: string, method: string, path: string, headers: { x_timestamp: string }): { status: number, body: string } => {
  isEditPath = stringIncludes({ haystack: path, needle: "/edits" })
  status = isEditPath.result ? 201 : 200
  body = isEditPath.result ? "{\"edit\":{\"id\":\"mock-edit-id\"}}" : "{\"document\":{\"id\":\"mock-doc-id\",\"snapshotSequenceNumber\":0}}"
  return { status: status, body: body }
}

testAddEdit = (): { ok: boolean } => {
  id = testIdentity()
  docKey = aesGenerateKey()
  newSnapshot = jsonStringify({ value: { kind: "doc", title: "Updated", content: "**Hello** from [link](https://example.com)" } })
  result = override(addEdit, { httpRequest: mockHttpRequest })({ documentId: "mock-doc-id", documentKey: docKey.key, newSnapshotJson: newSnapshot.text, agentdocsIdentity: id.bundle })
  assert({ condition: result.status == 201, message: stringConcat({ parts: ["Expected 201, got ", jsonStringify({ value: result.status }).text] }).result })
  assert({ condition: result.sequenceNumber == 1, message: stringConcat({ parts: ["Expected seq 1, got ", jsonStringify({ value: result.sequenceNumber }).text] }).result })
  return { ok: true }
}
