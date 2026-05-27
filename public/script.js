// =============================================
// VLTV Play — script.js (CORRIGIDO)
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

// ── TMDB via backend proxy ──
async function tmdb(endpoint) {
    const r = await fetch('/api/tmdb?endpoint=' + encodeURIComponent(endpoint));
    if (!r.ok) throw new Error('TMDB ' + r.status);
    return r.json();
}

// ── Header scroll ──
window.addEventListener('scroll', function() {
    var header = document.getElementById('siteHeader');
    if (header) {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
});

// ── Mobile nav ──
function toggleMobileNav() {
    var nav = document.getElementById('mobileNav');
    if (nav) nav.classList.toggle('open');
}

// ── CARROSSEL ──
function buildCarousel(trackEl, viewEl, prevEl, nextEl) {
    var CARD_W = 160 + 14;
    var pos = 0;
    var dragging = false;
    var startX = 0;
    var startPos = 0;

    function clamp(v) {
        var maxScroll = Math.max(0, trackEl.scrollWidth - viewEl.clientWidth);
        return Math.max(0, Math.min(v, maxScroll));
    }

    function move(p, animate) {
        if (animate === undefined) animate = true;
        pos = clamp(p);
        trackEl.style.transition = animate ? 'transform .4s ease' : 'none';
        trackEl.style.webkitTransition = animate ? 'transform .4s ease' : 'none';
        trackEl.style.transform = 'translateX(-' + pos + 'px)';
        trackEl.style.webkitTransform = 'translateX(-' + pos + 'px)';
    }

    if (prevEl) prevEl.addEventListener('click', function() { move(pos - CARD_W * 2); });
    if (nextEl) nextEl.addEventListener('click', function() { move(pos + CARD_W * 2); });

    // Mouse drag
    trackEl.addEventListener('mousedown', function(e) {
        dragging = true;
        startX = e.clientX;
        startPos = pos;
        trackEl.style.transition = 'none';
    });

    window.addEventListener('mousemove', function(e) {
        if (dragging) move(startPos - (e.clientX - startX), false);
    });

    window.addEventListener('mouseup', function() {
        if (dragging) {
            dragging = false;
            trackEl.style.transition = 'transform .4s ease';
        }
    });

    // Touch
    trackEl.addEventListener('touchstart', function(e) {
        startX = e.touches[0].clientX;
        startPos = pos;
        trackEl.style.transition = 'none';
    }, { passive: true });

    trackEl.addEventListener('touchmove', function(e) {
        move(startPos - (e.touches[0].clientX - startX), false);
    }, { passive: true });

    trackEl.addEventListener('touchend', function() {
        trackEl.style.transition = 'transform .4s ease';
    });
}

// ── CRIAR CARD ──
function createCard(item, isTV) {
    var poster = item.poster_path
        ? 'https://image.tmdb.org/t/p/w342' + item.poster_path
        : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342';

    var title  = item.title || item.name || '';
    var date   = item.release_date || item.first_air_date || '';
    var dateParts = date ? date.split('-') : [];
    var dateF  = dateParts.length === 3
        ? dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0]
        : 'Em breve';
    var rating = item.vote_average && item.vote_average > 0
        ? '⭐ ' + item.vote_average.toFixed(1)
        : '';

    var today  = new Date(); today.setHours(0, 0, 0, 0);
    var rel    = date ? new Date(date + 'T00:00:00') : null;
    var diff   = rel ? (rel - today) / 86400000 : 999;
    var isNew  = diff >= -3 && diff <= 7;

    var card = document.createElement('div');
    card.className = 'media-card';

    var newBadge = isNew ? '<div class="new-badge">🔥 Esta semana</div>' : '';
    var ratingEl = rating ? '<div class="media-card-rating">' + rating + '</div>' : '';

    card.innerHTML =
        newBadge +
        '<img src="' + poster + '" alt="' + escapeHtml(title) + '" loading="lazy"' +
        ' onerror="this.src=\'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342\'">' +
        '<div class="media-card-info">' +
            '<div class="media-card-title">' + escapeHtml(title) + '</div>' +
            '<div class="media-card-date">📆 ' + dateF + '</div>' +
            ratingEl +
        '</div>';

    card.addEventListener('click', function() { openMediaModal(item, isTV); });
    return card;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── EM CARTAZ NO CINEMA ──
// Filmes dos últimos 60 dias, ordenados por data de lançamento (mais recentes primeiro)
async function loadNowPlaying() {
    var track = document.getElementById('trackCinema');
    var view  = document.getElementById('viewCinema');
    if (!track || !view) return;

    try {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var todayStr = today.toISOString().split('T')[0];

        // Busca 3 páginas em paralelo
        var pages = await Promise.all([
            fetch('/api/nowplaying?page=1').then(function(r) { return r.json(); }),
            fetch('/api/nowplaying?page=2').then(function(r) { return r.json(); }),
            fetch('/api/nowplaying?page=3').then(function(r) { return r.json(); })
        ]);

        var seen = {};
        var movies = [];

        pages.forEach(function(pageData) {
            var results = pageData.results || [];
            results.forEach(function(m) {
                // Só aceita filmes COM poster, COM título, SEM duplicata, e COM data <= hoje
                if (!m.poster_path) return;
                if (!m.title && !m.name) return;
                if (seen[m.id]) return;
                if (!m.release_date) return;
                if (m.release_date > todayStr) return; // exclui futuros
                seen[m.id] = true;
                movies.push(m);
            });
        });

        // Mais recentes primeiro
        movies.sort(function(a, b) {
            return b.release_date.localeCompare(a.release_date);
        });

        if (!movies.length) {
            track.innerHTML = '<div class="loading-card">Nenhum filme em cartaz encontrado.</div>';
            return;
        }

        track.innerHTML = '';
        movies.forEach(function(m) { track.appendChild(createCard(m, false)); });
        buildCarousel(
            track, view,
            document.getElementById('prevCinema'),
            document.getElementById('nextCinema')
        );
    } catch(e) {
        console.error('NowPlaying:', e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar filmes em cartaz.</div>';
    }
}

// ── PRÓXIMOS LANÇAMENTOS (filmes) ──
async function loadMovies() {
    var track = document.getElementById('trackMovies');
    var view  = document.getElementById('viewMovies');
    if (!track || !view) return;

    try {
        var r = await fetch('/api/upcoming');
        if (!r.ok) throw new Error(r.status);
        var data   = await r.json();
        var movies = (data.results || []).filter(function(m) {
            return m.poster_path && (m.title || m.name);
        });

        if (!movies.length) {
            track.innerHTML = '<div class="loading-card">Nenhum lançamento encontrado.</div>';
            return;
        }

        track.innerHTML = '';
        movies.forEach(function(m) { track.appendChild(createCard(m, false)); });
        buildCarousel(
            track, view,
            document.getElementById('prevMovies'),
            document.getElementById('nextMovies')
        );
    } catch(e) {
        console.error('Movies:', e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar filmes.</div>';
    }
}

// ── SÉRIES ──
async function loadSeries() {
    var track = document.getElementById('trackSeries');
    var view  = document.getElementById('viewSeries');
    if (!track || !view) return;

    try {
        var today  = new Date().toISOString().split('T')[0];
        var future = new Date();
        future.setDate(future.getDate() + 120);
        var futStr = future.toISOString().split('T')[0];

        var pages = await Promise.all([
            tmdb('discover/tv?language=pt-BR&sort_by=popularity.desc&first_air_date.gte=' + today + '&first_air_date.lte=' + futStr + '&page=1'),
            tmdb('discover/tv?language=pt-BR&sort_by=popularity.desc&first_air_date.gte=' + today + '&first_air_date.lte=' + futStr + '&page=2'),
            tmdb('discover/tv?language=pt-BR&sort_by=first_air_date.desc&first_air_date.gte=' + today + '&page=1')
        ]);

        var seen = {};
        var all  = [];

        pages.forEach(function(pageData) {
            (pageData.results || []).forEach(function(s) {
                if (!s.poster_path) return;
                var d = s.first_air_date || '';
                if (!d || d < today) return;
                if (seen[s.id]) return;
                seen[s.id] = true;
                all.push(s);
            });
        });

        all.sort(function(a, b) {
            return (a.first_air_date || '').localeCompare(b.first_air_date || '');
        });
        all = all.slice(0, 20);

        if (!all.length) {
            track.innerHTML = '<div class="loading-card">Nenhuma série futura encontrada.</div>';
            return;
        }

        track.innerHTML = '';
        all.forEach(function(s) { track.appendChild(createCard(s, true)); });
        buildCarousel(
            track, view,
            document.getElementById('prevSeries'),
            document.getElementById('nextSeries')
        );
    } catch(e) {
        console.error('Series:', e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar séries.</div>';
    }
}

// ── ABAS ──
function switchTab(tab, btn) {
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = document.getElementById('panel-' + tab);
    if (panel) panel.classList.add('active');
}

// ── MODAL FILME/SÉRIE ──
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

    tags.innerHTML = '';
    meta.innerHTML = '';
    cast.innerHTML = '';
    ctaWrap.innerHTML = '';
    overview.textContent = 'Carregando...';
    titleEl.textContent  = item.title || item.name || '';

    var sinopse = item.overview || '';

    poster.src = item.poster_path
        ? 'https://image.tmdb.org/t/p/w342' + item.poster_path
        : '';

    backdrop.style.backgroundImage = item.backdrop_path
        ? "url('https://image.tmdb.org/t/p/w1280" + item.backdrop_path + "')"
        : "url('https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?q=80&w=1280')";

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        var type = isTV ? 'tv' : 'movie';
        var results = await Promise.all([
            tmdb(type + '/' + item.id + '?language=pt-BR'),
            tmdb(type + '/' + item.id + '/credits?language=pt-BR')
        ]);
        var details = results[0];
        var credits = results[1];

        sinopse = details.overview || sinopse || 'Sinopse ainda não disponível.';
        overview.textContent = sinopse;

        tags.innerHTML = '';
        (details.genres || []).slice(0, 3).forEach(function(g) {
            var t = document.createElement('span');
            t.className = 'media-tag';
            t.textContent = g.name;
            tags.appendChild(t);
        });

        var extra = isTV
            ? (details.number_of_seasons ? details.number_of_seasons + ' temp.' : '')
            : (details.runtime ? details.runtime + ' min' : '');

        var date  = item.release_date || item.first_air_date || '';
        var dateParts = date ? date.split('-') : [];
        var dateF = dateParts.length === 3
            ? dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0]
            : 'Em breve';

        meta.innerHTML =
            '<div class="media-meta">📆 <strong>' + dateF + '</strong></div>' +
            (item.vote_average ? '<div class="media-meta">⭐ <strong>' + item.vote_average.toFixed(1) + '</strong></div>' : '') +
            (extra ? '<div class="media-meta">🎞 <strong>' + extra + '</strong></div>' : '') +
            (details.original_language ? '<div class="media-meta">🌐 <strong>' + details.original_language.toUpperCase() + '</strong></div>' : '');

        (credits.cast || []).slice(0, 6).forEach(function(p) {
            var chip = document.createElement('div');
            chip.className = 'cast-chip';
            chip.textContent = p.name;
            cast.appendChild(chip);
        });

    } catch(err) {
        overview.textContent = sinopse || 'Sinopse ainda não disponível.';
        var gmap = isTV ? GENRES_TV : GENRES_MOVIE;
        (item.genre_ids || []).slice(0, 3).forEach(function(id) {
            if (gmap[id]) {
                var t = document.createElement('span');
                t.className = 'media-tag';
                t.textContent = gmap[id];
                tags.appendChild(t);
            }
        });
        var date2  = item.release_date || item.first_air_date || '';
        var dp = date2 ? date2.split('-') : [];
        var df = dp.length === 3 ? dp[2]+'/'+dp[1]+'/'+dp[0] : 'Em breve';
        meta.innerHTML = '<div class="media-meta">📆 <strong>' + df + '</strong></div>';
    }

    var releaseDate = item.release_date || item.first_air_date || '';
    var todayStr = new Date().toISOString().split('T')[0];
    var isFuture = releaseDate && releaseDate > todayStr;

    if (isFuture) {
        ctaWrap.innerHTML = '<div class="media-soon">🕐 Disponível na VLTV Play após o lançamento</div>';
    } else {
        ctaWrap.innerHTML = '<button class="btn-cta media-cta" onclick="openModal(\'Geral\'); closeMediaModal()">🎬 Quero Assistir — Teste Grátis</button>';
    }
}

function closeMediaModal() {
    var modal = document.getElementById('mediaModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

function handleMediaModalClick(e) {
    var modal = document.getElementById('mediaModal');
    if (e.target === modal) closeMediaModal();
}

// ── FAQ ──
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.faq-item').forEach(function(item) {
        var btn = item.querySelector('.faq-question');
        if (btn) {
            btn.addEventListener('click', function() {
                var active = document.querySelector('.faq-item.active');
                if (active && active !== item) active.classList.remove('active');
                item.classList.toggle('active');
            });
        }
    });
});

