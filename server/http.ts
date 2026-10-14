/** An error with a message meant for the person who caused it. */
export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 503,
    message: string,
  ) {
    super(message)
  }
}
