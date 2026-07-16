import { hide, reveal } from "@stegcloak/core";

self.addEventListener("message", async (e: MessageEvent) => {
  const { id, type, payload } = e.data;
  try {
    if (type === "hide") {
      const result = await hide(payload);
      self.postMessage({ id, success: true, result });
    } else if (type === "reveal") {
      const result = await reveal(payload);
      self.postMessage({ id, success: true, result });
    }
  } catch (error: any) {
    self.postMessage({ id, success: false, error: error.message || error.toString() });
  }
});
