// =============================================
// VLTV Play — script.js
// =============================================

const WHATSAPP = '5531998491711';
let currentPlan = 'Geral';

const GENRES_MOVIE = {
    28:'Ação',12:'Aventura',16:'Animação',35:'Comédia',80:'Crime',
    99:'Documentário',18:'Drama',10751:'Família',14:'Fantasia',36:'História',
    27:'Terror',10402:'Música',9648:'Mistério',10749:'Romance',
    878:'Ficção Científica',53:'Thriller',10752:'Guerra',37:'Faroeste'
};
const GENRES_TV = {
    10759:'Ação & Aventura',16:'Animação',35:'Comédia',80:'Crime',
    99:'Documentário',18:'Drama',10751:'Família',10762:'Kids',9648:'Mistério',
    10765:'Sci-Fi',10766:'Novela',10768:'Guerra',37:'Faroeste'
};

// ══════════════════════════════════════════════
// DESTAQUES DA SEMANA
// ── Para trocar os destaques, edite apenas os
//    campos "titulo" e "tipo" abaixo.
// ══════════════════════════════════════════════
var DESTAQUES = [
    {
        titulo: 'Muti - Crime e Poder',   // Nome exato do filme/série em português ou inglês
        tipo: 'filme'                  // 'filme' ou 'serie'
    },
    {
        titulo: 'Origem',      // Nome exato do filme/série em português ou inglês
        tipo: 'serie'                  // 'filme' ou 'serie'
    }
];

// ── TMDB via proxy backend (com fallback direto) ──
var TMDB_KEY_FALLBACK = '9b73f5dd15b8165b1b57419be2f29128';
async function tmdb(endpoint) {
    try {
        var r = await fetch('/api/tmdb?endpoint=' + encodeURIComponent(endpoint));
        if (r.ok) return r.json();
    } catch(e) { /* servidor offline, usa fallback */ }
    var sep = endpoint.indexOf('?') > -1 ? '&' : '?';
    var r2 = await fetch('https://api.themoviedb.org/3/' + endpoint + sep + 'api_key=' + TMDB_KEY_FALLBACK);
    if (!r2.ok) throw new Error('TMDB ' + r2.status);
    return r2.json();
}

// ── Escape HTML ──
function escapeHtml(str) {
    return String(str)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Formatar data DD/MM/YYYY ──
function formatDate(dateStr) {
    if (!dateStr) return 'Em breve';
    var p = dateStr.split('-');
    return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : dateStr;
}

// ── Header scroll ──
window.addEventListener('scroll', function() {
    var h = document.getElementById('siteHeader');
    if (h) h.classList.toggle('scrolled', window.scrollY > 50);
});

// ── Mobile nav ──
function toggleMobileNav() {
    var nav = document.getElementById('mobileNav');
    if (nav) nav.classList.toggle('open');
}

// ══════════════════════════════════════════════
// CARROSSEL
// ══════════════════════════════════════════════
function buildCarousel(trackEl, viewEl, prevEl, nextEl) {
    var CARD_W = 160 + 14;
    var pos = 0, dragging = false, startX = 0, startPos = 0;

    function clamp(v) {
        return Math.max(0, Math.min(v, Math.max(0, trackEl.scrollWidth - viewEl.clientWidth)));
    }
    function move(p, animate) {
        if (animate === undefined) animate = true;
        pos = clamp(p);
        var tr = animate ? 'transform .4s ease' : 'none';
        trackEl.style.transition = tr;
        trackEl.style.transform = 'translateX(-' + pos + 'px)';
    }

    if (prevEl) prevEl.addEventListener('click', function() { move(pos - CARD_W * 2); });
    if (nextEl) nextEl.addEventListener('click', function() { move(pos + CARD_W * 2); });

    trackEl.addEventListener('mousedown', function(e) {
        dragging = true; startX = e.clientX; startPos = pos;
        trackEl.style.transition = 'none';
    });
    window.addEventListener('mousemove', function(e) {
        if (dragging) move(startPos - (e.clientX - startX), false);
    });
    window.addEventListener('mouseup', function() {
        if (dragging) { dragging = false; trackEl.style.transition = 'transform .4s ease'; }
    });
    trackEl.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX; startPos = pos;
        trackEl.style.transition = 'none';
    }, { passive: true });
    trackEl.addEventListener('touchmove', function(e) {
        move(startPos - (e.touches[0].clientX - startX), false);
    }, { passive: true });
    trackEl.addEventListener('touchend', function() {
        trackEl.style.transition = 'transform .4s ease';
    });
}