// ── MODAL DISPOSITIVO ──
function openModal(ctx) {
    currentPlan = ctx;
    var titleEl = document.getElementById('modalTitle');
    if (titleEl) {
        titleEl.innerText = ctx === 'Geral'
            ? 'Solicitar Teste Grátis'
            : 'Teste — ' + ctx;
    }
    var modal = document.getElementById('testModal');
    if (modal) modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    var modal = document.getElementById('testModal');
    if (modal) modal.classList.remove('active');
    document.body.style.overflow = '';
}

function handleModalClick(e) {
    var modal = document.getElementById('testModal');
    if (e.target === modal) closeModal();
}

function sendWhatsApp() {
    var deviceEl = document.getElementById('deviceSelect');
    var device = deviceEl ? deviceEl.value : 'TV Smart';
    var text = currentPlan === 'Geral'
        ? 'Olá! Gostaria de solicitar um teste gratuito para: ' + device + '.'
        : 'Olá! Tenho interesse no ' + currentPlan + '. Gostaria de um teste para: ' + device + '.';
    window.open('https://api.whatsapp.com/send?phone=' + WHATSAPP + '&text=' + encodeURIComponent(text), '_blank');
    closeModal();
}

// ── CHAT IA ──
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
        // Força reflow antes de adicionar classe para animação funcionar
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
        setTimeout(function() { box.style.display = 'none'; }, 260);
    }
}

