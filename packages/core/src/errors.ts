export class DiffdiffError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiffdiffError";
  }
}

export class CommandError extends DiffdiffError {
  constructor(
    message: string,
    readonly command: string,
    readonly stderr: string,
    readonly exitCode?: number,
  ) {
    super(message);
    this.name = "CommandError";
  }
}