// ══════════════════════════════════════════════
// CARD DE MÍDIA (carrosséis)
// ══════════════════════════════════════════════
function createCard(item, isTV) {
    var poster = item.poster_path
        ? 'https://image.tmdb.org/t/p/w342' + item.poster_path
        : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342';
    var title  = item.title || item.name || '';
    var date   = item.release_date || item.first_air_date || '';
    var dateF  = formatDate(date);
    var rating = item.vote_average && item.vote_average > 0 ? '⭐ ' + item.vote_average.toFixed(1) : '';
    var today  = new Date(); today.setHours(0,0,0,0);
    var rel    = date ? new Date(date + 'T00:00:00') : null;
    var diff   = rel ? (rel - today) / 86400000 : 999;
    var isNew  = diff >= -3 && diff <= 7;

    var card = document.createElement('div');
    card.className = 'media-card';
    card.innerHTML =
        (isNew ? '<div class="new-badge">🔥 Esta semana</div>' : '') +
        '<img src="' + poster + '" alt="' + escapeHtml(title) + '" loading="lazy"' +
        ' onerror="this.src=\'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342\'">' +
        '<div class="media-card-info">' +
            '<div class="media-card-title">' + escapeHtml(title) + '</div>' +
            '<div class="media-card-date">📆 ' + dateF + '</div>' +
            (rating ? '<div class="media-card-rating">' + rating + '</div>' : '') +
        '</div>';
    card.addEventListener('click', function() { openMediaModal(item, isTV); });
    return card;
}

// ══════════════════════════════════════════════
// DESTAQUES DA SEMANA — CARREGAR
// ══════════════════════════════════════════════
async function loadDestaques() {
    var grid = document.getElementById('destaquesGrid');
    if (!grid) return;

    for (var i = 0; i < DESTAQUES.length; i++) {
        var cfg   = DESTAQUES[i];
        var card  = document.getElementById('destaqueCard' + i);
        if (!card) continue;

        try {
            var isTV = cfg.tipo === 'serie';
            var searchType = isTV ? 'tv' : 'movie';
            var searchData = await tmdb('search/' + searchType + '?query=' + encodeURIComponent(cfg.titulo) + '&language=pt-BR&page=1');
            var item = (searchData.results || [])[0];

            if (!item) {
                // Tenta busca em inglês como fallback
                searchData = await tmdb('search/' + searchType + '?query=' + encodeURIComponent(cfg.titulo) + '&language=en-US&page=1');
                item = (searchData.results || [])[0];
            }

            if (!item) {
                card.innerHTML = renderDestaqueErro(cfg);
                continue;
            }

            // Busca detalhes completos (gêneros, sinopse em pt-BR, etc.)
            var details = await tmdb(searchType + '/' + item.id + '?language=pt-BR');
            renderDestaqueCard(card, details, cfg, isTV);

        } catch(e) {
            console.error('[Destaque ' + i + ']', e);
            card.innerHTML = renderDestaqueErro(cfg);
        }
    }
}