function handleChatKey(e) {
    if (e.key === 'Enter') sendChatMessage();
}

function scrollChat() {
    var m = document.getElementById('chatMessages');
    if (m) m.scrollTop = m.scrollHeight;
}

function ftime() {
    var n = new Date();
    return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0');
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
    d.className = 'chat-msg bot typing-indicator';
    d.id = 'typingDot';
    d.innerHTML = '<div class="chat-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    msgs.appendChild(d);
    scrollChat();
}

function removeTyping() {
    var t = document.getElementById('typingDot');
    if (t) t.remove();
}

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
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ history: chatHistory })
        });

        var data = await r.json();
        removeTyping();

        var reply = data.reply || 'Não consegui processar. Fale no WhatsApp! 😊';
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });

        // Formata markdown básico e quebras de linha
        var formatted = reply
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        addMsg(formatted, 'bot');
    } catch(e) {
        removeTyping();
        addMsg('Erro de conexão. Fale no WhatsApp! 💬', 'bot');
    }
}

// ── COPA DO MUNDO — Dados em tempo real (se Football API estiver configurada) ──
async function loadCopaMundoData() {
    // Tenta buscar jogos ao vivo da Copa 2026 (ID liga: 1 = Copa do Mundo)
    try {
        var r = await fetch('/api/football?endpoint=' + encodeURIComponent('fixtures?league=1&season=2026&live=all'));
        if (!r.ok) return;
        var data = await r.json();
        var fixtures = data.response || [];

        if (fixtures.length > 0) {
            // Há jogos ao vivo!
            var badge = document.getElementById('copaLiveBadge');
            if (badge) badge.style.display = 'flex';
            renderLiveMatches(fixtures);
        } else {
            // Busca próximos jogos
            loadNextMatches();
        }
    } catch(e) {
        // API de futebol não configurada — dados estáticos já estão no HTML
    }
}

