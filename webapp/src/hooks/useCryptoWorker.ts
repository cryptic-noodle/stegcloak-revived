import { useEffect, useRef } from "react";

let globalWorker: Worker | null = null;
let nextId = 0;
const resolvers = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker() {
  if (!globalWorker) {
    globalWorker = new Worker(new URL("../workers/crypto.worker.ts", import.meta.url), {
      type: "module",
    });
    globalWorker.addEventListener("message", (e: MessageEvent) => {
      const { id, success, result, error } = e.data;
      const resolver = resolvers.get(id);
      if (resolver) {
        resolvers.delete(id);
        if (success) {
          resolver.resolve(result);
        } else {
          resolver.reject(new Error(error));
        }
      }
    });
  }
  return globalWorker;
}

export function useCryptoWorker() {
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = getWorker();
  }, []);

  const runCrypto = (type: "hide" | "reveal", payload: any): Promise<string> => {
    return new Promise((resolve, reject) => {
      const worker = workerRef.current || getWorker();
      const id = nextId++;
      resolvers.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
    });
  };

  const cloak = (secret: string, cover: string, password?: string) => {
    return runCrypto("hide", { secret, cover, password });
  };

  const decloak = (text: string, password?: string) => {
    return runCrypto("reveal", { text, password });
  };

  return { cloak, decloak };
}
