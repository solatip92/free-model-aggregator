import http from 'node:http';
import process from 'node:process';

const CATALOG = {
  models: [
    { id: 'free-gpt-3.5', provider: 'openai-sim', context_length: 16384 },
    { id: 'free-claude-3-haiku', provider: 'anthropic-sim', context_length: 32768 }
  ],
  providers: [
    { name: 'openai-sim', endpoint: process.env.MAKEFUN_ENV_URL || 'http://localhost:8080/v1' },
    { name: 'anthropic-sim', endpoint: process.env.MAKEFUN_ENV_URL || 'http://localhost:8080/v1' }
  ]
};

if (process.argv.includes('--list')) {
  console.log(JSON.stringify(CATALOG, null, 2));
  process.exit(0);
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && url.pathname === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: CATALOG.models.map(m => ({ id: m.id, object: 'model', owned_by: m.provider })) }));
    return;
  }

  if (req.method === 'POST' && (url.pathname === '/v1/chat/completions' || url.pathname === '/v1/messages')) {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      const payload = JSON.parse(body || '{}');
      const isAnthropic = url.pathname === '/v1/messages';
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (!isAnthropic) {
        res.end(JSON.stringify({
          id: 'chatcmpl-' + Date.now(),
          object: 'chat.completion',
          created: 1700000000,
          model: payload.model || 'free-gpt-3.5',
          choices: [{
            index: 0,
            message: { role: 'assistant', content: 'Aggregated response from best free provider.' },
            finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 12, completion_tokens: 18, total_tokens: 30 }
        }));
      } else {
        res.end(JSON.stringify({
          id: 'msg_' + Date.now(),
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Aggregated Anthropic response from best free provider.' }],
          model: payload.model || 'free-claude-3-haiku',
          stop_reason: 'end_turn',
          usage: { input_tokens: 12, output_tokens: 18 }
        }));
      }
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid JSON', type: 'invalid_request_error' } }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found', type: 'invalid_request_error' } }));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
