// =============================================
// VLTV Play — server.js
// Backend Node.js com Gemini (Google AI)
// Chave da API fica segura no servidor.
// =============================================

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// Chave da API Gemini — vem da variável de ambiente do Render.com
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'SUA_CHAVE_AQUI';
const TMDB_API_KEY   = process.env.TMDB_API_KEY   || '9b73f5dd15b8165b1b57419be2f29128';
const PORT           = process.env.PORT || 3000;
const STATIC_DIR     = path.join(__dirname, 'public');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.ico':  'image/x-icon',
    '.svg':  'image/svg+xml',
    '.json': 'application/json',
    '.webp': 'image/webp',
};

// Instruções do assistente VLTV — ficam seguras no servidor
const SYSTEM_INSTRUCTION = `Você é o assistente virtual oficial da VLTV Play, um serviço de IPTV premium brasileiro.
Responda SEMPRE em português do Brasil, com tom simpático, objetivo e profissional.
Nunca se identifique como IA genérica ou mencione o Google ou Gemini — você é o Assistente VLTV.

== PLANOS E PREÇOS ==
- Plano Mensal:     R$ 40/mês    | 1 dispositivo simultâneo | HD, Full HD e 4K
- Plano Trimestral: R$ 110/3 meses | todos os benefícios | grade completa de canais
- Plano Semestral:  R$ 210/6 meses | Mais Vendido | servidores dedicados | EPG | suporte prioritário
- Plano Anual:      R$ 400/ano   | máxima economia | suporte 24h | acesso Ultra Premium
- Plano Vitalício:  R$ 569 (pagamento único) | sem mensalidades | suporte VIP permanente

== FORMAS DE PAGAMENTO ==
- PIX: ativação IMEDIATA e automática após confirmação (em minutos).
- Cartão de Crédito: ativação em até 1 hora após confirmação.
- Boleto Bancário: ativação após compensação bancária (até 2 dias úteis) OU imediata se o cliente enviar o comprovante pelo WhatsApp.

== DISPOSITIVOS SUPORTADOS ==
TV Smart, Celular (Android e iOS), TV Box, Fire Stick, Computador/Notebook, Roku TV.

== ATIVAÇÃO ==
As credenciais são enviadas pelo WhatsApp com tutorial passo a passo para o aparelho do cliente.
Teste grátis disponível: o cliente solicita pelo site.

== SUPORTE ==
WhatsApp direto com a equipe. Suporte prioritário nos planos Semestral e Anual. VIP no Vitalício.

== REGRAS ==
- Se não souber algo com certeza, oriente o cliente a entrar em contato pelo WhatsApp.
- Respostas curtas e diretas — máximo 3 parágrafos ou lista simples.
- Nunca invente informações sobre preços ou funcionalidades que não estejam listadas acima.`;

// ── Helpers ──
function sendJSON(res, status, obj) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(obj));
}

function serveStatic(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

// ── Chamada à API TMDB ──
function callTMDB(tmdbPath) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.themoviedb.org',
            path:     tmdbPath,
            method:   'GET',
            headers:  { 'Accept': 'application/json' },
        };
        const req = https.request(options, (apiRes) => {
            let raw = '';
            apiRes.on('data', chunk => raw += chunk);
            apiRes.on('end', () => {
                try { resolve(JSON.parse(raw)); }
                catch (e) { reject(new Error('Resposta inválida do TMDB')); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

// ── Chamada à API Gemini ──
function callGemini(history) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: history,
            generationConfig: {
                temperature:     0.7,
                maxOutputTokens: 800,
            }
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            path:     `/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            method:   'POST',
            headers: {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
        };

        const req = https.request(options, (apiRes) => {
            let raw = '';
            apiRes.on('data', chunk => raw += chunk);
            apiRes.on('end', () => {
                try {
                    const parsed = JSON.parse(raw);
                    resolve(parsed);
                } catch (e) {
                    reject(new Error('Resposta inválida da API Gemini'));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ── Servidor ──
const server = http.createServer(async (req, res) => {
    const parsed  = url.parse(req.url, true);
    const reqPath = parsed.pathname;

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin':  '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        });
        res.end();
        return;
    }

    // ── Rota /api/tmdb (proxy seguro para o TMDB) ──
    if (reqPath.startsWith('/api/tmdb') && req.method === 'GET') {
        const tmdbEndpoint = parsed.query.endpoint || '';
        if (!tmdbEndpoint) {
            return sendJSON(res, 400, { error: 'endpoint obrigatório' });
        }
        // Monta a URL completa do TMDB com a chave no servidor
        const separator = tmdbEndpoint.includes('?') ? '&' : '?';
        const fullPath  = `/3/${tmdbEndpoint}${separator}api_key=${TMDB_API_KEY}`;
        try {
            const data = await callTMDB(fullPath);
            sendJSON(res, 200, data);
        } catch (err) {
            console.error('[/api/tmdb] Erro:', err.message);
            sendJSON(res, 500, { error: 'Erro ao buscar dados do TMDB' });
        }
        return;
    }

    // ── Rota /api/chat (Gemini) ──
    if (reqPath === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { history } = JSON.parse(body);

                if (!Array.isArray(history) || history.length === 0) {
                    return sendJSON(res, 400, { error: 'history inválido' });
                }

                const geminiData = await callGemini(history);

                // Extrai o texto da resposta do Gemini
                const reply =
                    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
                    || 'Desculpe, não consegui processar sua pergunta agora. Fale conosco no WhatsApp!';

                sendJSON(res, 200, { reply });

            } catch (err) {
                console.error('[/api/chat] Erro:', err.message);
                sendJSON(res, 500, { error: 'Erro interno no servidor' });
            }
        });
        return;
    }

    // ── Arquivos estáticos da pasta /public ──
    let filePath = path.join(STATIC_DIR, reqPath === '/' ? 'index.html' : reqPath);

    // Segurança: bloqueia path traversal
    if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403); res.end('Proibido'); return;
    }

    serveStatic(res, filePath);
});

server.listen(PORT, () => {
    console.log(`✅  VLTV Play rodando em http://localhost:${PORT}`);
    console.log(`🔑  Gemini API Key: ${GEMINI_API_KEY === 'SUA_CHAVE_AQUI' ? '⚠️  NÃO CONFIGURADA' : 'OK ✓'}`);
});
