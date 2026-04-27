// create-document.ss
// Creates an encrypted JSON document with checkpoint+patch model.
//
// Reads the agent's identity from `agentdocs-identity` (base64url JSON
// bundle exported from the agentdocs web UI), generates a fresh AES key,
// wraps the key for the creator (self access grant), signs and sends
// POST /api/documents with an initial encrypted snapshot, then appends
// the first edit as an encrypted patch carrying the same snapshot.
//
// Returns { documentId, documentKey, status, body }. Persist documentId
// and documentKey — documentKey is the only thing that can decrypt the
// document later.
//
// Parameters:
//   agentdocsIdentity -- base64url-encoded identity bundle (regular input)
//
// Permission surface (static analysis):
//   hosts: agentdocs-api.uriva.deno.net
//   env: timestamp, randomBytes

// Load + parse the identity bundle. The bundle only carries private keys;
// public keys are derived here so downstream code has the full pair.
// bundleBase64url is the base64url-encoded identity JSON, passed as a regular
// input (not read from secrets — secrets are regular inputs in safescript).
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

// Build an access grant: encrypt docKey so the recipient (theirEncPub)
// can later recover it with their own X25519 private key + our public key.
buildGrant = (
  docKey: string,
  myEncPriv: string,
  theirEncPub: string
): { encryptedSymmetricKey: string, iv: string, salt: string, algorithm: string } => {
  salt = randomBytes({ length: 16 })
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
  h = sha256({ data: body })
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

createDocument = (
  title: string,
  content: string,
  agentdocsIdentity: string
): { documentId: string, documentKey: string, status: number, body: string } => {
   identity = loadIdentity(agentdocsIdentity)
   docKey = aesGenerateKey()
   grant = buildGrant(docKey.key, identity.encryptionPrivateKey, identity.encryptionPublicKey)
   snapshotObj = { kind: "doc", title: title, content: content }
   snapshot = jsonStringify(snapshotObj)
   snapshotHash = sha256({ data: snapshot.text })
   encSnapshot = aesEncrypt({ plaintext: snapshot.text, key: docKey.key })

   // POST /api/documents — creates with encrypted latest snapshot + self grant.
   createBodyObj = {
     algorithm: "AES-GCM-256",
     encryptedSnapshot: encSnapshot.ciphertext,
     encryptedSnapshotIv: encSnapshot.iv,
     snapshotHash: snapshotHash.hash,
     accessGrant: grant
   }
   createBody = jsonStringify(createBodyObj)
   createRes = signedPost("/api/documents", createBody.text, identity.id, identity.signingPrivateKey)
   parsed = jsonParse({ text: createRes.body })
   docId = parsed.value.document.id

   // POST /api/documents/:id/edits — append first patch + checkpoint update.
   patchObj = { type: "replace_snapshot", snapshot: snapshot.text }
   patch = jsonStringify(patchObj)
   encPatch = aesEncrypt({ plaintext: patch.text, key: docKey.key })
   patchSig = ed25519Sign({ data: patch.text, privateKey: identity.signingPrivateKey })
   editBodyObj = {
     encryptedPatch: encPatch.ciphertext,
     encryptedPatchIv: encPatch.iv,
     signature: patchSig.signature,
     baseSequenceNumber: 0,
     sequenceNumber: 1,
     resultingSnapshotHash: snapshotHash.hash,
     encryptedResultingSnapshot: encSnapshot.ciphertext,
     encryptedResultingSnapshotIv: encSnapshot.iv,
     algorithm: "AES-GCM-256"
   }
   editBody = jsonStringify(editBodyObj)
  editPath = stringConcat({ parts: ["/api/documents/", docId, "/edits"] })
  editRes = signedPost(editPath.result, editBody.text, identity.id, identity.signingPrivateKey)

  return {
    documentId: docId,
    documentKey: docKey.key,
    status: editRes.status,
    body: editRes.body
  }
}
