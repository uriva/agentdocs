// upsert-document.ss
// Upserts an encrypted document to agentdocs via PUT /api/documents/by-slug/:slug
//
// Reads the agent's identity from secrets, generates a fresh AES key,
// encrypts the title and content, builds a self-access grant, signs the
// request, and sends it. Returns the document AES key so the caller can
// store it for future updates.
//
// Secrets required:
//   agentdocs-identity    -- base64url-encoded JSON with keys:
//                            signingPrivateKey, signingPublicKey,
//                            encryptionPrivateKey, encryptionPublicKey
//   agentdocs-identity-id -- identity UUID on the server
//
// Permission surface (static analysis):
//   secrets read: agentdocs-identity, agentdocs-identity-id
//   hosts: agentdocs-api.uriva.deno.net
//   env: timestamp, randomBytes

upsertDocument = (slug: string, title: string, content: string): { status: number, body: string, documentKey: string } => {
  // Load identity (base64url JSON blob with all 4 keys)
  identityBlob = readSecret({ name: "agentdocs-identity" })
  identityId = readSecret({ name: "agentdocs-identity-id" })
  identityJson = base64urlDecode({ encoded: identityBlob.value })
  identityParsed = jsonParse({ text: identityJson.text })

  // Generate document AES key
  docKeyResult = aesGenerateKey()

  // Encrypt title and content
  encTitle = aesEncrypt({ plaintext: title, key: docKeyResult.key })
  encContent = aesEncrypt({ plaintext: content, key: docKeyResult.key })

  // Sign the plaintext content for tamper detection
  contentSig = ed25519Sign({ data: content, privateKey: identityParsed.value.signingPrivateKey })

  // Build self-access grant: encrypt the doc key to our own encryption public key
  grantSalt = randomBytes({ length: 16 })
  grantDerived = x25519DeriveKey({ myPrivateKey: identityParsed.value.encryptionPrivateKey, theirPublicKey: identityParsed.value.encryptionPublicKey, salt: grantSalt.bytes, info: "agentdocs-access-grant" })
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
  bodyHash = sha256({ data: requestBody.text })
  authMessage = stringConcat({ parts: ["PUT", "\n", reqPath.result, "\n", tsStr.text, "\n", bodyHash.hash] })
  authSig = ed25519Sign({ data: authMessage.result, privateKey: identityParsed.value.signingPrivateKey })

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
