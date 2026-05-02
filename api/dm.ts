import { runDMEngine, runParleyEngine } from '../src/engine/dmHandler';
import type { ClientGameState, ParleyClientGameState } from '../src/engine/dmHandler';

type Req = { method: string; body: { message: string; gameState: ClientGameState | ParleyClientGameState } };
type Res = { status(code: number): Res; json(body: unknown): void; setHeader(k: string, v: string): void };

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).json({});
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { message, gameState } = req.body;
  if (!message || !gameState) {
    res.status(400).json({ error: 'Missing message or gameState' });
    return;
  }

  try {
    const config = {
      apiKey: process.env.OPENAI_API_KEY ?? '',
      baseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL ?? 'hermes-agent',
      timeoutMs: Number(process.env.OPENAI_TIMEOUT_MS ?? 30000),
      apiMode: process.env.OPENAI_API_MODE === 'chat' ? 'chat' as const : process.env.OPENAI_API_MODE === 'responses' ? 'responses' as const : undefined,
    };
    const result = 'mode' in gameState && gameState.mode === 'parley'
      ? await runParleyEngine(message, gameState, config)
      : await runDMEngine(message, gameState, config);
    res.status(200).json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
