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

// ── TMDB via backend ──
async function tmdb(endpoint) {
    const r = await fetch('/api/tmdb?endpoint=' + encodeURIComponent(endpoint));
    if (!r.ok) throw new Error('TMDB ' + r.status);
    return r.json();
}

// ── CARROSSEL: swipe touch + drag mouse ──
function buildCarousel(trackEl, viewEl, prevEl, nextEl) {
    const CARD_W = 170 + 14;
    let pos = 0, dragging = false, startX = 0, startPos = 0;

    function clamp(v) {
        return Math.max(0, Math.min(v, Math.max(0, trackEl.scrollWidth - viewEl.clientWidth)));
    }
    function move(p, animate = true) {
        pos = clamp(p);
        trackEl.style.transition = animate ? 'transform .4s ease' : 'none';
        trackEl.style.transform  = `translateX(-${pos}px)`;
    }

    prevEl.addEventListener('click', () => move(pos - CARD_W * 2));
    nextEl.addEventListener('click', () => move(pos + CARD_W * 2));

    trackEl.addEventListener('mousedown', e => { dragging=true; startX=e.clientX; startPos=pos; trackEl.style.transition='none'; });
    window.addEventListener('mousemove', e => { if(dragging) move(startPos-(e.clientX-startX), false); });
    window.addEventListener('mouseup',   () => { if(dragging){ dragging=false; trackEl.style.transition='transform .4s ease'; } });

    trackEl.addEventListener('touchstart', e => { startX=e.touches[0].clientX; startPos=pos; trackEl.style.transition='none'; }, {passive:true});
    trackEl.addEventListener('touchmove',  e => { move(startPos-(e.touches[0].clientX-startX), false); }, {passive:true});
    trackEl.addEventListener('touchend',   () => { trackEl.style.transition='transform .4s ease'; });
}

// ── CRIAR CARD ──
function createCard(item, isTV) {
    const poster = item.poster_path
        ? 'https://image.tmdb.org/t/p/w342' + item.poster_path
        : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342';
    const title  = item.title || item.name || '';
    const date   = item.release_date || item.first_air_date || '';
    const dateF  = date ? date.split('-').reverse().join('/') : 'Em breve';
    const rating = item.vote_average && item.vote_average > 0 ? '⭐ ' + item.vote_average.toFixed(1) : '';

    const today = new Date(); today.setHours(0,0,0,0);
    const rel   = date ? new Date(date+'T00:00:00') : null;
    const diff  = rel ? (rel - today) / 86400000 : 999;
    const isNew = diff >= 0 && diff <= 7;

    const card = document.createElement('div');
    card.className = 'media-card';
    card.innerHTML = `
        ${isNew ? '<div class="new-badge">🔥 Esta semana</div>' : ''}
        <img src="${poster}" alt="${title}" loading="lazy"
             onerror="this.src='https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342'">
        <div class="media-card-info">
            <div class="media-card-title">${title}</div>
            <div class="media-card-date">📆 ${dateF}</div>
            ${rating ? `<div class="media-card-rating">${rating}</div>` : ''}
        </div>`;
    card.addEventListener('click', () => openMediaModal(item, isTV));
    return card;
}

