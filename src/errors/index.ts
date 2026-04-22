export class CliError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly exitCode: number = 1
  ) {
    super(message);
    this.name = "CliError";
  }
}

export class SignatureError extends CliError {
  constructor() {
    super("Pack signature verification failed — bundle may be tampered.", "SIGNATURE_INVALID", 1);
  }
}
