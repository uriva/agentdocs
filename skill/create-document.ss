// create-document.ss
// Creates an encrypted document via POST /api/documents.
//
// Reads the agent's identity from secrets, generates a fresh AES key,
// encrypts the title and content, builds a self-access grant, signs the
// request, and sends it. Returns the new document ID and AES key so the
// caller can store both for future edits, shares, and links.
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

createDocument = (title: string, content: string): { status: number, body: string, documentKey: string } => {
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

  // Build JSON request body for POST /api/documents
  requestBody = jsonStringify({ value: {
    type: "doc",
    encryptedTitle: encTitle.ciphertext,
    encryptedTitleIv: encTitle.iv,
    algorithm: "AES-GCM-256",
    accessGrant: {
      encryptedSymmetricKey: grantEncrypted.ciphertext,
      iv: grantEncrypted.iv,
      salt: grantSalt.bytes,
      algorithm: "AES-GCM-256"
    }
  } })

  // Get timestamp for auth
  t = timestamp()
  tsStr = jsonStringify({ value: t.timestamp })

  // Build auth signature: METHOD\nPATH\nTIMESTAMP\nSHA256(BODY)
  reqPath = "/api/documents"
  bodyHash = sha256({ data: requestBody.text })
  authMessage = stringConcat({ parts: ["POST", "\n", reqPath, "\n", tsStr.text, "\n", bodyHash.hash] })
  authSig = ed25519Sign({ data: authMessage.result, privateKey: identityParsed.value.signingPrivateKey })

  // Create the document
  createResponse = httpRequest({
    host: "agentdocs-api.uriva.deno.net",
    method: "POST",
    path: reqPath,
    headers: {
      "content-type": "application/json",
      "x-identity-id": identityId.value,
      "x-timestamp": tsStr.text,
      "x-signature": authSig.signature
    },
    body: requestBody.text
  })

  // Parse the response to get the new document ID, then append the first edit
  parsedCreate = jsonParse({ text: createResponse.body })
  docId = parsedCreate.value.document.id

  // Build the initial-edit request body
  editBody = jsonStringify({ value: {
    encryptedContent: encContent.ciphertext,
    encryptedContentIv: encContent.iv,
    signature: contentSig.signature,
    sequenceNumber: 0,
    algorithm: "AES-GCM-256"
  } })

  // Sign the edit request
  editPath = stringConcat({ parts: ["/api/documents/", docId, "/edits"] })
  editTs = timestamp()
  editTsStr = jsonStringify({ value: editTs.timestamp })
  editBodyHash = sha256({ data: editBody.text })
  editAuthMessage = stringConcat({ parts: ["POST", "\n", editPath.result, "\n", editTsStr.text, "\n", editBodyHash.hash] })
  editAuthSig = ed25519Sign({ data: editAuthMessage.result, privateKey: identityParsed.value.signingPrivateKey })

  editResponse = httpRequest({
    host: "agentdocs-api.uriva.deno.net",
    method: "POST",
    path: editPath.result,
    headers: {
      "content-type": "application/json",
      "x-identity-id": identityId.value,
      "x-timestamp": editTsStr.text,
      "x-signature": editAuthSig.signature
    },
    body: editBody.text
  })

  return { status: editResponse.status, body: editResponse.body, documentKey: docKeyResult.key, documentId: docId }
}
