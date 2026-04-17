// create-document.ss
// Creates an encrypted JSON document and appends its first edit.
//
// Reads the agent's identity from `agentdocs-identity` (base64url JSON
// bundle exported from the agentdocs web UI), generates a fresh AES key,
// wraps the key for the creator (self access grant), signs and sends
// POST /api/documents, then appends a first edit containing a JSON
// snapshot: { kind: "doc", title, content }.
//
// Returns { documentId, documentKey, status, body }. Persist documentId
// and documentKey — documentKey is the only thing that can decrypt the
// document later.
//
// Secrets required:
//   agentdocs-identity -- base64url-encoded JSON exported from the web UI:
//                         { id, name, signing: { privateKey },
//                           encryption: { privateKey }, algorithm: {...} }
//
// Permission surface (static analysis):
//   secrets read: agentdocs-identity
//   hosts: agentdocs-api.uriva.deno.net
//   env: timestamp, randomBytes

// Load + parse the identity bundle. The bundle only carries private keys;
// public keys are derived here so downstream code has the full pair.
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

// Build an access grant: encrypt docKey so the recipient (theirEncPub)
// can later recover it with their own X25519 private key + our public key.
buildGrant = (
  docKey: string,
  myEncPriv: string,
  theirEncPub: string
): { encryptedSymmetricKey: string, iv: string, salt: string, algorithm: string } => {
  salt = randomBytes(16)
  derived = x25519DeriveKey({
    myPrivateKey: myEncPriv,
    theirPublicKey: theirEncPub,
    salt: salt.bytes,
    info: "agentdocs-access-grant"
  })
  wrapped = aesEncrypt({ plaintext: docKey, key: derived.derivedKey })
  return {
    encryptedSymmetricKey: wrapped.ciphertext,
    iv: wrapped.iv,
    salt: salt.bytes,
    algorithm: "AES-GCM-256"
  }
}

// Build the signed-request auth signature: Ed25519 over
// `${method}\n${path}\n${timestamp}\n${sha256(body)}`.
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

// Signed POST to the agentdocs API. Returns the raw httpRequest response.
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

createDocument = (
  title: string,
  content: string
): { documentId: string, documentKey: string, status: number, body: string } => {
  identity = loadIdentity()
  docKey = aesGenerateKey()
  grant = buildGrant(docKey.key, identity.encryptionPrivateKey, identity.encryptionPublicKey)

  // POST /api/documents — creates the document with a self access grant.
  createBody = jsonStringify({
    algorithm: "AES-GCM-256",
    accessGrant: grant
  })
  createRes = signedPost("/api/documents", createBody.text, identity.id, identity.signingPrivateKey)
  parsed = jsonParse(createRes.body)
  docId = parsed.value.document.id

  // POST /api/documents/:id/edits — append first JSON snapshot.
  snapshot = jsonStringify({ kind: "doc", title: title, content: content })
  encContent = aesEncrypt({ plaintext: snapshot.text, key: docKey.key })
  contentSig = ed25519Sign({ data: snapshot.text, privateKey: identity.signingPrivateKey })
  editBody = jsonStringify({
    encryptedContent: encContent.ciphertext,
    encryptedContentIv: encContent.iv,
    signature: contentSig.signature,
    sequenceNumber: 0,
    algorithm: "AES-GCM-256"
  })
  editPath = stringConcat({ parts: ["/api/documents/", docId, "/edits"] })
  editRes = signedPost(editPath.result, editBody.text, identity.id, identity.signingPrivateKey)

  return {
    documentId: docId,
    documentKey: docKey.key,
    status: editRes.status,
    body: editRes.body
  }
}
