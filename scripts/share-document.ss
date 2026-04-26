// share-document.ss
// Grants a second identity access to an existing document by wrapping the
// document's AES key for their X25519 public key and POSTing a new access
// grant. The document ciphertext is untouched — only the key is re-wrapped.
//
// The caller must hold documentKey (the document's AES key), obtained
// either from create-document.ss or by decrypting their own access grant.
//
// Fetches the recipient's public keys from GET /api/identities/:id.
//
// Secrets required:
//   agentdocs-identity
//
// Permission surface:
//   secrets read: agentdocs-identity
//   hosts: agentdocs-api.uriva.deno.net
//   env: timestamp, randomBytes

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

shareDocument = (
  documentId: string,
  documentKey: string,
  granteeIdentityId: string
): { status: number, body: string } => {
  identity = loadIdentity()

  // Fetch the grantee's public keys.
  idPath = stringConcat({ parts: ["/api/identities/", granteeIdentityId] })
  identityRes = signedGet(idPath.result, identity.id, identity.signingPrivateKey)
  identityParsed = jsonParse({ text: identityRes.body })
  granteeEncPub = identityParsed.value.identity.encryptionPublicKey

  // Wrap the docKey for the grantee + POST the new grant.
  grant = buildGrant(documentKey, identity.encryptionPrivateKey, granteeEncPub)
  body = jsonStringify({
    granteeIdentityId: granteeIdentityId,
    encryptedSymmetricKey: grant.encryptedSymmetricKey,
    iv: grant.iv,
    salt: grant.salt,
    algorithm: grant.algorithm
  })
  sharePath = stringConcat({ parts: ["/api/documents/", documentId, "/share"] })
  return signedPost(sharePath.result, body.text, identity.id, identity.signingPrivateKey)
}
