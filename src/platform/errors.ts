export class PlatformError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ForbiddenError extends PlatformError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class ValidationError extends PlatformError {
  constructor(message = "Invalid input") {
    super(422, message);
  }
}

export class ConflictError extends PlatformError {
  constructor(message = "This record changed. Reload and try again.") {
    super(409, message);
  }
}
