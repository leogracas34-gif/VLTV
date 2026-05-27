// =============================================
// VLTV Play — script.js
// =============================================

const WHATSAPP_NUMBER = '5531998491711';
let currentPlanContext = 'Geral';

// ══════════════════════════════════════
// HERO SLIDER
// ══════════════════════════════════════
const slides     = document.querySelectorAll('.slide');
const dots       = document.querySelectorAll('.dot');
const sliderPrev = document.getElementById('sliderPrev');
const sliderNext = document.getElementById('sliderNext');
let currentSlide = 0;
let sliderTimer  = null;

function goToSlide(index) {
    slides[currentSlide].classList.remove('active');
    dots[currentSlide].classList.remove('active');
    currentSlide = (index + slides.length) % slides.length;
    slides[currentSlide].classList.add('active');
    dots[currentSlide].classList.add('active');
}

function nextSlide() { goToSlide(currentSlide + 1); }
function prevSlide() { goToSlide(currentSlide - 1); }

function startAutoSlide() {
    clearInterval(sliderTimer);
    sliderTimer = setInterval(nextSlide, 5500);
}

if (sliderNext) sliderNext.addEventListener('click', () => { nextSlide(); startAutoSlide(); });
if (sliderPrev) sliderPrev.addEventListener('click', () => { prevSlide(); startAutoSlide(); });
dots.forEach(dot => {
    dot.addEventListener('click', () => {
        goToSlide(parseInt(dot.dataset.index));
        startAutoSlide();
    });
});

startAutoSlide();

// ══════════════════════════════════════
// FAQ
// ══════════════════════════════════════
document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-question').addEventListener('click', () => {
        const active = document.querySelector('.faq-item.active');
        if (active && active !== item) active.classList.remove('active');
        item.classList.toggle('active');
    });
});

// ══════════════════════════════════════
// MODAL
// ══════════════════════════════════════
function openModal(context) {
    currentPlanContext = context;
    document.getElementById('modalTitle').innerText =
        context === 'Geral' ? 'Solicitar Teste Grátis' : `Teste — ${context}`;
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
// Fecha modal clicando fora
document.getElementById('testModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

// ══════════════════════════════════════
// CHAT IA (Gemini via /api/chat)
// ══════════════════════════════════════
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
        requestAnimationFrame(() => chatBox.classList.add('open'));
        if (chatIcon)  chatIcon.style.display  = 'none';
        if (closeIcon) closeIcon.style.display = 'block';
        if (badge)     badge.style.display     = 'none';
        scrollChatToBottom();
    } else {
        chatBox.classList.remove('open');
        if (chatIcon)  chatIcon.style.display  = 'block';
        if (closeIcon) closeIcon.style.display = 'none';
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
    const msgs = document.getElementById('chatMessages');
    const div  = document.createElement('div');
    div.className = 'chat-msg bot typing-indicator';
    div.id        = 'typingIndicator';
    div.innerHTML = `<div class="chat-bubble">
        <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>`;
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
        addMessage(
            reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
            'bot'
        );
    } catch (err) {
        removeTypingIndicator();
        addMessage('Ops! Tive um probleminha de conexão. Fale diretamente com nossa equipe no WhatsApp. 💬', 'bot');
        console.error('Erro chat:', err);
    }
}
