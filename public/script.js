// =============================================
// VLTV Play — script.js
// Chat usa Gemini via backend seguro /api/chat
// =============================================

const TMDB_API_KEY   = '9b73f5dd15b8165b1b57419be2f29128';
const WHATSAPP_NUMBER = '5531998491711';
let currentPlanContext = 'Geral';

const GENRES = {
    28:'Ação', 12:'Aventura', 16:'Animação', 35:'Comédia', 80:'Crime',
    99:'Documentário', 18:'Drama', 10751:'Família', 14:'Fantasia', 36:'História',
    27:'Terror', 10402:'Música', 9648:'Mistério', 10749:'Romance',
    878:'Ficção Científica', 10770:'TV Movie', 53:'Thriller', 10752:'Guerra', 37:'Faroeste'
};

// ── CARROSSEL ──
const movieTrack = document.getElementById('movieTrack');
const prevBtn    = document.getElementById('prevBtn');
const nextBtn    = document.getElementById('nextBtn');
let scrollAmount = 0;
const cardWidth  = 250;

function isComingSoon(dateStr) {
    if (!dateStr) return false;
    const release = new Date(dateStr);
    const today   = new Date();
    const diff    = (release - today) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
}

async function fetchUpcomingMovies() {
    try {
        const res  = await fetch(`https://api.themoviedb.org/3/movie/upcoming?api_key=${TMDB_API_KEY}&language=pt-BR&page=1`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
            movieTrack.innerHTML = '<div class="loading-text">Nenhum lançamento encontrado no momento.</div>';
            return;
        }

        movieTrack.innerHTML = '';

        for (const movie of data.results) {
            const card        = document.createElement('div');
            card.className    = 'movie-card';

            const posterUrl   = movie.poster_path
                ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=400';
            const releaseDate = movie.release_date ? movie.release_date.split('-').reverse().join('/') : 'Em breve';
            const releaseYear = movie.release_date ? movie.release_date.split('-')[0] : '';
            const genreNames  = (movie.genre_ids || []).slice(0, 2).map(id => GENRES[id]).filter(Boolean).join(' • ');
            const comingSoon  = isComingSoon(movie.release_date);
            const badgeHtml   = comingSoon ? '<div class="coming-soon-badge">🔥 Estreia essa semana!</div>' : '';

            let logoHtml = `<div class="movie-fallback-title">${movie.title}</div>`;
            try {
                const imgRes  = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/images?api_key=${TMDB_API_KEY}`);
                const imgData = await imgRes.json();
                const logo    = (imgData.logos || []).find(l => l.iso_639_1 === 'en' || l.iso_639_1 === 'pt' || !l.iso_639_1);
                if (logo) logoHtml = `<img src="https://image.tmdb.org/t/p/w300${logo.file_path}" class="movie-logo-img" alt="${movie.title}">`;
            } catch (_) {}

            let directorHtml = '';
            try {
                const credRes  = await fetch(`https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${TMDB_API_KEY}&language=pt-BR`);
                const credData = await credRes.json();
                const director = (credData.crew || []).find(p => p.job === 'Director');
                if (director) directorHtml = `<div class="movie-meta">🎬 Dir.: ${director.name}</div>`;
            } catch (_) {}

            card.innerHTML = `
                ${badgeHtml}
                <img src="${posterUrl}" alt="${movie.title}" class="movie-poster">
                <div class="movie-info">
                    <div class="movie-logo-container">${logoHtml}</div>
                    <div class="movie-meta">📆 Estreia: ${releaseDate}${releaseYear ? ' (' + releaseYear + ')' : ''}</div>
                    ${genreNames  ? `<div class="movie-meta">🎭 ${genreNames}</div>` : ''}
                    ${directorHtml}
                    <div class="movie-meta movie-rating">⭐ ${movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A'}</div>
                </div>`;
            movieTrack.appendChild(card);
        }

        Array.from(movieTrack.children).forEach(c => movieTrack.appendChild(c.cloneNode(true)));

    } catch (err) {
        console.error('Erro TMDB:', err);
        movieTrack.innerHTML = '<div class="loading-text">Erro ao carregar lançamentos. Tente novamente mais tarde.</div>';
    }
}

nextBtn.addEventListener('click', () => {
    const maxScroll = movieTrack.scrollWidth / 2;
    scrollAmount += cardWidth;
    if (scrollAmount >= maxScroll) {
        movieTrack.style.transition = 'none';
        scrollAmount = 0;
        movieTrack.style.transform = `translateX(0)`;
        setTimeout(() => {
            movieTrack.style.transition = 'transform 0.5s ease-in-out';
            scrollAmount = cardWidth;
            movieTrack.style.transform = `translateX(-${scrollAmount}px)`;
        }, 20);
    } else {
        movieTrack.style.transition = 'transform 0.5s ease-in-out';
        movieTrack.style.transform = `translateX(-${scrollAmount}px)`;
    }
});

prevBtn.addEventListener('click', () => {
    const maxScroll = movieTrack.scrollWidth / 2;
    scrollAmount -= cardWidth;
    if (scrollAmount < 0) {
        movieTrack.style.transition = 'none';
        scrollAmount = maxScroll - cardWidth;
        movieTrack.style.transform = `translateX(-${scrollAmount}px)`;
        setTimeout(() => {
            movieTrack.style.transition = 'transform 0.5s ease-in-out';
            scrollAmount -= cardWidth;
            if (scrollAmount < 0) scrollAmount = 0;
            movieTrack.style.transform = `translateX(-${scrollAmount}px)`;
        }, 20);
    } else {
        movieTrack.style.transition = 'transform 0.5s ease-in-out';
        movieTrack.style.transform = `translateX(-${scrollAmount}px)`;
    }
});

// ── FAQ ──
document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-question').addEventListener('click', () => {
        const active = document.querySelector('.faq-item.active');
        if (active && active !== item) active.classList.remove('active');
        item.classList.toggle('active');
    });
});

// ── MODAL ──
function openModal(context) {
    currentPlanContext = context;
    document.getElementById('modalTitle').innerText =
        context === 'Geral' ? 'Solicitar Teste Grátis' : `Teste para ${context}`;
    document.getElementById('testModal').classList.add('active');
}
function closeModal() {
    document.getElementById('testModal').classList.remove('active');
}
function sendWhatsApp() {
    const device = document.getElementById('deviceSelect').value;
    const text   = currentPlanContext === 'Geral'
        ? `Olá! Gostaria de solicitar um teste gratuito para o meu dispositivo: ${device}.`
        : `Olá! Tenho interesse no ${currentPlanContext}. Gostaria de solicitar um teste gratuito para o meu dispositivo: ${device}.`;
    window.open(`https://api.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(text)}`, '_blank');
    closeModal();
}

// ── CHAT IA (Gemini via backend /api/chat) ──
let chatOpen = false;
const chatHistory = [];

function toggleChat() {
    chatOpen = !chatOpen;
    const chatBox   = document.getElementById('chatBox');
    const chatIcon  = document.querySelector('.chat-icon');
    const closeIcon = document.querySelector('.close-icon');
    const badge     = document.getElementById('chatBadge');

    if (chatOpen) {
        chatBox.style.display = 'flex';
        setTimeout(() => chatBox.classList.add('open'), 10);
        chatIcon.style.display  = 'none';
        closeIcon.style.display = 'block';
        if (badge) badge.style.display = 'none';
        scrollChatToBottom();
    } else {
        chatBox.classList.remove('open');
        chatIcon.style.display  = 'block';
        closeIcon.style.display = 'none';
        setTimeout(() => { chatBox.style.display = 'none'; }, 260);
    }
}

function handleChatKey(e) { if (e.key === 'Enter') sendChatMessage(); }

function scrollChatToBottom() {
    const msgs = document.getElementById('chatMessages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function formatTime() {
    const n = new Date();
    return String(n.getHours()).padStart(2,'0') + ':' + String(n.getMinutes()).padStart(2,'0');
}

function addMessage(html, sender) {
    const msgs    = document.getElementById('chatMessages');
    const div     = document.createElement('div');
    div.className = `chat-msg ${sender}`;
    div.innerHTML = `<div class="chat-bubble">${html}</div><div class="chat-time">${formatTime()}</div>`;
    msgs.appendChild(div);
    scrollChatToBottom();
}

function addTypingIndicator() {
    const msgs    = document.getElementById('chatMessages');
    const div     = document.createElement('div');
    div.className = 'chat-msg bot typing-indicator';
    div.id        = 'typingIndicator';
    div.innerHTML = `<div class="chat-bubble"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>`;
    msgs.appendChild(div);
    scrollChatToBottom();
}

function removeTypingIndicator() {
    const t = document.getElementById('typingIndicator');
    if (t) t.remove();
}

async function sendChatMessage() {
    const input    = document.getElementById('chatInput');
    const userText = input.value.trim();
    if (!userText) return;

    input.value = '';
    addMessage(userText, 'user');
    chatHistory.push({ role: 'user', parts: [{ text: userText }] });
    addTypingIndicator();

    try {
        const res  = await fetch('/api/chat', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ history: chatHistory })
        });

        const data  = await res.json();
        removeTypingIndicator();

        const reply = data.reply || 'Desculpe, não consegui processar sua pergunta. Fale conosco no WhatsApp! 😊';
        chatHistory.push({ role: 'model', parts: [{ text: reply }] });
        addMessage(reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'), 'bot');

    } catch (err) {
        removeTypingIndicator();
        addMessage('Ops! Tive um probleminha de conexão. Fale diretamente com nossa equipe no WhatsApp. 💬', 'bot');
        console.error('Erro chat:', err);
    }
}

// ── INIT ──
window.addEventListener('DOMContentLoaded', fetchUpcomingMovies);
