// list-documents.ss
// Fetches all documents the agent has access to and decrypts their titles.
// Returns an array of { documentId, title, documentKey } — persist
// documentKey locally if you want to avoid re-deriving it on every access.
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

// Decrypt one document's title. Re-reads the identity secret each call; the
// permission surface already covers it and safescript has no closures, so
// this keeps the map function unary.
decryptDoc = (doc: {
  id: string,
  encryptedTitle: string,
  encryptedTitleIv: string,
  accessGrants: {
    encryptedSymmetricKey: string,
    iv: string,
    salt: string,
    grantor: { encryptionPublicKey: string }[]
  }[]
}): { documentId: string, title: string, documentKey: string } => {
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
  title = aesDecrypt({
    ciphertext: doc.encryptedTitle,
    iv: doc.encryptedTitleIv,
    key: docKey.plaintext
  })
  return {
    documentId: doc.id,
    title: title.plaintext,
    documentKey: docKey.plaintext
  }
}

listDocuments = (): {
  documents: { documentId: string, title: string, documentKey: string }[]
} => {
  identity = loadIdentity()
  res = signedGet("/api/documents", identity.id, identity.signingPrivateKey)
  parsed = jsonParse(res.body)
  rawDocs = parsed.value.documents
  decrypted = map(decryptDoc, rawDocs)
  return { documents: decrypted }
}
