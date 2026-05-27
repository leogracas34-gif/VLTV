// =============================================
// VLTV Play — server.js
// Backend Node.js com Gemini (Google AI)
// Proxy TMDB integrado — chaves ficam seguras no servidor.
// =============================================

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

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

const SYSTEM_INSTRUCTION = `Você é o assistente virtual oficial da VLTV Play, um serviço de IPTV premium brasileiro.
Responda SEMPRE em português do Brasil, com tom simpático, objetivo e profissional.
Nunca se identifique como IA genérica ou mencione o Google ou Gemini — você é o Assistente VLTV.

ATENÇÃO: Você deve responder de fato às perguntas dos clientes usando a nossa base de dados abaixo. NÃO envie mensagens mandando chamar no WhatsApp logo na primeira mensagem a menos que o cliente explicitamente queira fechar uma assinatura de plano, pedir ativação do teste grátis ou precise de suporte avançado que não esteja detalhado aqui.

== PLANOS E PREÇOS ==
- Plano Mensal:     R$ 40/mês    | 1 dispositivo simultâneo | HD, Full HD e 4K
- Plano Trimestral: R$ 110/3 meses | todos os benefícios | grade completa de canais
- Plano Semestral:  R$ 210/6 meses | Mais Vendido | servidores dedicados | EPG | suporte prioritário
- Plano Anual:      R$ 400/ano   | máxima economia | suporte 24h | acesso Ultra Premium
- Plano Vitalício:  R$ 569 (pagamento único) | sem mensalidades | suporte VIP permanente

== TESTE GRATUITO ==
- Duração do teste: 3 horas de acesso completo.
- Para solicitar, basta clicar em "Solicitar Teste Grátis" no site ou falar pelo WhatsApp.
- O teste é liberado imediatamente pela equipe.

== FIDELIDADE E CANCELAMENTO ==
- NÃO há fidelidade em nenhum plano.
- O cliente pode cancelar quando quiser, sem multa ou burocracia.

== INTERNET ==
- Sim, é necessário ter conexão com a internet para usar o IPTV.
- Recomendamos pelo menos 10 Mbps para HD e 25 Mbps para 4K.

== DISPOSITIVOS COMPATÍVEIS ==
- Sim, pode instalar no Celular (Android e iOS).
- Sim, pode instalar em TV Smart.
- Sim, pode instalar em Notebook / Computador.
- Sim, pode instalar em Fire Stick / TV Box.
- Sim, pode instalar em Roku TV.
- Você pode instalar em quantos aparelhos desejar; o acesso simultâneo depende da quantidade de telas do plano.

== FORMAS DE PAGAMENTO ==
- PIX: ativação IMEDIATA e automática após confirmação (em minutos).
- Cartão de Crédito: ativação em até 1 hora após confirmação.
- Boleto Bancário: ativação após compensação bancária (até 2 dias úteis) OU imediata se o cliente enviar o comprovante pelo WhatsApp.

== ATIVAÇÃO ==
As credenciais são enviadas pelo WhatsApp com tutorial passo a passo para o aparelho do cliente.

== SUPORTE ==
WhatsApp direto com a equipe. Suporte prioritário nos planos Semestral e Anual. VIP no Vitalício.

== REGRAS ==
- Trate o usuário com respeito.
- Se a dúvida não estiver descrita aqui, instrua cordialmente o cliente a abrir um chamado com os atendentes humanos no WhatsApp.`;

function serveStatic(res, filePath) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            return res.end(err.code === 'ENOENT' ? '404 Não Encontrado' : '500 Erro Servidor');
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'text/plain' });
        res.end(data);
    });
}

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function callGemini(history) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({
            system_instruction: { parts: { text: SYSTEM_INSTRUCTION } },
            contents: history,
            generationConfig: { temperature: 0.5, maxOutputTokens: 250 }
        });

        const req = https.request({
            hostname: 'generativelanguage.googleapis.com',
            path: '/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const reqPath = parsedUrl.pathname;

    // ── Proxy TMDB ──
    if (reqPath === '/api/tmdb') {
        const endpoint = parsedUrl.query.endpoint;
        if (!endpoint) return sendJSON(res, 400, { error: 'endpoint ausente' });
        
        const tmdbUrl = `https://api.themoviedb.org/3${endpoint}&api_key=${TMDB_API_KEY}`;
        https.get(tmdbUrl, tmdbRes => {
            let data = '';
            tmdbRes.on('data', chunk => data += chunk);
            tmdbRes.on('end', () => {
                res.writeHead(tmdbRes.statusCode, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        }).on('error', err => {
            sendJSON(res, 500, { error: 'Erro no proxy TMDB' });
        });
        return;
    }

    // ── Endpoint específico do app para próximos lançamentos ──
    if (reqPath === '/api/upcoming') {
        const tmdbUrl = `https://api.themoviedb.org/3/movie/upcoming?language=pt-BR&page=1&api_key=${TMDB_API_KEY}`;
        https.get(tmdbUrl, tmdbRes => {
            let data = '';
            tmdbRes.on('data', chunk => data += chunk);
            tmdbRes.on('end', () => {
                res.writeHead(tmdbRes.statusCode, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        }).on('error', err => {
            sendJSON(res, 500, { error: 'Erro no proxy TMDB' });
        });
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
    if (!filePath.startsWith(STATIC_DIR)) {
        res.writeHead(403); res.end('Proibido'); return;
    }
    serveStatic(res, filePath);
});

server.listen(PORT, () => {
    console.log(`✅ VLTV Play rodando em http://localhost:${PORT}`);
});
