// search-documents.ss
// Returns every accessible document with its decrypted latest JSON snapshot.
// The agent filters the results locally against any query.
//
// This is an intentional boundary: safescript handles the privacy-sensitive
// crypto (decrypting titles and content), while the final substring match
// happens in the agent's code because safescript has no closures and so
// no natural way to thread a query string into a map callback.
//
// Uses reduce (instead of map) so the identity fields ride through the
// accumulator — safescript's map callbacks are unary and have no closures.
//
// Scales to ~thousands of docs per identity.
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

// reduce callback: accumulator carries identity fields + results list.
// Each step decrypts one document using identity fields from the acc,
// appends the decrypted result, and returns the new accumulator.
decryptReducer = (
  acc: {
    results: { documentId: string, kind: string, title: string, content: string, documentKey: string }[],
    encPriv: string
  },
  element: {
    id: string,
    encryptedSnapshot: string,
    encryptedSnapshotIv: string,
    accessGrants: {
      encryptedSymmetricKey: string,
      iv: string,
      salt: string,
      grantor: { encryptionPublicKey: string }[]
    }[]
  }
): {
  results: { documentId: string, kind: string, title: string, content: string, documentKey: string }[],
  encPriv: string
} => {
  doc = element
  grant = doc.accessGrants[0]
  grantorPub = grant.grantor[0].encryptionPublicKey
  derived = x25519DeriveKey({
    myPrivateKey: acc.encPriv,
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
  decrypted = {
    documentId: doc.id,
    kind: data.kind,
    title: data.title,
    content: data.content,
    documentKey: docKey.plaintext
  }
  appended = arrayAppend({ array: acc.results, element: decrypted })
  return { results: appended.array, encPriv: acc.encPriv }
}

searchDocuments = (agentdocsIdentity: string): {
  documents: {
    documentId: string,
    kind: string,
    title: string,
    content: string,
    documentKey: string
  }[]
} => {
  identity = loadIdentity(agentdocsIdentity)
  res = signedGet("/api/documents", identity.id, identity.signingPrivateKey)
  parsed = jsonParse({ text: res.body })
  rawDocs = parsed.value.documents
  final = reduce(decryptReducer, { results: [], encPriv: identity.encryptionPrivateKey }, rawDocs)
  return { documents: final.results }
}
