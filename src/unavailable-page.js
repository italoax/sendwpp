export const unavailablePage = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Não foi possível conectar</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #fff;
      color: #202124;
      font: 15px/1.6 Arial, sans-serif;
    }
    main { width: min(600px, 100%); margin: 18vh auto 0; padding: 24px; }
    svg { display: block; width: 48px; height: 56px; margin-bottom: 28px; color: #9aa0a6; }
    h1 { margin: 0 0 16px; font-size: 24px; font-weight: 500; line-height: 1.3; }
    p { margin: 0 0 12px; color: #5f6368; }
    a {
      display: inline-block; margin-top: 24px; padding: 8px 20px;
      border-radius: 4px; background: #1a73e8; color: #fff;
      font-size: 14px; font-weight: 600; text-decoration: none;
    }
    a:hover { background: #1765cc; }
    a:focus-visible { outline: 3px solid #8ab4f8; outline-offset: 3px; }
    @media (prefers-color-scheme: dark) {
      body { background: #202124; color: #e8eaed; }
      p { color: #9aa0a6; }
      a { background: #8ab4f8; color: #202124; }
      a:hover { background: #aecbfa; }
    }
    @media (max-width: 480px) { main { margin-top: 10vh; } }
  </style>
</head>
<body>
  <main>
    <svg viewBox="0 0 48 56" fill="none" aria-hidden="true">
      <path d="M8 2h21l11 11v40H8z" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <path d="M29 2v12h11" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
      <path d="m16 26 5 5m0-5-5 5m12-5 5 5m0-5-5 5m-16 13c3-6 11-6 14 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
    <h1>Não foi possível conectar</h1>
    <p>Este site está indisponível no momento.</p>
    <p>Tente novamente mais tarde.</p>
    <a href="">Tentar novamente</a>
  </main>
</body>
</html>`;
