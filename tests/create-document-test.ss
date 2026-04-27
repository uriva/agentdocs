import { createDocument } from "../scripts/create-document.ss"

mockHttpRequest = (host: string, method: string, path: string, headers: { x_timestamp: string }, body: string): { status: number, body: string } => {
  return { status: 201, body: "{\"document\":{\"id\":\"mock-doc-id\"}}" }
}

testCreateDocument = (id: string): { documentId: string, documentKey: string, status: number } => {
  return override(createDocument, { httpRequest: mockHttpRequest })("Test", "Content", id)
}
