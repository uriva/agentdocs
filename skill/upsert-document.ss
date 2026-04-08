// upsert-document.ss
// Upserts an encrypted document to agentdocs via PUT /api/documents/by-slug/:slug
//
// Reads the agent's identity from secrets, generates a fresh AES key,
// encrypts the title and content, builds a self-access grant, signs the
// request, and sends it. Returns the document AES key so the caller can
// store it for future updates.
//
// Secrets required:
//   agentdocs-identity    -- exported identity blob (base64url)
//   agentdocs-identity-id -- identity UUID on the server
//
// Permission surface (static analysis):
//   secrets read: agentdocs-identity, agentdocs-identity-id
//   hosts: agentdocs-api.uriva.deno.net
//   env: timestamp, randomBytes

upsertDocument = (slug: string, title: string, content: string): { status: number, body: string, documentKey: string } => {
  // Load identity
  identityBlob = readSecret("agentdocs-identity")
  identityId = readSecret("agentdocs-identity-id")
  identity = importIdentity({ exportedIdentity: identityBlob.value })

  // Generate document AES key
  docKeyResult = aesGenerateKey()

  // Encrypt title and content
  encTitle = aesEncrypt({ plaintext: title, key: docKeyResult.key })
  encContent = aesEncrypt({ plaintext: content, key: docKeyResult.key })

  // Sign the plaintext content for tamper detection
  contentSig = ed25519Sign({ data: content, privateKey: identity.signingPrivateKey })

  // Build self-access grant: encrypt the doc key to our own encryption public key
  grantSalt = randomBytes(16)
  grantDerived = x25519DeriveKey({ myPrivateKey: identity.encryptionPrivateKey, theirPublicKey: identity.encryptionPublicKey, salt: grantSalt.bytes })
  grantEncrypted = aesEncrypt({ plaintext: docKeyResult.key, key: grantDerived.derivedKey })

  // Build JSON request body
  requestBody = jsonStringify({ value: {
    encryptedTitle: encTitle.ciphertext,
    encryptedTitleIv: encTitle.iv,
    algorithm: "AES-GCM-256",
    accessGrant: {
      encryptedSymmetricKey: grantEncrypted.ciphertext,
      iv: grantEncrypted.iv,
      salt: grantSalt.bytes,
      algorithm: "AES-GCM-256"
    },
    encryptedContent: encContent.ciphertext,
    encryptedContentIv: encContent.iv,
    signature: contentSig.signature
  } })

  // Get timestamp for auth
  t = timestamp()
  tsStr = jsonStringify({ value: t.timestamp })

  // Build auth signature: METHOD\nPATH\nTIMESTAMP\nSHA256(BODY)
  reqPath = stringConcat({ parts: ["/api/documents/by-slug/", slug] })
  bodyHash = sha256(requestBody.text)
  authMessage = stringConcat({ parts: ["PUT", "\n", reqPath.result, "\n", tsStr.text, "\n", bodyHash.hash] })
  authSig = ed25519Sign({ data: authMessage.result, privateKey: identity.signingPrivateKey })

  // Make the API call
  response = httpRequest({
    host: "agentdocs-api.uriva.deno.net",
    method: "PUT",
    path: reqPath.result,
    headers: {
      "content-type": "application/json",
      "x-identity-id": identityId.value,
      "x-timestamp": tsStr.text,
      "x-signature": authSig.signature
    },
    body: requestBody.text
  })

  return { status: response.status, body: response.body, documentKey: docKeyResult.key }
}
