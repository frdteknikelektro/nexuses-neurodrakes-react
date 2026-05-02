import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

function dmMiddlewarePlugin(): Plugin {
  return {
    name: 'dm-middleware',
    configureServer(server) {
      server.middlewares.use('/api/dm', async (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const env = loadEnv(server.config.mode, process.cwd(), '')
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(chunk as Buffer);
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const { message, gameState } = body;

          if (!message || !gameState) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing message or gameState' }));
            return;
          }

          // Dynamic import so Vite resolves the TS source at dev time
          const { runDMEngine, runParleyEngine } = await import('./src/engine/dmHandler');
          const apiMode = env.OPENAI_API_MODE === 'chat'
            ? 'chat' as const
            : env.OPENAI_API_MODE === 'responses'
              ? 'responses' as const
              : undefined;
          const config = {
            apiKey: env.OPENAI_API_KEY ?? '',
            baseUrl: env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
            model: env.OPENAI_MODEL ?? 'hermes-agent',
            timeoutMs: Number(env.OPENAI_TIMEOUT_MS ?? 30000),
            apiMode,
          };
          const result = gameState.mode === 'parley'
            ? await runParleyEngine(message, gameState, config)
            : await runDMEngine(message, gameState, config);

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }

        void next;
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), dmMiddlewarePlugin()],
  server: {
    proxy: {
      '/v1': 'http://localhost:8642',
    },
  },
})