function renderDestaqueCard(card, details, cfg, isTV) {
    var poster = details.poster_path
        ? 'https://image.tmdb.org/t/p/w342' + details.poster_path
        : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342';

    var titulo   = details.title || details.name || cfg.titulo;
    var sinopse  = details.overview || 'Sinopse não disponível.';
    var rating   = details.vote_average && details.vote_average > 0
        ? '⭐ ' + parseFloat(details.vote_average).toFixed(1)
        : '';
    var ano      = (details.release_date || details.first_air_date || '').split('-')[0] || '';
    var generos  = (details.genres || []).slice(0, 3);
    var tipoLabel = isTV ? 'Série' : 'Filme';
    var tipoClass = isTV ? 'serie' : 'filme';

    card.innerHTML =
        '<div class="destaque-card-inner">' +
            '<div class="destaque-poster-wrap">' +
                '<img class="destaque-poster" src="' + poster + '" alt="' + escapeHtml(titulo) + '"' +
                ' onerror="this.src=\'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342\'">' +
                '<span class="destaque-tipo-badge ' + tipoClass + '">' + tipoLabel + '</span>' +
            '</div>' +
            '<div class="destaque-info">' +
                '<div class="destaque-semana-label">🎯 Destaque da Semana</div>' +
                '<div class="destaque-titulo">' + escapeHtml(titulo) + '</div>' +
                '<div class="destaque-meta">' +
                    (rating ? '<span class="destaque-rating">' + rating + '</span>' : '') +
                    (ano    ? '<span class="destaque-ano">' + ano + '</span>' : '') +
                '</div>' +
                (generos.length > 0
                    ? '<div class="destaque-generos">' +
                        generos.map(function(g){ return '<span class="destaque-genero-tag">' + escapeHtml(g.name) + '</span>'; }).join('') +
                      '</div>'
                    : '') +
                '<p class="destaque-sinopse">' + escapeHtml(sinopse) + '</p>' +
            '</div>' +
        '</div>' +
        '<div class="destaque-footer">' +
            '<span class="destaque-disponivel">📺 Disponível no VLTV Play</span>' +
            '<button class="destaque-cta-btn" onclick="openModal(\'Destaque — ' + escapeHtml(titulo) + '\')">Assistir agora ›</button>' +
        '</div>';

    // Clique no card abre modal de detalhes
    card.querySelector('.destaque-card-inner').addEventListener('click', function() {
        openMediaModal(details, isTV);
    });
    card.querySelector('.destaque-card-inner').style.cursor = 'pointer';
}

function renderDestaqueErro(cfg) {
    return '<div class="destaque-card-inner" style="padding:30px;align-items:center;justify-content:center;min-height:150px">' +
        '<div style="text-align:center;color:#555">' +
            '<div style="font-size:2rem;margin-bottom:8px">🎬</div>' +
            '<div style="font-size:0.85rem">' + escapeHtml(cfg.titulo) + '</div>' +
            '<div style="font-size:0.72rem;color:#444;margin-top:4px">Em breve no VLTV Play</div>' +
        '</div>' +
    '</div>' +
    '<div class="destaque-footer">' +
        '<span class="destaque-disponivel">📺 Em breve</span>' +
        '<button class="destaque-cta-btn" onclick="openModal(\'Destaque\')">Solicitar Acesso ›</button>' +
    '</div>';
}

