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

// ── TMDB via proxy backend (com fallback direto à API TMDB) ──
var TMDB_KEY_FALLBACK = '9b73f5dd15b8165b1b57419be2f29128';
async function tmdb(endpoint) {
    try {
        var r = await fetch('/api/tmdb?endpoint=' + encodeURIComponent(endpoint));
        if (r.ok) return r.json();
    } catch(e) { /* servidor offline, usa fallback */ }
    // Fallback direto à API TMDB
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
        trackEl.style.webkitTransition = tr;
        trackEl.style.transform = 'translateX(-' + pos + 'px)';
        trackEl.style.webkitTransform = 'translateX(-' + pos + 'px)';
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
// CARD DE MÍDIA
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
// CARREGAR FILMES EM CARTAZ (últimos 60 dias)
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
// CARREGAR PRÓXIMOS LANÇAMENTOS
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
// CARREGAR SÉRIES
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

    // ── CTA: em cartaz no cinema → "Em breve na VLTV Play" / futuro → "Disponível após lançamento"
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
// COPA DO MUNDO — TEMPO REAL
// ══════════════════════════════════════════════

// Aba da Copa
function switchCopaTab(tab, btn) {
    document.querySelectorAll('.copa-tab').forEach(function(t){ t.classList.remove('active'); });
    document.querySelectorAll('.copa-panel').forEach(function(p){ p.classList.remove('active'); });
    btn.classList.add('active');
    var panel = document.getElementById('copa-panel-' + tab);
    if (panel) panel.classList.add('active');
    if (tab === 'partidas') loadProximasPartidas();
}

// Verifica jogos ao vivo ao carregar
async function loadCopaMundoData() {
    try {
        var r = await fetch('/api/football?endpoint=' + encodeURIComponent('fixtures?league=1&season=2026&live=all'));
        if (!r.ok) return;
        var data = await r.json();
        var live = data.response || [];
        if (live.length > 0) {
            var badge = document.getElementById('copaLiveBadge');
            if (badge) badge.style.display = 'flex';
        }
    } catch(e) {
        console.log('[Copa] verificação live silenciosa');
    }
}

// Próximas partidas — carregadas ao clicar na aba
var proximasCarregadas = false;
async function loadProximasPartidas() {
    if (proximasCarregadas) return;
    var wrap = document.getElementById('partidasWrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="partidas-loading">⚽ Carregando partidas em tempo real...</div>';

    try {
        // Busca ao vivo + todas as partidas da Copa (fase de grupos: 11 jun – 2 jul)
        var results = await Promise.all([
            fetch('/api/football?endpoint=' + encodeURIComponent('fixtures?league=1&season=2026&live=all'))
                .then(function(r){ return r.ok ? r.json() : {response:[]}; }).catch(function(){ return {response:[]}; }),
            fetch('/api/football?endpoint=' + encodeURIComponent('fixtures?league=1&season=2026&from=2026-06-11&to=2026-07-19'))
                .then(function(r){ return r.ok ? r.json() : {response:[]}; }).catch(function(){ return {response:[]}; })
        ]);

        var live    = results[0].response || [];
        var allFixt = results[1].response || [];

        if (live.length === 0 && allFixt.length === 0) {
            wrap.innerHTML = '<div class="partidas-loading">⚽ Nenhuma partida encontrada ainda. A Copa começa em 11 de junho de 2026!</div>';
            return;
        }

        proximasCarregadas = true;

        // Separa ao vivo dos demais
        var liveIds = {};
        live.forEach(function(f){ liveIds[f.fixture.id] = true; });
        var resto = allFixt.filter(function(f){ return !liveIds[f.fixture.id]; });

        // Agrupa por rodada
        var rodadas = {};
        live.forEach(function(f) {
            var r = '🔴 AO VIVO'; if (!rodadas[r]) rodadas[r] = []; rodadas[r].push({f:f, isLive:true});
        });
        resto.forEach(function(f) {
            var r = f.league.round || 'Fase de Grupos'; if (!rodadas[r]) rodadas[r] = []; rodadas[r].push({f:f, isLive:false});
        });

        var html = '';
        Object.keys(rodadas).forEach(function(rodada) {
            html += '<div class="partidas-rodada-titulo">' + escapeHtml(rodada) + '</div>';
            rodadas[rodada].forEach(function(item) {
                var f = item.f;
                var isLive = item.isLive;
                var home = f.teams.home.name;
                var away = f.teams.away.name;
                var isBrasil = home.indexOf('Brazil') > -1 || away.indexOf('Brazil') > -1
                             || home.indexOf('Brasil') > -1 || away.indexOf('Brasil') > -1;
                var isEnd = f.fixture.status.short === 'FT';
                var sH = f.goals.home !== null ? f.goals.home : '';
                var sA = f.goals.away !== null ? f.goals.away : '';
                var min = f.fixture.status.elapsed ? f.fixture.status.elapsed + "'" : '';
                var dateObj = new Date(f.fixture.date);
                var dateStr = dateObj.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
                var timeStr = dateObj.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
                var local = f.fixture.venue && f.fixture.venue.name ? f.fixture.venue.name : '';

                html += '<div class="partida-card' + (isBrasil ? ' destaque-brasil' : '') + '">' +
                    '<div class="partida-info">' +
                        (isLive
                            ? '<span class="partida-grupo" style="color:#e50914">🔴 AO VIVO ' + min + '</span>'
                            : '<span class="partida-data">📅 ' + dateStr + '</span>') +
                        (!isLive ? '<span class="partida-horario">🕐 ' + timeStr + ' (Brasília)</span>' : '') +
                        (local ? '<span class="partida-local">📍 ' + escapeHtml(local) + '</span>' : '') +
                    '</div>' +
                    '<div class="partida-times">' +
                        '<div class="partida-time">' +
                            (f.teams.home.logo ? '<img src="'+f.teams.home.logo+'" alt="">' : '') +
                            '<span>' + escapeHtml(home) + '</span>' +
                        '</div>' +
                        (isLive || isEnd
                            ? '<span class="match-score">' + sH + ' × ' + sA + '</span>'
                            : '<span class="partida-vs">vs</span>') +
                        '<div class="partida-time">' +
                            (f.teams.away.logo ? '<img src="'+f.teams.away.logo+'" alt="">' : '') +
                            '<span>' + escapeHtml(away) + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
        });

        wrap.innerHTML = html || '<div class="partidas-loading">Nenhuma partida encontrada.</div>';

    } catch(e) {
        console.error('[Partidas]', e);
        wrap.innerHTML = '<div class="partidas-loading">⚠️ Erro ao carregar. Configure FOOTBALL_KEY no Render.</div>';
    }
}

// ══════════════════════════════════════════════
// MODAL SELEÇÃO — TEMPO REAL
// ══════════════════════════════════════════════
async function openSelecaoModal(nome, bandeira, grupo, teamId) {
    var modal   = document.getElementById('selecaoModal');
    var content = document.getElementById('selecaoContent');
    if (!modal || !content) return;

    // Mostra loading imediatamente
    content.innerHTML = '<div class="selecao-loading"><div class="selecao-loading-flag">' + bandeira + '</div><p>Buscando dados de <strong>' + nome + '</strong> em tempo real...</p></div>';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        // Busca jogos da seleção na Copa 2026 em paralelo
        var endpoints = [
            'fixtures?league=1&season=2026&team=' + teamId,
            'teams/statistics?league=1&season=2026&team=' + teamId,
        ];

        var results = await Promise.all(
            endpoints.map(function(ep) {
                return fetch('/api/football?endpoint=' + encodeURIComponent(ep))
                    .then(function(r) { return r.ok ? r.json() : { response: [] }; })
                    .catch(function() { return { response: [] }; });
            })
        );

        var fixtures = results[0].response || [];
        var stats    = results[1].response || null;

        renderSelecaoModal(nome, bandeira, grupo, fixtures, stats);

    } catch(e) {
        // Fallback estático se a API não estiver configurada
        renderSelecaoModalEstatico(nome, bandeira, grupo);
    }
}

function renderSelecaoModal(nome, bandeira, grupo, fixtures, stats) {
    var content = document.getElementById('selecaoContent');
    if (!content) return;

    var hoje = new Date().toISOString().split('T')[0];

    // Separa jogos passados e futuros
    var passados = fixtures.filter(function(f) {
        return f.fixture.date && f.fixture.date.split('T')[0] < hoje;
    });
    var futuros = fixtures.filter(function(f) {
        return f.fixture.date && f.fixture.date.split('T')[0] >= hoje;
    });
    var aoVivo = fixtures.filter(function(f) {
        return f.fixture.status.short === 'LIVE' || f.fixture.status.short === '1H' || f.fixture.status.short === '2H';
    });

    var html = '<div class="selecao-modal-header">' +
        '<span class="selecao-modal-flag">' + bandeira + '</span>' +
        '<div>' +
            '<h3 class="selecao-modal-nome">' + nome + '</h3>' +
            '<p class="selecao-modal-grupo">Grupo ' + grupo + ' · Copa do Mundo 2026</p>' +
        '</div>' +
    '</div>';

    // Estatísticas se disponíveis
    if (stats && stats.fixtures) {
        var v = stats.fixtures.wins && stats.fixtures.wins.total ? stats.fixtures.wins.total : 0;
        var e = stats.fixtures.draws && stats.fixtures.draws.total ? stats.fixtures.draws.total : 0;
        var d = stats.fixtures.loses && stats.fixtures.loses.total ? stats.fixtures.loses.total : 0;
        var gf = stats.goals && stats.goals.for && stats.goals.for.total && stats.goals.for.total.total ? stats.goals.for.total.total : 0;
        var gc = stats.goals && stats.goals.against && stats.goals.against.total && stats.goals.against.total.total ? stats.goals.against.total.total : 0;
        html += '<div class="selecao-stats-row">' +
            '<div class="selecao-stat-item"><span class="s-val green-val">' + v + '</span><span class="s-label">Vitórias</span></div>' +
            '<div class="selecao-stat-item"><span class="s-val yellow-val">' + e + '</span><span class="s-label">Empates</span></div>' +
            '<div class="selecao-stat-item"><span class="s-val red-val">' + d + '</span><span class="s-label">Derrotas</span></div>' +
            '<div class="selecao-stat-item"><span class="s-val">' + gf + '</span><span class="s-label">Gols Feitos</span></div>' +
            '<div class="selecao-stat-item"><span class="s-val">' + gc + '</span><span class="s-label">Gols Sofridos</span></div>' +
        '</div>';
    }

    // Jogo ao vivo
    if (aoVivo.length > 0) {
        var f = aoVivo[0];
        var sH = f.goals.home !== null ? f.goals.home : 0;
        var sA = f.goals.away !== null ? f.goals.away : 0;
        var min = f.fixture.status.elapsed ? f.fixture.status.elapsed + "'" : 'AO VIVO';
        html += '<div class="selecao-live-jogo">' +
            '<div class="selecao-live-label"><span class="live-dot"></span> AO VIVO — ' + min + '</div>' +
            '<div class="selecao-live-placar">' +
                '<div class="selecao-live-time">' +
                    (f.teams.home.logo ? '<img src="'+f.teams.home.logo+'" class="team-logo-lg" alt="">' : '') +
                    '<span>' + escapeHtml(f.teams.home.name) + '</span>' +
                '</div>' +
                '<div class="selecao-live-score">' + sH + ' × ' + sA + '</div>' +
                '<div class="selecao-live-time">' +
                    (f.teams.away.logo ? '<img src="'+f.teams.away.logo+'" class="team-logo-lg" alt="">' : '') +
                    '<span>' + escapeHtml(f.teams.away.name) + '</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    // Próximos jogos
    if (futuros.length > 0) {
        html += '<h4 class="selecao-jogos-title">📅 Próximos Jogos</h4><div class="selecao-jogos">';
        futuros.slice(0, 4).forEach(function(f) {
            var dateObj = new Date(f.fixture.date);
            var dateStr = dateObj.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });
            var timeStr = dateObj.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
            var isHome  = f.teams.home.name.toLowerCase().includes(nome.toLowerCase().split(' ')[0].toLowerCase());
            var adversario = isHome ? f.teams.away : f.teams.home;
            var fase = f.league.round || 'Fase de Grupos';
            html += '<div class="selecao-jogo">' +
                '<div class="selecao-jogo-info">' +
                    '<span class="selecao-jogo-fase">' + fase + '</span>' +
                    '<span class="selecao-jogo-data">📅 ' + dateStr + ' · ' + timeStr + '</span>' +
                '</div>' +
                '<div class="selecao-jogo-adversario">' +
                    (adversario.logo ? '<img src="'+adversario.logo+'" class="team-logo" alt="">' : '') +
                    '<span>vs ' + escapeHtml(adversario.name) + '</span>' +
                '</div>' +
                '<span class="match-status upcoming">Em breve</span>' +
            '</div>';
        });
        html += '</div>';
    }

    // Jogos passados (resultados)
    if (passados.length > 0) {
        html += '<h4 class="selecao-jogos-title">📊 Resultados</h4><div class="selecao-jogos">';
        passados.slice(-3).reverse().forEach(function(f) {
            var dateObj = new Date(f.fixture.date);
            var dateStr = dateObj.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' });
            var sH = f.goals.home !== null ? f.goals.home : '-';
            var sA = f.goals.away !== null ? f.goals.away : '-';
            html += '<div class="selecao-jogo">' +
                '<div class="selecao-jogo-info">' +
                    '<span class="selecao-jogo-data">📅 ' + dateStr + '</span>' +
                '</div>' +
                '<div class="match-teams" style="gap:6px">' +
                    (f.teams.home.logo ? '<img src="'+f.teams.home.logo+'" class="team-logo" alt="">' : '') +
                    '<span class="team-name" style="font-size:0.78rem">' + escapeHtml(f.teams.home.name) + '</span>' +
                    '<span class="match-score">' + sH + ' × ' + sA + '</span>' +
                    '<span class="team-name" style="font-size:0.78rem">' + escapeHtml(f.teams.away.name) + '</span>' +
                    (f.teams.away.logo ? '<img src="'+f.teams.away.logo+'" class="team-logo" alt="">' : '') +
                '</div>' +
                '<span class="match-status finished">Encerrado</span>' +
            '</div>';
        });
        html += '</div>';
    }

    if (fixtures.length === 0) {
        html += '<div class="selecao-sem-dados">⚽ Jogos da Copa do Mundo 2026 serão exibidos aqui quando confirmados pela FIFA.</div>';
    }

    html += '<p class="selecao-aviso">📺 Assista todos os jogos de <strong>' + nome + '</strong> ao vivo no VLTV Play em HD e 4K</p>' +
        '<button class="btn-modal-submit" style="margin-top:14px;" onclick="closeSelecaoModal();openModal(\'Copa do Mundo 2026\')">🎬 Garantir Meu Acesso</button>';

    content.innerHTML = html;
}

function renderSelecaoModalEstatico(nome, bandeira, grupo) {
    var content = document.getElementById('selecaoContent');
    if (!content) return;
    content.innerHTML =
        '<div class="selecao-modal-header">' +
            '<span class="selecao-modal-flag">' + bandeira + '</span>' +
            '<div><h3 class="selecao-modal-nome">' + nome + '</h3>' +
            '<p class="selecao-modal-grupo">Grupo ' + grupo + ' · Copa do Mundo 2026</p></div>' +
        '</div>' +
        '<div class="selecao-modal-info">' +
            '<div class="selecao-info-item"><span>🏆</span><span>Copa do Mundo 2026</span></div>' +
            '<div class="selecao-info-item"><span>📍</span><span>EUA · Canadá · México</span></div>' +
            '<div class="selecao-info-item"><span>📅</span><span>11 Jun — 19 Jul 2026</span></div>' +
        '</div>' +
        '<div class="selecao-sem-dados">⚽ Configure a chave FOOTBALL_KEY no Render para ver os jogos em tempo real.</div>' +
        '<p class="selecao-aviso">📺 Assista todos os jogos de <strong>' + nome + '</strong> ao vivo no VLTV Play em HD e 4K</p>' +
        '<button class="btn-modal-submit" style="margin-top:14px;" onclick="closeSelecaoModal();openModal(\'Copa do Mundo 2026\')">🎬 Garantir Meu Acesso</button>';
}

function closeSelecaoModal() {
    var m = document.getElementById('selecaoModal');
    if (m) m.classList.remove('active');
    document.body.style.overflow = '';
}
function handleSelecaoClick(e) {
    if (e.target === document.getElementById('selecaoModal')) closeSelecaoModal();
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
        box.offsetHeight; // força reflow
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


// ── DADOS ESTÁTICOS DOS GRUPOS (fallback se API não retornar) ──
var GRUPOS_ESTATICOS = {
    A: { selecoes: [{flag:'🇲🇽',nome:'México'},{flag:'🇿🇦',nome:'África do Sul'},{flag:'🇰🇷',nome:'Coreia do Sul'},{flag:'🇨🇿',nome:'Rep. Tcheca'}] },
    B: { selecoes: [{flag:'🇨🇦',nome:'Canadá'},{flag:'🇧🇦',nome:'Bósnia-Herz.'},{flag:'🇶🇦',nome:'Catar'},{flag:'🇨🇭',nome:'Suíça'}] },
    C: { selecoes: [{flag:'🇧🇷',nome:'Brasil'},{flag:'🇲🇦',nome:'Marrocos'},{flag:'🇭🇹',nome:'Haiti'},{flag:'🏴󠁧󠁢󠁳󠁣󠁴󠁿',nome:'Escócia'}] },
    D: { selecoes: [{flag:'🇺🇸',nome:'EUA'},{flag:'🇵🇾',nome:'Paraguai'},{flag:'🇦🇺',nome:'Austrália'},{flag:'🇹🇷',nome:'Turquia'}] },
    E: { selecoes: [{flag:'🇩🇪',nome:'Alemanha'},{flag:'🇨🇼',nome:'Curaçao'},{flag:'🇨🇮',nome:'Costa do Marfim'},{flag:'🇪🇨',nome:'Equador'}] },
    F: { selecoes: [{flag:'🇳🇱',nome:'Holanda'},{flag:'🇯🇵',nome:'Japão'},{flag:'🇹🇳',nome:'Tunísia'},{flag:'🇺🇦',nome:'Ucrânia'}] },
    G: { selecoes: [{flag:'🇧🇪',nome:'Bélgica'},{flag:'🇪🇬',nome:'Egito'},{flag:'🇮🇷',nome:'Irã'},{flag:'🇳🇿',nome:'Nova Zelândia'}] },
    H: { selecoes: [{flag:'🇪🇸',nome:'Espanha'},{flag:'🇨🇻',nome:'Cabo Verde'},{flag:'🇸🇦',nome:'Arábia Saudita'},{flag:'🇺🇾',nome:'Uruguai'}] },
    I: { selecoes: [{flag:'🇫🇷',nome:'França'},{flag:'🇸🇳',nome:'Senegal'},{flag:'🇳🇴',nome:'Noruega'},{flag:'🇮🇶',nome:'Iraque'}] },
    J: { selecoes: [{flag:'🇦🇷',nome:'Argentina'},{flag:'🇩🇿',nome:'Argélia'},{flag:'🇦🇹',nome:'Áustria'},{flag:'🇯🇴',nome:'Jordânia'}] },
    K: { selecoes: [{flag:'🇵🇹',nome:'Portugal'},{flag:'🇺🇿',nome:'Uzbequistão'},{flag:'🇨🇴',nome:'Colômbia'},{flag:'🇨🇩',nome:'RD Congo'}] },
    L: { selecoes: [{flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿',nome:'Inglaterra'},{flag:'🇭🇷',nome:'Croácia'},{flag:'🇬🇭',nome:'Gana'},{flag:'🇵🇦',nome:'Panamá'}] }
};

// ══════════════════════════════════════════════
// MODAL GRUPO — CLASSIFICAÇÃO + JOGOS
// ══════════════════════════════════════════════
async function openGrupoModal(grupo) {
    var modal   = document.getElementById('grupoModal');
    var content = document.getElementById('grupoModalContent');
    if (!modal || !content) return;

    var isBrasil = grupo === 'C';
    content.innerHTML = '<div class="selecao-loading">⚽ Carregando classificação do Grupo ' + grupo + '...</div>';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    try {
        // Busca standings + TODAS as fixtures da Copa (filtramos por grupo no JS)
        var results = await Promise.all([
            fetch('/api/football?endpoint=' + encodeURIComponent('standings?league=1&season=2026'))
                .then(function(r){ return r.ok ? r.json() : {response:[]}; })
                .catch(function(){ return {response:[]}; }),
            fetch('/api/football?endpoint=' + encodeURIComponent('fixtures?league=1&season=2026&from=2026-06-11&to=2026-07-19'))
                .then(function(r){ return r.ok ? r.json() : {response:[]}; })
                .catch(function(){ return {response:[]}; })
        ]);

        var standingsData = results[0].response || [];
        var allFixtures   = results[1].response || [];

        // Filtra fixtures do grupo: round contém "Group X" ou "Grupo X"
        var fixturesData = allFixtures.filter(function(f) {
            var round = (f.league.round || '').toUpperCase();
            return round.indexOf('GROUP ' + grupo) > -1 || round.indexOf('GRUPO ' + grupo) > -1;
        });

        // Tenta extrair o grupo dos standings
        var grupoStandings = null;
        if (standingsData.length > 0 && standingsData[0].league && standingsData[0].league.standings) {
            var allStandings = standingsData[0].league.standings;
            for (var i = 0; i < allStandings.length; i++) {
                var s = allStandings[i];
                if (s.length > 0 && s[0].group && s[0].group.toUpperCase().indexOf('GROUP ' + grupo) > -1) {
                    grupoStandings = s;
                    break;
                }
            }
        }

        renderGrupoModal(grupo, grupoStandings, fixturesData);

    } catch(e) {
        console.error('[GrupoModal]', e);
        renderGrupoModalEstatico(grupo);
    }
}

function renderGrupoModal(grupo, standings, fixtures) {
    var content = document.getElementById('grupoModalContent');
    if (!content) return;
    var estatico = GRUPOS_ESTATICOS[grupo] || { selecoes: [] };
    var isBrasil = grupo === 'C';

    var html = '<div class="grupo-modal-header">' +
        '<div>' +
            '<div class="grupo-modal-titulo">Grupo ' + grupo + '</div>' +
            '<div class="grupo-modal-sub">Copa do Mundo 2026 — Classificação</div>' +
        '</div>' +
    '</div>';

    // TABELA DE CLASSIFICAÇÃO
    html += '<h4 class="grupo-jogos-titulo">📊 Classificação</h4>';
    html += '<table class="classificacao-table"><thead><tr>' +
        '<th>#</th><th style="text-align:left">Seleção</th>' +
        '<th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th>' +
    '</tr></thead><tbody>';

    if (standings && standings.length > 0) {
        // Dados reais da API
        standings.forEach(function(team, idx) {
            var isBR = team.team && (team.team.name === 'Brazil' || team.team.name === 'Brasil');
            html += '<tr class="' + (isBR ? 'class-brasil' : '') + '">' +
                '<td class="class-pos">' + team.rank + '</td>' +
                '<td><div class="class-time">' +
                    (team.team.logo ? '<img src="'+team.team.logo+'" alt="">' : '') +
                    '<span>' + escapeHtml(team.team.name) + '</span>' +
                '</div></td>' +
                '<td class="class-pts">' + team.points + '</td>' +
                '<td>' + (team.all ? team.all.played : 0) + '</td>' +
                '<td>' + (team.all ? team.all.win : 0) + '</td>' +
                '<td>' + (team.all ? team.all.draw : 0) + '</td>' +
                '<td>' + (team.all ? team.all.lose : 0) + '</td>' +
                '<td>' + (team.all && team.all.goals ? team.all.goals.for : 0) + '</td>' +
                '<td>' + (team.all && team.all.goals ? team.all.goals.against : 0) + '</td>' +
                '<td>' + (team.goalsDiff || 0) + '</td>' +
            '</tr>';
        });
    } else {
        // Fallback estático — torneio não começou
        estatico.selecoes.forEach(function(s, idx) {
            var isBR = s.nome === 'Brasil';
            html += '<tr class="' + (isBR ? 'class-brasil' : '') + '">' +
                '<td class="class-pos">—</td>' +
                '<td><div class="class-time"><span style="font-size:1.1rem">' + s.flag + '</span><span>' + s.nome + '</span></div></td>' +
                '<td class="class-pts">0</td>' +
                '<td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td>' +
            '</tr>';
        });
        html += '</tbody></table>';
        html += '<div class="selecao-sem-dados" style="margin-bottom:16px">⏳ A fase de grupos começa em 11 de junho. A classificação será atualizada em tempo real.</div>';
    }

    if (standings && standings.length > 0) {
        html += '</tbody></table>';
    }

    // JOGOS DO GRUPO
    if (fixtures && fixtures.length > 0) {
        html += '<h4 class="grupo-jogos-titulo" style="margin-top:20px">📅 Jogos do Grupo</h4>';

        // Agrupa por rodada
        var rodadas = {};
        fixtures.forEach(function(f) {
            var rodada = f.league.round || 'Fase de Grupos';
            if (!rodadas[rodada]) rodadas[rodada] = [];
            rodadas[rodada].push(f);
        });

        Object.keys(rodadas).forEach(function(rodada) {
            html += '<div class="grupo-jogos-titulo" style="color:var(--red);margin-top:14px;margin-bottom:8px">' + escapeHtml(rodada) + '</div>';
            rodadas[rodada].forEach(function(f) {
                var home = f.teams.home.name;
                var away = f.teams.away.name;
                var dateObj = new Date(f.fixture.date);
                var dateStr = dateObj.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
                var timeStr = dateObj.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
                var local = f.fixture.venue && f.fixture.venue.name ? f.fixture.venue.name : '';
                var isLive = f.fixture.status.short === 'LIVE' || f.fixture.status.short === '1H' || f.fixture.status.short === '2H' || f.fixture.status.short === 'HT';
                var isEnd = f.fixture.status.short === 'FT';
                var sH = f.goals.home !== null ? f.goals.home : '';
                var sA = f.goals.away !== null ? f.goals.away : '';
                var isBR = home.indexOf('Brazil') > -1 || away.indexOf('Brazil') > -1 || home.indexOf('Brasil') > -1 || away.indexOf('Brasil') > -1;
                var min = f.fixture.status.elapsed ? f.fixture.status.elapsed + "'" : '';

                html += '<div class="grupo-jogo-item' + (isBR ? '" style="border-color:rgba(229,9,20,0.4)' : '') + '">' +
                    '<div class="grupo-jogo-meta">' +
                        '<span class="grupo-jogo-data">📅 ' + dateStr + ' · ' + timeStr + ' (Brasília)</span>' +
                        (local ? '<span class="grupo-jogo-local">📍 ' + escapeHtml(local) + '</span>' : '') +
                        (isLive ? '<span class="grupo-jogo-status-live">🔴 ' + min + '</span>' : '') +
                        (isEnd ? '<span class="grupo-jogo-status-live" style="color:#888">Encerrado</span>' : '') +
                    '</div>' +
                    '<div class="grupo-jogo-times">' +
                        '<div class="grupo-jogo-time">' +
                            (f.teams.home.logo ? '<img src="'+f.teams.home.logo+'" alt="">' : '') +
                            '<span>' + escapeHtml(home) + '</span>' +
                        '</div>' +
                        (isLive || isEnd
                            ? '<div class="grupo-jogo-score">' + sH + ' × ' + sA + '</div>'
                            : '<div class="grupo-jogo-vs">vs</div>') +
                        '<div class="grupo-jogo-time away">' +
                            '<span>' + escapeHtml(away) + '</span>' +
                            (f.teams.away.logo ? '<img src="'+f.teams.away.logo+'" alt="">' : '') +
                        '</div>' +
                    '</div>' +
                '</div>';
            });
        });
    } else {
        // Sem fixtures — mostra mensagem
        html += '<div class="selecao-sem-dados">📅 Os jogos deste grupo serão exibidos aqui quando a API sincronizar os dados.</div>';
    }

    html += '<div class="grupo-cta">' +
        '<button class="btn-modal-submit" onclick="closeGrupoModal();openModal(\'Copa do Mundo 2026\')">🎬 Assistir no VLTV Play — HD &amp; 4K</button>' +
    '</div>';

    content.innerHTML = html;
}

function renderGrupoModalEstatico(grupo) {
    var content = document.getElementById('grupoModalContent');
    if (!content) return;
    var estatico = GRUPOS_ESTATICOS[grupo] || { selecoes: [] };

    var html = '<div class="grupo-modal-header">' +
        '<div><div class="grupo-modal-titulo">Grupo ' + grupo + '</div>' +
        '<div class="grupo-modal-sub">Copa do Mundo 2026</div></div></div>';

    html += '<h4 class="grupo-jogos-titulo">📊 Seleções do Grupo</h4>';
    html += '<table class="classificacao-table"><thead><tr>' +
        '<th>#</th><th style="text-align:left">Seleção</th>' +
        '<th>P</th><th>J</th><th>V</th><th>E</th><th>D</th>' +
    '</tr></thead><tbody>';

    estatico.selecoes.forEach(function(s) {
        var isBR = s.nome === 'Brasil';
        html += '<tr class="' + (isBR ? 'class-brasil' : '') + '">' +
            '<td class="class-pos">—</td>' +
            '<td><div class="class-time"><span style="font-size:1.1rem">' + s.flag + '</span><span>' + s.nome + '</span></div></td>' +
            '<td class="class-pts">0</td><td>0</td><td>0</td><td>0</td><td>0</td>' +
        '</tr>';
    });

    html += '</tbody></table>' +
        '<div class="selecao-sem-dados">⏳ Configure FOOTBALL_KEY no Render para ver dados em tempo real.</div>' +
        '<div class="grupo-cta"><button class="btn-modal-submit" onclick="closeGrupoModal();openModal(\'Copa do Mundo 2026\')">🎬 Assistir no VLTV Play</button></div>';

    content.innerHTML = html;
}

function closeGrupoModal() {
    var m = document.getElementById('grupoModal');
    if (m) m.classList.remove('active');
    document.body.style.overflow = '';
}
function handleGrupoModalClick(e) {
    if (e.target === document.getElementById('grupoModal')) closeGrupoModal();
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', function() {
    loadNowPlaying();
    loadMovies();
    loadSeries();
    loadCopaMundoData();
});
