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

// ── TMDB via proxy backend ──
async function tmdb(endpoint) {
    var r = await fetch('/api/tmdb?endpoint=' + encodeURIComponent(endpoint));
    if (!r.ok) throw new Error('TMDB ' + r.status);
    return r.json();
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
            fetch('/api/nowplaying?page=1').then(function(r){ return r.json(); }),
            fetch('/api/nowplaying?page=2').then(function(r){ return r.json(); }),
            fetch('/api/nowplaying?page=3').then(function(r){ return r.json(); }),
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
        var r = await fetch('/api/upcoming');
        if (!r.ok) throw new Error(r.status);
        var data = await r.json();
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
async function loadCopaMundoData() {
    try {
        // Busca jogos AO VIVO da Copa 2026 (league=1)
        var r = await fetch('/api/football?endpoint=' + encodeURIComponent('fixtures?league=1&season=2026&live=all'));
        if (!r.ok) return;
        var data = await r.json();
        var live = data.response || [];

        if (live.length > 0) {
            document.getElementById('copaLiveBadge').style.display = 'flex';
            document.getElementById('copaMatchesTitle').textContent = '🔴 Jogos Ao Vivo — Copa do Mundo 2026';
            renderMatches(live, true);
        } else {
            // Busca próximos jogos
            var r2 = await fetch('/api/football?endpoint=' + encodeURIComponent('fixtures?league=1&season=2026&next=6'));
            if (!r2.ok) return;
            var data2 = await r2.json();
            var next = data2.response || [];
            if (next.length > 0) {
                document.getElementById('copaMatchesTitle').textContent = '⚡ Próximas Partidas — Copa do Mundo 2026';
                renderMatches(next, false);
            }
        }
    } catch(e) {
        console.log('[Copa] API Football não configurada — exibindo dados estáticos');
    }
}

function renderMatches(fixtures, isLive) {
    var container = document.getElementById('copaMatches');
    if (!container) return;
    var html = '';

    fixtures.slice(0, 4).forEach(function(f) {
        var home   = f.teams.home.name;
        var away   = f.teams.away.name;
        var homeLogo = f.teams.home.logo || '';
        var awayLogo = f.teams.away.logo || '';

        if (isLive) {
            var scoreH = f.goals.home !== null ? f.goals.home : '0';
            var scoreA = f.goals.away !== null ? f.goals.away : '0';
            var min    = f.fixture.status.elapsed ? f.fixture.status.elapsed + "'" : 'AO VIVO';
            html += '<div class="match-card">' +
                '<div class="match-date">⚽ ' + min + ' — AO VIVO</div>' +
                '<div class="match-teams">' +
                    (homeLogo ? '<img src="'+homeLogo+'" class="team-logo" alt="">' : '') +
                    '<span class="team-name">' + escapeHtml(home) + '</span>' +
                    '<span class="match-score">' + scoreH + ' × ' + scoreA + '</span>' +
                    '<span class="team-name">' + escapeHtml(away) + '</span>' +
                    (awayLogo ? '<img src="'+awayLogo+'" class="team-logo" alt="">' : '') +
                '</div>' +
                '<span class="match-status live">🔴 Ao Vivo</span>' +
            '</div>';
        } else {
            var dateObj = new Date(f.fixture.date);
            var dateStr = dateObj.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
            var timeStr = dateObj.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
            var stadium = f.fixture.venue && f.fixture.venue.name ? f.fixture.venue.name : '';
            html += '<div class="match-card">' +
                '<div class="match-date">📅 ' + dateStr + ' · ' + timeStr + (stadium ? ' · ' + stadium : '') + '</div>' +
                '<div class="match-teams">' +
                    (homeLogo ? '<img src="'+homeLogo+'" class="team-logo" alt="">' : '') +
                    '<span class="team-name">' + escapeHtml(home) + '</span>' +
                    '<span class="match-vs">vs</span>' +
                    '<span class="team-name">' + escapeHtml(away) + '</span>' +
                    (awayLogo ? '<img src="'+awayLogo+'" class="team-logo" alt="">' : '') +
                '</div>' +
                '<span class="match-status upcoming">Em breve</span>' +
            '</div>';
        }
    });

    // Card CTA
    html += '<div class="match-card highlight-match">' +
        '<div class="match-badge-copa">🔥 Assistir no VLTV Play</div>' +
        '<div class="match-date">Todos os ' + fixtures.length + '+ jogos em HD & 4K</div>' +
        '<div class="match-teams"><span class="team-flag">🏆</span><span class="team-name">Copa do Mundo 2026</span></div>' +
        '<button class="btn-copa-cta" onclick="openModal(\'Copa do Mundo 2026\')">Garantir Meu Acesso</button>' +
    '</div>';

    container.innerHTML = html;
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

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', function() {
    loadNowPlaying();
    loadMovies();
    loadSeries();
    loadCopaMundoData();
});
