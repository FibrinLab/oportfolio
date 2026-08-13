import net from "node:net";
import type { Readable } from "node:stream";

// Minimal clamd INSTREAM client (spec plan: hand-rolled, ~50 lines).
// Protocol: send "zINSTREAM\0", then length-prefixed chunks (4-byte BE),
// terminated by a zero-length chunk; clamd replies "stream: OK" or
// "stream: <signature> FOUND".

export interface ScanResult {
  status: "clean" | "infected" | "error";
  signature?: string;
  engineVersion?: string;
  error?: string;
}

const CHUNK_SIZE = 64 * 1024;

function connect(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(
      {
        host: process.env.CLAMD_HOST ?? "localhost",
        port: Number(process.env.CLAMD_PORT ?? 3310),
      },
      () => resolve(socket),
    );
    socket.once("error", reject);
    socket.setTimeout(120_000, () => {
      socket.destroy(new Error("clamd timeout"));
    });
  });
}

export async function clamdVersion(): Promise<string | null> {
  try {
    const socket = await connect();
    socket.write("zVERSION\0");
    const response = await readAll(socket);
    return response.trim().replace(/\0/g, "") || null;
  } catch {
    return null;
  }
}

export async function scanStream(stream: Readable): Promise<ScanResult> {
  let socket: net.Socket;
  try {
    socket = await connect();
  } catch (error) {
    return { status: "error", error: (error as Error).message };
  }

  try {
    socket.write("zINSTREAM\0");

    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      for (let offset = 0; offset < buffer.length; offset += CHUNK_SIZE) {
        const slice = buffer.subarray(offset, offset + CHUNK_SIZE);
        const size = Buffer.alloc(4);
        size.writeUInt32BE(slice.length, 0);
        socket.write(size);
        socket.write(slice);
      }
    }
    const terminator = Buffer.alloc(4);
    terminator.writeUInt32BE(0, 0);
    socket.write(terminator);

    const response = (await readAll(socket)).replace(/\0/g, "").trim();
    if (/\bOK$/.test(response)) return { status: "clean" };
    const found = /stream: (.+) FOUND/.exec(response);
    if (found) return { status: "infected", signature: found[1] };
    return { status: "error", error: `unexpected clamd response: ${response.slice(0, 200)}` };
  } catch (error) {
    return { status: "error", error: (error as Error).message };
  } finally {
    socket.destroy();
  }
}

function readAll(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    socket.on("data", (data: Buffer) => {
      chunks.push(data);
      // clamd terminates replies with \0 in z-mode.
      if (data.includes(0)) {
        resolve(Buffer.concat(chunks).toString("utf8"));
        socket.end();
      }
    });
    socket.once("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.once("error", reject);
  });
}
