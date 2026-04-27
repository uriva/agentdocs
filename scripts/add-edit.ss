// add-edit.ss
// Appends a new encrypted JSON patch edit to an existing document.
//
// Needs the document's AES key (returned from create-document.ss or
// recovered via unwrap-grant logic). Fetches the current edit history
// to pick base sequence, builds an encrypted replace_snapshot patch,
// and updates the document checkpoint in the same API call.
//
// Parameters:
//   agentdocsIdentity -- base64url-encoded identity bundle (regular input)
//
// Permission surface:
//   hosts: agentdocs-api.uriva.deno.net
//   env: timestamp

loadIdentity = (bundleBase64url: string): {
  id: string,
  signingPrivateKey: string,
  signingPublicKey: string,
  encryptionPrivateKey: string,
  encryptionPublicKey: string
} => {
  decoded = base64urlDecode({ encoded: bundleBase64url })
  parsed = jsonParse({ text: decoded.text })
  bundle = parsed.value
  signPub = ed25519PublicFromPrivate({ privateKey: bundle.signing.privateKey })
  encPub = x25519PublicFromPrivate({ privateKey: bundle.encryption.privateKey })
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
  h = sha256({ data: body })
  msg = stringConcat({ parts: [method, "\n", path, "\n", timestampStr, "\n", h.hash] })
  return ed25519Sign({ data: msg.result, privateKey: signingPrivateKey })
}

signedGet = (
  path: string,
  identityId: string,
  signingPrivateKey: string
): { status: number, body: string } => {
  t = timestamp()
  tsStr = jsonStringify({ value: t.timestamp })
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
  tsStr = jsonStringify({ value: t.timestamp })
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
  newSnapshotJson: string,
  agentdocsIdentity: string
): { status: number, body: string, sequenceNumber: number } => {
  identity = loadIdentity(agentdocsIdentity)

  // Get current snapshot sequence as patch base.
  docPath = stringConcat({ parts: ["/api/documents/", documentId] })
  docRes = signedGet(docPath.result, identity.id, identity.signingPrivateKey)
  docParsed = jsonParse({ text: docRes.body })
  baseSeq = docParsed.value.document.snapshotSequenceNumber
  nextSeq = baseSeq + 1

  // Encrypt + sign the patch, include encrypted resulting snapshot.
  patchObj = { type: "replace_snapshot", snapshot: newSnapshotJson }
  patch = jsonStringify(patchObj)
  patchHash = sha256({ data: newSnapshotJson })
  encPatch = aesEncrypt({ plaintext: patch.text, key: documentKey })
  encSnapshot = aesEncrypt({ plaintext: newSnapshotJson, key: documentKey })
  sig = ed25519Sign({ data: patch.text, privateKey: identity.signingPrivateKey })
  editsPath = stringConcat({ parts: ["/api/documents/", documentId, "/edits"] })
  editBodyObj = {
    encryptedPatch: encPatch.ciphertext,
    encryptedPatchIv: encPatch.iv,
    signature: sig.signature,
    baseSequenceNumber: baseSeq,
    sequenceNumber: nextSeq,
    resultingSnapshotHash: patchHash.hash,
    encryptedResultingSnapshot: encSnapshot.ciphertext,
    encryptedResultingSnapshotIv: encSnapshot.iv,
    algorithm: "AES-GCM-256"
  }
  editBody = jsonStringify(editBodyObj)
  editRes = signedPost(editsPath.result, editBody.text, identity.id, identity.signingPrivateKey)

  return {
    status: editRes.status,
    body: editRes.body,
    sequenceNumber: nextSeq
  }
}
