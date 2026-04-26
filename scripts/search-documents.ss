// search-documents.ss
// Returns every accessible document with its decrypted latest JSON snapshot.
// The agent filters the results locally against any query.
//
// This is an intentional boundary: safescript handles the privacy-sensitive
// crypto (decrypting titles and content), while the final substring match
// happens in the agent's code because safescript has no closures and so
// no natural way to thread a query string into a map callback.
//
// Scales to ~thousands of docs per identity.
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

// Decrypt one document: unwrap grant → recover K → decrypt latest checkpoint
// snapshot. Reads the identity secret each call because
// safescript has no closures — map callbacks must be unary.
decryptOne = (doc: {
  id: string,
  encryptedSnapshot: string,
  encryptedSnapshotIv: string,
  accessGrants: {
    encryptedSymmetricKey: string,
    iv: string,
    salt: string,
    grantor: { encryptionPublicKey: string }[]
  }[]
}): {
  documentId: string,
  kind: string,
  title: string,
  content: string,
  documentKey: string
} => {
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
  content = aesDecrypt({
    ciphertext: doc.encryptedSnapshot,
    iv: doc.encryptedSnapshotIv,
    key: docKey.plaintext
  })
  snapshot = jsonParse(content.plaintext)
  data = snapshot.value
  return {
    documentId: doc.id,
    kind: data.kind,
    title: data.title,
    content: data.content,
    documentKey: docKey.plaintext
  }
}

searchDocuments = (): {
  documents: {
    documentId: string,
    kind: string,
    title: string,
    content: string,
    documentKey: string
  }[]
} => {
  identity = loadIdentity()
  res = signedGet("/api/documents", identity.id, identity.signingPrivateKey)
  parsed = jsonParse(res.body)
  rawDocs = parsed.value.documents
  decrypted = map(decryptOne, rawDocs)
  return { documents: decrypted }
}
