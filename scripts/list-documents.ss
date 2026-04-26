// list-documents.ss
// Fetches all documents the agent has access to, decrypts latest checkpoint
// snapshot, and returns { documentId, kind, title, content, documentKey }.
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

// Decrypt one document snapshot. Re-reads the identity secret each call; the
// permission surface already covers it and safescript has no closures, so
// this keeps the map function unary.
decryptDoc = (doc: {
  id: string,
  encryptedSnapshot: string,
  encryptedSnapshotIv: string,
  accessGrants: {
    encryptedSymmetricKey: string,
    iv: string,
    salt: string,
    grantor: { encryptionPublicKey: string }[]
  }[]
}): { documentId: string, kind: string, title: string, content: string, documentKey: string } => {
  identity = loadIdentity()
  grant = doc.accessGrants[0]
  grantorPub = grant.grantor[0].encryptionPublicKey
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
  contentPlain = aesDecrypt({
    ciphertext: doc.encryptedSnapshot,
    iv: doc.encryptedSnapshotIv,
    key: docKey.plaintext
  })
  snapshot = jsonParse({ text: contentPlain.plaintext })
  data = snapshot.value
  return {
    documentId: doc.id,
    kind: data.kind,
    title: data.title,
    content: data.content,
    documentKey: docKey.plaintext
  }
}

listDocuments = (): {
  documents: { documentId: string, kind: string, title: string, content: string, documentKey: string }[]
} => {
  identity = loadIdentity()
  res = signedGet("/api/documents", identity.id, identity.signingPrivateKey)
  parsed = jsonParse({ text: res.body })
  rawDocs = parsed.value.documents
  decrypted = map(decryptDoc, rawDocs)
  return { documents: decrypted }
}
