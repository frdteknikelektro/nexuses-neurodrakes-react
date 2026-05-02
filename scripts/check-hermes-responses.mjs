import { existsSync, readFileSync } from 'node:fs';

function loadEnv() {
  const env = { ...process.env };
  if (!existsSync('.env')) return env;
  for (const line of readFileSync('.env', 'utf8').split(/\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const baseUrl = (env.OPENAI_BASE_URL || 'http://localhost:8642/v1').replace(/\/$/, '');
  const model = env.OPENAI_MODEL || 'hermes-agent';
  const apiKey = env.OPENAI_API_KEY || '';
  const started = Date.now();

  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      input: [
        { role: 'system', content: 'Reply with exactly pong.' },
        { role: 'user', content: 'ping' },
      ],
      max_output_tokens: 32,
    }),
  });

  const body = await response.text();
  console.log(JSON.stringify({
    url: `${baseUrl}/responses`,
    model,
    hasApiKey: Boolean(apiKey),
    status: response.status,
    ok: response.ok,
    durationMs: Date.now() - started,
    sample: body.slice(0, 1200),
  }, null, 2));

  if (!response.ok) process.exitCode = 1;
}

main().catch(error => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
});
