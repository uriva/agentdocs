// delete-document.ss
// Deletes a single document by id.
// Returns { success: boolean, deleted: number }.
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

signedDelete = (
  path: string,
  identityId: string,
  signingPrivateKey: string
): { status: number, body: string } => {
  t = timestamp()
  tsStr = jsonStringify({ value: t.timestamp })
  sig = buildAuthSignature("DELETE", path, tsStr.text, "", signingPrivateKey)
  return httpRequest({
    host: "agentdocs-api.uriva.deno.net",
    method: "DELETE",
    path: path,
    headers: {
      "x-identity-id": identityId,
      "x-timestamp": tsStr.text,
      "x-signature": sig.signature
    }
  })
}

deleteDocument = (documentId: string, agentdocsIdentity: string): {
  success: boolean,
  deleted: number
} => {
  identity = loadIdentity(agentdocsIdentity)

  docPath = stringConcat({ parts: ["/api/documents/", documentId] })
  docRes = signedDelete(docPath.result, identity.id, identity.signingPrivateKey)
  docParsed = jsonParse({ text: docRes.body })
  data = docParsed.value

  return {
    success: data.success,
    deleted: data.deleted
  }
}
