// Mock httpRequest — all calls return the document response.
// For a single-response mock this is enough to verify override propagation.
mockHttpRequest = (host: string, method: string, path: string, headers: { x_timestamp: string }, body: string): { status: number, body: string } => {
  return { status: 201, body: "{\"document\":{\"id\":\"mock-doc-id\"}}" }
}

testCreateDocument = (id: string): { documentId: string, documentKey: string, status: number } => {
  return override(createDocument, { httpRequest: mockHttpRequest })("Test", "Content", id)
}