// ══════════════════════════════════════════════
// CARROSSÉIS — FILMES EM CARTAZ
// ══════════════════════════════════════════════
async function loadNowPlaying() {
    var track = document.getElementById('trackCinema');
    var view  = document.getElementById('viewCinema');
    if (!track || !view) return;
    try {
        var today = new Date(); today.setHours(0,0,0,0);
        var todayStr = today.toISOString().split('T')[0];

        var pages = await Promise.all([
            tmdb('movie/now_playing?language=pt-BR&page=1'),
            tmdb('movie/now_playing?language=pt-BR&page=2'),
            tmdb('movie/now_playing?language=pt-BR&page=3'),
        ]);

        var seen = {}, movies = [];
        pages.forEach(function(pg) {
            (pg.results || []).forEach(function(m) {
                if (!m.poster_path || (!m.title && !m.name)) return;
                if (seen[m.id] || !m.release_date || m.release_date > todayStr) return;
                seen[m.id] = true;
                movies.push(m);
            });
        });
        movies.sort(function(a,b){ return b.release_date.localeCompare(a.release_date); });

        if (!movies.length) { track.innerHTML = '<div class="loading-card">Nenhum filme em cartaz encontrado.</div>'; return; }
        track.innerHTML = '';
        movies.forEach(function(m){ track.appendChild(createCard(m, false)); });
        buildCarousel(track, view, document.getElementById('prevCinema'), document.getElementById('nextCinema'));
    } catch(e) {
        console.error('NowPlaying:', e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar filmes em cartaz.</div>';
    }
}

// ══════════════════════════════════════════════
// CARROSSÉIS — PRÓXIMOS LANÇAMENTOS
// ══════════════════════════════════════════════
async function loadMovies() {
    var track = document.getElementById('trackMovies');
    var view  = document.getElementById('viewMovies');
    if (!track || !view) return;
    try {
        var data = await tmdb('movie/upcoming?language=pt-BR&page=1');
        var movies = (data.results || []).filter(function(m){ return m.poster_path && (m.title || m.name); });
        if (!movies.length) { track.innerHTML = '<div class="loading-card">Nenhum lançamento encontrado.</div>'; return; }
        track.innerHTML = '';
        movies.forEach(function(m){ track.appendChild(createCard(m, false)); });
        buildCarousel(track, view, document.getElementById('prevMovies'), document.getElementById('nextMovies'));
    } catch(e) {
        console.error('Movies:', e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar filmes.</div>';
    }
}

// ══════════════════════════════════════════════
// CARROSSÉIS — SÉRIES
// ══════════════════════════════════════════════
async function loadSeries() {
    var track = document.getElementById('trackSeries');
    var view  = document.getElementById('viewSeries');
    if (!track || !view) return;
    try {
        var today  = new Date().toISOString().split('T')[0];
        var future = new Date(); future.setDate(future.getDate() + 120);
        var futStr = future.toISOString().split('T')[0];

        var pages = await Promise.all([
            tmdb('discover/tv?language=pt-BR&sort_by=popularity.desc&first_air_date.gte=' + today + '&first_air_date.lte=' + futStr + '&page=1'),
            tmdb('discover/tv?language=pt-BR&sort_by=popularity.desc&first_air_date.gte=' + today + '&first_air_date.lte=' + futStr + '&page=2'),
            tmdb('discover/tv?language=pt-BR&sort_by=first_air_date.desc&first_air_date.gte=' + today + '&page=1'),
        ]);

        var seen = {}, all = [];
        pages.forEach(function(pg) {
            (pg.results || []).forEach(function(s) {
                var d = s.first_air_date || '';
                if (!s.poster_path || !d || d < today || seen[s.id]) return;
                seen[s.id] = true; all.push(s);
            });
        });
        all.sort(function(a,b){ return (a.first_air_date||'').localeCompare(b.first_air_date||''); });
        all = all.slice(0, 20);

        if (!all.length) { track.innerHTML = '<div class="loading-card">Nenhuma série futura encontrada.</div>'; return; }
        track.innerHTML = '';
        all.forEach(function(s){ track.appendChild(createCard(s, true)); });
        buildCarousel(track, view, document.getElementById('prevSeries'), document.getElementById('nextSeries'));
    } catch(e) {
        console.error('Series:', e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar séries.</div>';
    }
}

// ── Abas ──
function switchTab(tab, btn) {
    document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = document.getElementById('panel-' + tab);
    if (panel) panel.classList.add('active');
}

// ══════════════════════════════════════════════
// MODAL FILME / SÉRIE
// ══════════════════════════════════════════════
async function openMediaModal(item, isTV) {
    var modal    = document.getElementById('mediaModal');
    var backdrop = document.getElementById('mediaBackdrop');
    var poster   = document.getElementById('mediaPoster');
    var titleEl  = document.getElementById('mediaTitle');
    var tags     = document.getElementById('mediaTags');
    var meta     = document.getElementById('mediaMetaRow');
    var overview = document.getElementById('mediaOverview');
    var cast     = document.getElementById('mediaCast');
    var ctaWrap  = document.getElementById('mediaCtaWrap');
    if (!modal) return;

    tags.innerHTML = ''; meta.innerHTML = ''; cast.innerHTML = ''; ctaWrap.innerHTML = '';
    overview.textContent = 'Carregando...';
    titleEl.textContent  = item.title || item.name || '';
    poster.src = item.poster_path ? 'https://image.tmdb.org/t/p/w342' + item.poster_path : '';
    backdrop.style.backgroundImage = item.backdrop_path
        ? "url('https://image.tmdb.org/t/p/w1280" + item.backdrop_path + "')"
        : "url('https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?q=80&w=1280')";

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        var type = isTV ? 'tv' : 'movie';
        var results = await Promise.all([
            tmdb(type + '/' + item.id + '?language=pt-BR'),
            tmdb(type + '/' + item.id + '/credits?language=pt-BR'),
        ]);
        var details = results[0], credits = results[1];
        overview.textContent = details.overview || item.overview || 'Sinopse ainda não disponível.';

        (details.genres || []).slice(0,3).forEach(function(g) {
            var t = document.createElement('span'); t.className = 'media-tag'; t.textContent = g.name; tags.appendChild(t);
        });

        var extra = isTV
            ? (details.number_of_seasons ? details.number_of_seasons + ' temp.' : '')
            : (details.runtime ? details.runtime + ' min' : '');
        var dateF = formatDate(item.release_date || item.first_air_date || '');

        meta.innerHTML =
            '<div class="media-meta">📆 <strong>' + dateF + '</strong></div>' +
            (item.vote_average ? '<div class="media-meta">⭐ <strong>' + item.vote_average.toFixed(1) + '</strong></div>' : '') +
            (extra ? '<div class="media-meta">🎞 <strong>' + extra + '</strong></div>' : '') +
            (details.original_language ? '<div class="media-meta">🌐 <strong>' + details.original_language.toUpperCase() + '</strong></div>' : '');

        (credits.cast || []).slice(0,6).forEach(function(p) {
            var chip = document.createElement('div'); chip.className = 'cast-chip'; chip.textContent = p.name; cast.appendChild(chip);
        });
    } catch(err) {
        overview.textContent = item.overview || 'Sinopse ainda não disponível.';
        var gmap = isTV ? GENRES_TV : GENRES_MOVIE;
        (item.genre_ids || []).slice(0,3).forEach(function(id) {
            if (gmap[id]) { var t = document.createElement('span'); t.className='media-tag'; t.textContent=gmap[id]; tags.appendChild(t); }
        });
        meta.innerHTML = '<div class="media-meta">📆 <strong>' + formatDate(item.release_date || item.first_air_date || '') + '</strong></div>';
    }

    var releaseDate = item.release_date || item.first_air_date || '';
    var todayStr = new Date().toISOString().split('T')[0];
    if (!releaseDate || releaseDate <= todayStr) {
        ctaWrap.innerHTML = '<div class="media-soon">🎬 Em cartaz nos cinemas — Em breve na VLTV Play</div>';
    } else {
        ctaWrap.innerHTML = '<div class="media-soon">🕐 Disponível na VLTV Play após o lançamento</div>';
    }
}

function closeMediaModal() {
    var m = document.getElementById('mediaModal');
    if (m) m.classList.remove('active');
    document.body.style.overflow = '';
}
function handleMediaModalClick(e) {
    if (e.target === document.getElementById('mediaModal')) closeMediaModal();
}

// ══════════════════════════════════════════════
// FAQ
// ══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.faq-item').forEach(function(item) {
        var btn = item.querySelector('.faq-question');
        if (btn) btn.addEventListener('click', function() {
            var active = document.querySelector('.faq-item.active');
            if (active && active !== item) active.classList.remove('active');
            item.classList.toggle('active');
        });
    });
});