async function loadNextMatches() {
    try {
        var r = await fetch('/api/football?endpoint=' + encodeURIComponent('fixtures?league=1&season=2026&next=5'));
        if (!r.ok) return;
        var data = await r.json();
        var fixtures = data.response || [];
        if (fixtures.length > 0) renderNextMatches(fixtures);
    } catch(e) {
        // Silencioso — dados estáticos já visíveis
    }
}

function renderLiveMatches(fixtures) {
    var container = document.getElementById('copaMatches');
    if (!container || !fixtures.length) return;

    var titleEl = document.getElementById('copaMatchesTitle');
    if (titleEl) titleEl.textContent = '🔴 Jogos Ao Vivo — Copa do Mundo 2026';

    // Mostra até 4 jogos ao vivo
    var html = '';
    fixtures.slice(0, 4).forEach(function(f) {
        var home  = f.teams.home.name;
        var away  = f.teams.away.name;
        var scoreH = f.goals.home !== null ? f.goals.home : '-';
        var scoreA = f.goals.away !== null ? f.goals.away : '-';
        var min   = f.fixture.status.elapsed ? f.fixture.status.elapsed + "'" : 'AO VIVO';

        html += '<div class="match-card">' +
            '<div class="match-date">⚽ ' + min + '</div>' +
            '<div class="match-teams">' +
                '<span class="team-name">' + escapeHtml(home) + '</span>' +
                '<span class="match-vs" style="font-size:1.1rem;font-weight:900;color:#fff;padding:0 10px;">' +
                    scoreH + ' × ' + scoreA +
                '</span>' +
                '<span class="team-name">' + escapeHtml(away) + '</span>' +
            '</div>' +
            '<span class="match-status live">🔴 Ao Vivo</span>' +
        '</div>';
    });

    // Mantém o card de CTA
    html += '<div class="match-card highlight-match">' +
        '<div class="match-badge-copa">🔥 Assista no VLTV Play</div>' +
        '<div class="match-date">Todos os jogos ao vivo em HD & 4K</div>' +
        '<div class="match-teams"><span class="team-flag">🏆</span><span class="team-name">Copa do Mundo 2026</span></div>' +
        '<button class="btn-copa-cta" onclick="openModal(\'Copa do Mundo 2026\')">Garantir Meu Acesso</button>' +
    '</div>';

    container.innerHTML = html;
}

