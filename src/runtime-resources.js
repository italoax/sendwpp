import dotenv from "dotenv";

// Importado antes das dependências: elas podem criar pools ao carregar.
// Também garante que o logger do Baileys veja o LOG_LEVEL do arquivo .env.
dotenv.config({ quiet: true });
for (const [key, fallback] of Object.entries({
  UV_THREADPOOL_SIZE: "2",
  RAYON_NUM_THREADS: "1",
  VIPS_CONCURRENCY: "1",
})) {
  if (!process.env[key]) process.env[key] = fallback;
}
