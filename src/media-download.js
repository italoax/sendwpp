const MAX_MEDIA_BYTES = 32 * 1024 * 1024;
const MEDIA_TIMEOUT_MS = 30_000;

export async function downloadBuffer(url, {
  maxBytes = MAX_MEDIA_BYTES,
  timeoutMs = MEDIA_TIMEOUT_MS,
} = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Limites de download inválidos.");
  }
  const source = new URL(url);
  if (!["http:", "https:", "data:"].includes(source.protocol)) {
    throw new Error("URL de mídia inválida. Use HTTP, HTTPS ou data URL.");
  }
  const tooLarge = () => new Error(`Mídia excede o limite de ${maxBytes} bytes.`);
  // Data URLs são decodificadas pelo fetch antes da leitura do corpo.
  if (source.protocol === "data:") {
    const separator = source.href.indexOf(",");
    const base64 = /;base64$/i.test(source.href.slice(0, separator));
    const encodedLimit = base64 ? Math.ceil(maxBytes / 3) * 4 : maxBytes * 3;
    if (source.href.length - separator - 1 > encodedLimit) throw tooLarge();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("Tempo limite ao baixar mídia."));
  }, timeoutMs);
  timeout.unref?.();
  try {
    const response = await fetch(source, { signal: controller.signal });
    if (!response.ok) throw new Error(`Falha ao baixar mídia: HTTP ${response.status}`);
    if (Number(response.headers.get("content-length")) > maxBytes) throw tooLarge();

    const chunks = [];
    let size = 0;
    for await (const chunk of response.body ?? []) {
      size += chunk.byteLength;
      if (size > maxBytes) throw tooLarge();
      chunks.push(chunk);
    }
    return {
      buffer: Buffer.concat(chunks, size),
      contentType: response.headers.get("content-type") || "",
    };
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