// ── CARREGAR FILMES EM CARTAZ NOS CINEMAS (Conectado ao TMDB) ──
async function loadNowPlaying() {
    const track = document.getElementById('trackNowPlaying');
    const view  = document.getElementById('viewNowPlaying');
    try {
        const data = await tmdb('/movie/now_playing?language=pt-BR&page=1&region=BR');
        const movies = (data.results || []).filter(m => m.poster_path && m.title);
        if (!movies.length) {
            track.innerHTML = '<div class="loading-card">Nenhum filme em cartaz encontrado.</div>';
            return;
        }
        track.innerHTML = '';
        movies.forEach(m => track.appendChild(createCard(m, false)));
        buildCarousel(track, view, document.getElementById('prevNowPlaying'), document.getElementById('nextNowPlaying'));
    } catch (e) {
        console.error(e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar filmes em cartaz.</div>';
    }
}

// ── CARREGAR FILMES (futuros + populares, sem séries antigas) ──
async function loadMovies() {
    const track = document.getElementById('trackMovies');
    const view  = document.getElementById('viewMovies');
    try {
        const r = await fetch('/api/upcoming');
        if (!r.ok) throw new Error(r.status);
        const data = await r.json();
        const movies = (data.results || []).filter(m => m.poster_path && (m.title || m.name));
        if (!movies.length) {
            track.innerHTML = '<div class="loading-card">Nenhum filme encontrado.</div>';
            return;
        }
        track.innerHTML = '';
        movies.forEach(m => track.appendChild(createCard(m, false)));
        buildCarousel(track, view, document.getElementById('prevMovies'), document.getElementById('nextMovies'));
    } catch (e) {
        console.error(e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar lançamentos.</div>';
    }
}

// ── CARREGAR SÉRIES ──
async function loadSeries() {
    const track = document.getElementById('trackSeries');
    const view  = document.getElementById('viewSeries');
    try {
        const data = await tmdb('/tv/on_the_air?language=pt-BR&page=1');
        const series = (data.results || []).filter(s => s.poster_path && s.name);
        if (!series.length) {
            track.innerHTML = '<div class="loading-card">Nenhuma série encontrada.</div>';
            return;
        }
        track.innerHTML = '';
        series.forEach(s => track.appendChild(createCard(s, true)));
        buildCarousel(track, view, document.getElementById('prevSeries'), document.getElementById('nextSeries'));
    } catch (e) {
        console.error(e);
        track.innerHTML = '<div class="loading-card">Erro ao carregar séries.</div>';
    }
}

// ── ALTERNAR ABAS ──
function switchTab(tabId, btnEl) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btnEl.classList.add('active');
    document.getElementById('panel-' + tabId).classList.add('active');
}

// ── MODAL CAPTURA ──
function openModal(planName) {
    currentPlan = planName;
    document.getElementById('modalTitle').innerText = planName === 'Geral' ? 'Solicitar Teste Grátis' : `Assinar Plano ${planName}`;
    document.getElementById('modalCapture').style.display = 'flex';
}
function closeModal() {
    document.getElementById('modalCapture').style.display = 'none';
}
function handleCapture(e) {
    e.preventDefault();
    const name = document.getElementById('capName').value.trim();
    const tel  = document.getElementById('capTel').value.trim();
    const dev  = document.getElementById('capDevice').value;

    let text = `Olá, gostaria de um teste!%0A*Nome:* ${name}%0A*WhatsApp:* ${tel}%0A*Aparelho:* ${dev}`;
    if (currentPlan !== 'Geral') {
        text = `Olá, gostaria de contratar um plano!%0A*Plano:* ${currentPlan}%0A*Nome:* ${name}%0A*WhatsApp:* ${tel}%0A*Aparelho:* ${dev}`;
    }
    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP}&text=${text}`, '_blank');
    closeModal();
}

// ── MODAL DETALHES COMPLETO (TMDB VINCULADO) ──
async function openMediaModal(item, isTV) {
    document.getElementById('mTitle').innerText = item.title || item.name || '';
    const date = item.release_date || item.first_air_date || '';
    document.getElementById('mDate').innerText = date ? '📆 ' + date.split('-').reverse().join('/') : '📆 Em breve';
    document.getElementById('mRating').innerText = item.vote_average ? '⭐ ' + item.vote_average.toFixed(1) : '⭐ 0.0';
    document.getElementById('mOverview').innerText = item.overview || 'Sinopse não disponível em português.';

    const poster = item.poster_path
        ? 'https://image.tmdb.org/t/p/w342' + item.poster_path
        : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=342';
    document.getElementById('mPoster').src = poster;

    const gDiv = document.getElementById('mGenres'); gDiv.innerHTML = '';
    const ids = item.genre_ids || [];
    const dict = isTV ? GENRES_TV : GENRES_MOVIE;
    ids.forEach(id => {
        if (dict[id]) { gDiv.innerHTML += `<span>${dict[id]}</span>`; }
    });

    const castEl = document.getElementById('mCast');
    castEl.innerText = 'Carregando elenco...';
    document.getElementById('mediaModal').style.display = 'flex';

    try {
        const type = isTV ? 'tv' : 'movie';
        const credits = await tmdb(`/${type}/${item.id}/credits?language=pt-BR`);
        const names = (credits.cast || []).slice(0, 5).map(c => c.name);
        castEl.innerText = names.length ? names.join(', ') : 'Informação não disponível';
    } catch (e) {
        castEl.innerText = 'Não foi possível carregar o elenco.';
    }
}
function closeMediaModal() {
    document.getElementById('mediaModal').style.display = 'none';
}

// ── FAQ TOGGLE ──
function toggleFaq(el) {
    el.classList.toggle('open');
}

// ── CHATBOT HISTÓRICO ──
let chatHistory = [];
function toggleChat() {
    const box = document.getElementById('chatBox');
    box.classList.toggle('open');
    if (box.classList.contains('open')) {
        document.getElementById('chatBadge').style.display = 'none';
    }
}
function ftime() {
    const d = new Date();
    return d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0');
}
function scrollChat() {
    const m = document.getElementById('chatMessages');
    m.scrollTop = m.scrollHeight;
}
function addMsg(html, sender) {
    const msgs = document.getElementById('chatMessages');
    const d = document.createElement('div'); d.className = `chat-msg ${sender}`;
    d.innerHTML = `<div class="chat-bubble">${html}</div><div class="chat-time">${ftime()}</div>`;
    msgs.appendChild(d); scrollChat();
}
function addTyping() {
    const msgs = document.getElementById('chatMessages');
    const d = document.createElement('div'); d.className = 'chat-msg bot typing-indicator'; d.id = 'typingDot';
    d.innerHTML = '<div class="chat-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    msgs.appendChild(d); scrollChat();
}
function removeTyping() {
    const t = document.getElementById('typingDot'); if(t) t.remove();
}
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const txt = input.value.trim(); if(!txt) return;
    input.value = ''; addMsg(txt,'user');
    chatHistory.push({role:'user',parts:[{text:txt}]});
    addTyping();
    try {
        const r = await fetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({history:chatHistory})});
        const data = await r.json(); removeTyping();
        const reply = data.reply || 'Não consegui processar sua mensagem. Por favor, chame nosso suporte no WhatsApp!';
        chatHistory.push({role:'model',parts:[{text:reply}]});
        addMsg(reply.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>'), 'bot');
    } catch(e) {
        removeTyping(); addMsg('Erro ao conectar com o servidor. Tente novamente.', 'bot');
    }
}
function handleChatKey(e) {
    if(e.key === 'Enter') sendChatMessage();
}

// ── ONLOAD ──
window.onload = () => {
    loadNowPlaying();
    loadMovies();
    loadSeries();
};
