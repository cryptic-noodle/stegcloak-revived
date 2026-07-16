import { ZstdCodec } from "zstd-codec";

let zstdSimpleInstance: any = null;
let initPromise: Promise<any> | null = null;

export const initZstd = (): Promise<any> => {
  if (zstdSimpleInstance) {
    return Promise.resolve(zstdSimpleInstance);
  }
  if (initPromise) {
    return initPromise;
  }
  initPromise = new Promise((resolve) => {
    ZstdCodec.run((zstd: any) => {
      zstdSimpleInstance = new zstd.Simple();
      resolve(zstdSimpleInstance);
    });
  });
  return initPromise;
};

export async function compress(data: string | Uint8Array): Promise<{ data: Uint8Array; wasCompressed: boolean }> {
  const zstd = await initZstd();
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  
  const compressed = zstd.compress(buf, 19);
  
  if (compressed.length >= buf.length) {
    return { data: buf, wasCompressed: false };
  }
  return { data: compressed, wasCompressed: true };
}

export async function decompress(data: Uint8Array, wasCompressed: boolean): Promise<Uint8Array> {
  if (!wasCompressed) {
    return data;
  }
  const zstd = await initZstd();
  const decompressed = zstd.decompress(data);
  return decompressed;
}
