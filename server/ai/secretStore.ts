import { spawn } from "node:child_process";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname } from "node:path";

export interface SecretProtector {
  protect(secret: Buffer): Promise<Buffer>;
  unprotect(encrypted: Buffer): Promise<Buffer>;
}

const PROTECT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$data = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$protected = [System.Security.Cryptography.ProtectedData]::Protect(
  $data, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[Console]::Out.Write([Convert]::ToBase64String($protected))
`;

const UNPROTECT_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$data = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$plain = [System.Security.Cryptography.ProtectedData]::Unprotect(
  $data, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser
)
[Console]::Out.Write([Convert]::ToBase64String($plain))
`;

function encodedCommand(script: string): string {
  return Buffer.from(script, "utf16le").toString("base64");
}

function runDpapi(script: string, input: Buffer): Promise<Buffer> {
  if (process.platform !== "win32") {
    return Promise.reject(
      new Error("Secure Gemini key storage requires Windows DPAPI."),
    );
  }

  return new Promise((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        encodedCommand(script),
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    const stdout: Buffer[] = [];
    let outputBytes = 0;
    let failed = false;

    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 16_384) {
        failed = true;
        child.kill();
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.resume();
    child.on("error", () => {
      reject(new Error("Windows DPAPI could not be started."));
    });
    child.on("close", (code) => {
      if (failed || code !== 0) {
        reject(new Error("Windows DPAPI could not protect the local key."));
        return;
      }
      try {
        resolve(Buffer.from(Buffer.concat(stdout).toString("ascii"), "base64"));
      } catch {
        reject(new Error("Windows DPAPI returned an invalid result."));
      }
    });
    child.stdin.on("error", () => {
      failed = true;
    });
    child.stdin.end(input.toString("base64"));
  });
}

export class WindowsDpapiProtector implements SecretProtector {
  protect(secret: Buffer): Promise<Buffer> {
    return runDpapi(PROTECT_SCRIPT, secret);
  }

  unprotect(encrypted: Buffer): Promise<Buffer> {
    return runDpapi(UNPROTECT_SCRIPT, encrypted);
  }
}

export function resolveSecretFilePath(root: string): string {
  return `${root}/.study-hub/ai-provider-secret.bin`;
}

export class AiSecretStore {
  constructor(
    private readonly filePath: string,
    private readonly protector: SecretProtector = new WindowsDpapiProtector(),
  ) {}

  async hasSecret(): Promise<boolean> {
    try {
      await access(this.filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw new Error("The local AI key file could not be checked.");
    }
  }

  async save(secret: string): Promise<void> {
    const plain = Buffer.from(secret, "utf8");
    let encrypted: Buffer | undefined;
    const temporaryPath = `${this.filePath}.${randomBytes(8).toString("hex")}.tmp`;
    try {
      encrypted = await this.protector.protect(plain);
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(temporaryPath, encrypted, { flag: "wx" });
      await rename(temporaryPath, this.filePath);
    } catch {
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw new Error("The Gemini key could not be saved securely.");
    } finally {
      plain.fill(0);
      encrypted?.fill(0);
    }
  }

  async read(): Promise<string> {
    let encrypted: Buffer;
    try {
      encrypted = await readFile(this.filePath);
    } catch {
      throw new Error("The saved Gemini key is unavailable.");
    }

    let plain: Buffer | undefined;
    try {
      try {
        plain = await this.protector.unprotect(encrypted);
      } catch {
        throw new Error("The saved Gemini key could not be decrypted.");
      }
      const secret = plain.toString("utf8");
      if (secret.length < 20 || /\s/.test(secret)) {
        throw new Error("The saved Gemini key is invalid.");
      }
      return secret;
    } finally {
      encrypted.fill(0);
      plain?.fill(0);
    }
  }

  async remove(): Promise<void> {
    try {
      await rm(this.filePath, { force: true });
    } catch {
      throw new Error("The saved Gemini key could not be removed.");
    }
  }
}
