import { timingSafeEqual } from "node:crypto";
import { unavailablePage } from "./unavailable-page.js";

export function requireToken(expectedToken, { environment = process.env.NODE_ENV } = {}) {
  expectedToken = String(expectedToken ?? "").trim();
  if (!expectedToken && environment === "production") {
    throw new Error("Configure API_TOKEN antes de iniciar a API em produção.");
  }
  if (!expectedToken) {
    console.warn("[whatsapp-api] API_TOKEN vazio — autenticação desativada (USE SÓ EM DEV).");
  }
  return function tokenMiddleware(req, res, next) {
    if (!expectedToken) return next();

    const headerToken = req.headers?.token;
    const authorization = req.headers?.authorization ?? "";
    const bearerToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    const receivedToken = String(headerToken || bearerToken || "");

    // Comparação timing-safe — evita revelar o token por diferenças de tempo
    // em ataques de força bruta. Buffers de tamanhos diferentes nunca batem.
    const a = Buffer.from(receivedToken);
    const b = Buffer.from(expectedToken);
    if (a.length === b.length && timingSafeEqual(a, b)) return next();

    // Acesso sem autenticação recebe uma página genérica de indisponibilidade.
    res.status(404)
      .set("Content-Type", "text/html; charset=utf-8")
      .set("Cache-Control", "no-store")
      .send(unavailablePage);
  };
}