// ══════════════════════════════════════════════
// MODAL DISPOSITIVO
// ══════════════════════════════════════════════
function openModal(ctx) {
    currentPlan = ctx;
    var titleEl = document.getElementById('modalTitle');
    if (titleEl) titleEl.innerText = ctx === 'Geral' ? 'Solicitar Teste Grátis' : 'Teste — ' + ctx;
    var modal = document.getElementById('testModal');
    if (modal) modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeModal() {
    var m = document.getElementById('testModal');
    if (m) m.classList.remove('active');
    document.body.style.overflow = '';
}
function handleModalClick(e) {
    if (e.target === document.getElementById('testModal')) closeModal();
}
function sendWhatsApp() {
    var device = (document.getElementById('deviceSelect') || {}).value || 'TV Smart';
    var text = currentPlan === 'Geral'
        ? 'Olá! Gostaria de solicitar um teste gratuito para: ' + device + '.'
        : 'Olá! Tenho interesse no ' + currentPlan + '. Gostaria de um teste para: ' + device + '.';
    window.open('https://api.whatsapp.com/send?phone=' + WHATSAPP + '&text=' + encodeURIComponent(text), '_blank');
    closeModal();
}

// ══════════════════════════════════════════════
// CHAT IA — GEMINI
// ══════════════════════════════════════════════
var chatOpen = false;
var chatHistory = [];

function toggleChat() {
    chatOpen = !chatOpen;
    var box  = document.getElementById('chatBox');
    var icon = document.querySelector('.chat-icon');
    var cls  = document.querySelector('.close-icon');
    var bdg  = document.getElementById('chatBadge');
    if (!box) return;
    if (chatOpen) {
        box.style.display = 'flex';
        box.offsetHeight;
        box.classList.add('open');
        if (icon) icon.style.display = 'none';
        if (cls)  cls.style.display  = 'block';
        if (bdg)  bdg.style.display  = 'none';
        scrollChat();
    } else {
        box.classList.remove('open');
        if (icon) icon.style.display = 'block';
        if (cls)  cls.style.display  = 'none';
        setTimeout(function(){ box.style.display = 'none'; }, 260);
    }
}

function handleChatKey(e) { if (e.key === 'Enter') sendChatMessage(); }
function scrollChat() { var m = document.getElementById('chatMessages'); if (m) m.scrollTop = m.scrollHeight; }
function ftime() {
    var n = new Date();
    return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
}
function addMsg(html, sender) {
    var msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    var d = document.createElement('div');
    d.className = 'chat-msg ' + sender;
    d.innerHTML = '<div class="chat-bubble">' + html + '</div><div class="chat-time">' + ftime() + '</div>';
    msgs.appendChild(d);
    scrollChat();
}
function addTyping() {
    var msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    var d = document.createElement('div');
    d.className = 'chat-msg bot typing-indicator'; d.id = 'typingDot';
    d.innerHTML = '<div class="chat-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    msgs.appendChild(d); scrollChat();
}
function removeTyping() { var t = document.getElementById('typingDot'); if (t) t.remove(); }

async function sendChatMessage() {
    var input = document.getElementById('chatInput');
    if (!input) return;
    var txt = input.value.trim();
    if (!txt) return;
    input.value = '';
    addMsg(escapeHtml(txt), 'user');
    chatHistory.push({ role: 'user', parts: [{ text: txt }] });
    addTyping();
    try {
        var r = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: chatHistory }),
        });
        var data = await r.json();
        removeTyping();
        var reply = data.reply || 'Não consegui processar. Fale no WhatsApp! 😊';
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        var formatted = reply
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/\n/g,'<br>')
            .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
        addMsg(formatted, 'bot');
    } catch(e) {
        removeTyping();
        addMsg('Erro de conexão. Fale no WhatsApp! 💬', 'bot');
    }
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', function() {
    loadDestaques();
    loadNowPlaying();
    loadMovies();
    loadSeries();
});
