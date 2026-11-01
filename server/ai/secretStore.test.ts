// @vitest-environment node
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  AiSecretStore,
  WindowsDpapiProtector,
  type SecretProtector,
} from "./secretStore";

const directories: string[] = [];

function protector(): SecretProtector {
  return {
    async protect(secret) {
      return Buffer.from(`protected:${secret.toString("base64")}`);
    },
    async unprotect(encrypted) {
      const encoded = encrypted.toString("utf8").replace(/^protected:/, "");
      return Buffer.from(encoded, "base64");
    },
  };
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("server-only key storage", () => {
  it("writes only protected bytes and reads the key through the protector", async () => {
    const directory = await mkdtemp(join(tmpdir(), "studyhub-secret-"));
    directories.push(directory);
    const path = join(directory, ".study-hub", "provider-key.bin");
    const store = new AiSecretStore(path, protector());
    const key = "test-gemini-secret-key-value-123456";

    expect(await store.hasSecret()).toBe(false);
    await store.save(key);

    const stored = await readFile(path);
    expect(stored.toString("utf8")).not.toContain(key);
    expect(await store.hasSecret()).toBe(true);
    expect(await store.read()).toBe(key);

    const replacement = "replacement-test-gemini-key-value-789012";
    await store.save(replacement);
    expect(await store.read()).toBe(replacement);
    expect((await readFile(path)).toString("utf8")).not.toContain(replacement);

    await store.remove();
    expect(await store.hasSecret()).toBe(false);
  });

  it("fails closed when the encrypted value cannot be decrypted", async () => {
    const directory = await mkdtemp(join(tmpdir(), "studyhub-secret-invalid-"));
    directories.push(directory);
    const path = join(directory, "provider-key.bin");
    const store = new AiSecretStore(path, {
      protect: async () => Buffer.from("encrypted"),
      unprotect: async () => {
        throw new Error("unavailable");
      },
    });

    await store.save("test-gemini-secret-key-value-123456");
    await expect(store.read()).rejects.toThrow("saved Gemini key could not be decrypted");
  });

  it.skipIf(process.platform !== "win32")(
    "round-trips a dummy secret through the current Windows user's DPAPI",
    async () => {
      const directory = await mkdtemp(join(tmpdir(), "studyhub-dpapi-"));
      directories.push(directory);
      const store = new AiSecretStore(
        join(directory, "provider-key.bin"),
        new WindowsDpapiProtector(),
      );
      const dummy = "test-dpapi-only-secret-value-123456";

      await store.save(dummy);

      const encrypted = await readFile(join(directory, "provider-key.bin"));
      expect(encrypted.toString("utf8")).not.toContain(dummy);
      expect(await store.read()).toBe(dummy);
      await store.remove();
    },
  );
});
