// Mock httpRequest — all calls return the document response.
mockHttpRequest = (host: string, method: string, path: string, headers: { x_timestamp: string }, body: string): { status: number, body: string } => {
  return { status: 201, body: "{\"document\":{\"id\":\"mock-doc-id\"}}" }
}

// Override httpRequest in createDocument (both in scope via concatenation).
testCreateDocument = (id: string): { documentId: string, documentKey: string, status: number } => {
  return override(createDocument, { httpRequest: mockHttpRequest })({ title: "Test", content: "Content", agentdocsIdentity: id })
}