function renderNextMatches(fixtures) {
    var container = document.getElementById('copaMatches');
    if (!container || !fixtures.length) return;

    var html = '';
    fixtures.slice(0, 3).forEach(function(f) {
        var home = f.teams.home.name;
        var away = f.teams.away.name;
        var dateObj = new Date(f.fixture.date);
        var dateStr = dateObj.toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
        var timeStr = dateObj.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

        html += '<div class="match-card">' +
            '<div class="match-date">📅 ' + dateStr + ' · ' + timeStr + '</div>' +
            '<div class="match-teams">' +
                '<span class="team-name">' + escapeHtml(home) + '</span>' +
                '<span class="match-vs">vs</span>' +
                '<span class="team-name">' + escapeHtml(away) + '</span>' +
            '</div>' +
            '<span class="match-status upcoming">Em breve</span>' +
        '</div>';
    });

    html += '<div class="match-card highlight-match">' +
        '<div class="match-badge-copa">🔥 Assistir no VLTV Play</div>' +
        '<div class="match-date">Todos os jogos ao vivo</div>' +
        '<div class="match-teams"><span class="team-flag">🏆</span><span class="team-name">Copa do Mundo 2026</span><span class="match-vs">em</span><span class="team-name">HD & 4K</span><span class="team-flag">📺</span></div>' +
        '<button class="btn-copa-cta" onclick="openModal(\'Copa do Mundo 2026\')">Garantir Meu Acesso</button>' +
    '</div>';

    container.innerHTML = html;
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', function() {
    loadNowPlaying();
    loadMovies();
    loadSeries();
    loadCopaMundoData();
});
