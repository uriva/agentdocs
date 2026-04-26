// get-document.ss
// Fetches a single document by id and decrypts the latest JSON snapshot.
// Returns { documentId, kind, title, content, documentKey, sequenceNumber }.
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
  decoded = base64urlDecode({ encoded: blob.value })
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

getDocument = (documentId: string): {
  documentId: string,
  kind: string,
  title: string,
  content: string,
  documentKey: string,
  sequenceNumber: number
} => {
  identity = loadIdentity()

  // Fetch the single doc (with grant) + its edit history in sequence.
  docPath = stringConcat({ parts: ["/api/documents/", documentId] })
  docRes = signedGet(docPath.result, identity.id, identity.signingPrivateKey)
  docParsed = jsonParse({ text: docRes.body })
  doc = docParsed.value.document
  grant = doc.accessGrants[0]
  grantorPub = grant.grantor[0].encryptionPublicKey

  // Recover the document AES key via ECDH.
  derived = x25519DeriveKey({
    myPrivateKey: identity.encryptionPrivateKey,
    theirPublicKey: grantorPub,
    salt: grant.salt,
    info: "agentdocs-access-grant"
  })
  docKey = aesDecrypt({
    ciphertext: grant.encryptedSymmetricKey,
    iv: grant.iv,
    key: derived.derivedKey
  })
  // Decrypt latest checkpoint snapshot directly from document row.
  content = aesDecrypt({
    ciphertext: doc.encryptedSnapshot,
    iv: doc.encryptedSnapshotIv,
    key: docKey.plaintext
  })
  snapshot = jsonParse({ text: content.plaintext })
  data = snapshot.value

  return {
    documentId: documentId,
    kind: data.kind,
    title: data.title,
    content: data.content,
    documentKey: docKey.plaintext,
    sequenceNumber: doc.snapshotSequenceNumber
  }
}
