// add-edit.ss
// Appends a new encrypted content edit to an existing document.
//
// Needs the document's AES key (returned from create-document.ss or
// recovered via unwrap-grant logic). Fetches the current edit history
// to pick the next sequenceNumber, encrypts the new content, signs it,
// and POSTs to /api/documents/:id/edits.
//
// Secrets required:
//   agentdocs-identity
//
// Permission surface:
//   secrets read: agentdocs-identity
//   hosts: agentdocs-api.uriva.deno.net
//   env: timestamp

loadIdentity = (): {
  id: string,
  signingPrivateKey: string,
  signingPublicKey: string,
  encryptionPrivateKey: string,
  encryptionPublicKey: string
} => {
  blob = readSecret({ name: "agentdocs-identity" })
  decoded = base64urlDecode(blob.value)
  parsed = jsonParse(decoded.text)
  bundle = parsed.value
  signPub = ed25519PublicFromPrivate(bundle.signing.privateKey)
  encPub = x25519PublicFromPrivate(bundle.encryption.privateKey)
  return {
    id: bundle.id,
    signingPrivateKey: bundle.signing.privateKey,
    signingPublicKey: signPub.publicKey,
    encryptionPrivateKey: bundle.encryption.privateKey,
    encryptionPublicKey: encPub.publicKey
  }
}

buildAuthSignature = (
  method: string,
  path: string,
  timestampStr: string,
  body: string,
  signingPrivateKey: string
): { signature: string } => {
  h = sha256(body)
  msg = stringConcat({ parts: [method, "\n", path, "\n", timestampStr, "\n", h.hash] })
  return ed25519Sign({ data: msg.result, privateKey: signingPrivateKey })
}

signedGet = (
  path: string,
  identityId: string,
  signingPrivateKey: string
): { status: number, body: string } => {
  t = timestamp()
  tsStr = jsonStringify(t.timestamp)
  sig = buildAuthSignature("GET", path, tsStr.text, "", signingPrivateKey)
  return httpRequest({
    host: "agentdocs-api.uriva.deno.net",
    method: "GET",
    path: path,
    headers: {
      "x-identity-id": identityId,
      "x-timestamp": tsStr.text,
      "x-signature": sig.signature
    },
    body: ""
  })
}

signedPost = (
  path: string,
  body: string,
  identityId: string,
  signingPrivateKey: string
): { status: number, body: string } => {
  t = timestamp()
  tsStr = jsonStringify(t.timestamp)
  sig = buildAuthSignature("POST", path, tsStr.text, body, signingPrivateKey)
  return httpRequest({
    host: "agentdocs-api.uriva.deno.net",
    method: "POST",
    path: path,
    headers: {
      "content-type": "application/json",
      "x-identity-id": identityId,
      "x-timestamp": tsStr.text,
      "x-signature": sig.signature
    },
    body: body
  })
}

addEdit = (
  documentId: string,
  documentKey: string,
  newContent: string
): { status: number, body: string, sequenceNumber: number } => {
  identity = loadIdentity()

  // Ask the server for the current edit history to pick the next seq.
  editsPath = stringConcat({ parts: ["/api/documents/", documentId, "/edits"] })
  historyRes = signedGet(editsPath.result, identity.id, identity.signingPrivateKey)
  historyParsed = jsonParse(historyRes.body)
  nextSeq = historyParsed.value.edits.length

  // Encrypt + sign the new content, then append.
  enc = aesEncrypt({ plaintext: newContent, key: documentKey })
  sig = ed25519Sign({ data: newContent, privateKey: identity.signingPrivateKey })
  editBody = jsonStringify({
    encryptedContent: enc.ciphertext,
    encryptedContentIv: enc.iv,
    signature: sig.signature,
    sequenceNumber: nextSeq,
    algorithm: "AES-GCM-256"
  })
  editRes = signedPost(editsPath.result, editBody.text, identity.id, identity.signingPrivateKey)

  return {
    status: editRes.status,
    body: editRes.body,
    sequenceNumber: nextSeq
  }
}
