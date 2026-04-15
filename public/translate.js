const socket = io();
const $ = (id) => document.getElementById(id);
let availableLanguages = {};

const state = {
  fixedEventId: new URLSearchParams(window.location.search).get('event') || '',
  currentEvent: null,
  currentLanguage: new URLSearchParams(window.location.search).get('lang') || 'no',
  currentDisplayMode: 'auto',
  manualTranslations: {},
  latestLiveEntry: null
};

function langLabel(code) { return availableLanguages[code] || code.toUpperCase(); }
function setStatus(text) { const el = $('translateStatus'); if (el) el.textContent = text; }

function detectPreferredSupportedLanguage(available = []) {
  const candidates = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const raw of candidates) {
    const code = String(raw).toLowerCase();
    if ((code.startsWith('nb') || code.startsWith('nn') || code.startsWith('no')) && available.includes('no')) return 'no';
    if (code.startsWith('ro') && available.includes('ro')) return 'ro';
    if (code.startsWith('ru') && available.includes('ru')) return 'ru';
    if (code.startsWith('uk') && available.includes('uk')) return 'uk';
    if (code.startsWith('en') && available.includes('en')) return 'en';
    if (code.startsWith('es') && available.includes('es')) return 'es';
    if (code.startsWith('fr') && available.includes('fr')) return 'fr';
    if (code.startsWith('de') && available.includes('de')) return 'de';
    if (code.startsWith('it') && available.includes('it')) return 'it';
    if (code.startsWith('pt') && available.includes('pt')) return 'pt';
    if (code.startsWith('pl') && available.includes('pl')) return 'pl';
    if (code.startsWith('tr') && available.includes('tr')) return 'tr';
    if (code.startsWith('ar') && available.includes('ar')) return 'ar';
    if (code.startsWith('fa') && available.includes('fa')) return 'fa';
    if (code.startsWith('hu') && available.includes('hu')) return 'hu';
  }
  return available[0] || 'en';
}

function syncLanguageOptions(event) {
  const select = $('translateLanguage');
  if (!select) return;
  const available = Array.from(new Set(event?.targetLangs || []));
  select.innerHTML = available.map((code) => `<option value="${code}">${langLabel(code)}</option>`).join('');
  if (!available.includes(state.currentLanguage)) state.currentLanguage = detectPreferredSupportedLanguage(available);
  select.value = state.currentLanguage;
}

function getTextToDisplay() {
  if (state.currentDisplayMode === 'manual') {
    return state.manualTranslations?.[state.currentLanguage] || 'Aștept textul manual...';
  }
  if (state.latestLiveEntry) {
    return state.latestLiveEntry.translations?.[state.currentLanguage] || state.latestLiveEntry.original || 'Aștept traducerea...';
  }
  return 'Aștept traducerea...';
}

function updateMeta() {
  $('translateModeBadge').textContent = state.currentDisplayMode === 'manual' ? 'Manual' : 'Auto';
  $('translateLanguageLabel').textContent = langLabel(state.currentLanguage);
  $('translateEventName').textContent = state.currentEvent?.name || 'BPMS Translate';
}

function autoFitText() {
  const box = $('translateText');
  const wrap = $('translateTextWrap');
  if (!box || !wrap) return;
  box.style.fontSize = '';
  let size = Math.min(Math.max(Math.floor(wrap.clientWidth / 11), 28), 118);
  box.style.fontSize = `${size}px`;
  while (size > 26 && (box.scrollHeight > wrap.clientHeight || box.scrollWidth > wrap.clientWidth)) {
    size -= 2;
    box.style.fontSize = `${size}px`;
  }
}

function renderDisplay() {
  $('translateText').textContent = getTextToDisplay();
  updateMeta();
  requestAnimationFrame(autoFitText);
}

async function enterFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  } catch (_) {}
}

async function resolveEventId() {
  if (state.fixedEventId) return state.fixedEventId;
  try {
    const res = await fetch('/api/events/active');
    const data = await res.json();
    if (data.ok && data.event?.id) return data.event.id;
  } catch (_) {}
  return '';
}

async function joinEvent() {
  const eventId = await resolveEventId();
  if (!eventId) {
    setStatus('Nu există eveniment activ.');
    return;
  }
  socket.emit('join_event', {
    eventId,
    role: 'participant',
    language: state.currentLanguage,
    participantId: `display_${state.currentLanguage}`
  });
}

function handleLanguageChange() {
  state.currentLanguage = $('translateLanguage').value;
  if (state.currentEvent?.id) {
    socket.emit('participant_language', {
      eventId: state.currentEvent.id,
      language: state.currentLanguage
    });
  }
  renderDisplay();
}

socket.on('connect', async () => {
  setStatus('Conectare...');
  await joinEvent();
});

socket.on('disconnect', () => setStatus('Reconectare...'));

socket.on('joined_event', ({ event, languageNames }) => {
  if (languageNames) availableLanguages = languageNames;
  state.currentEvent = event;
  state.currentDisplayMode = event.displayState?.mode || 'auto';
  state.manualTranslations = event.displayState?.manualTranslations || {};
  state.latestLiveEntry = (event.transcripts || []).slice().sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)).pop() || null;
  syncLanguageOptions(event);
  renderDisplay();
  setStatus('Conectat.');
});

socket.on('transcript_entry', (entry) => {
  if (state.currentDisplayMode !== 'auto') return;
  state.latestLiveEntry = entry;
  renderDisplay();
});

socket.on('display_live_entry', (entry) => {
  if (state.currentDisplayMode !== 'auto') return;
  state.latestLiveEntry = entry;
  renderDisplay();
});

socket.on('transcript_source_updated', (payload) => {
  if (state.currentDisplayMode !== 'auto') return;
  if (!state.latestLiveEntry || state.latestLiveEntry.id !== payload.entryId) return;
  state.latestLiveEntry = {
    ...state.latestLiveEntry,
    sourceLang: payload.sourceLang,
    original: payload.original,
    translations: payload.translations || {}
  };
  renderDisplay();
});

socket.on('display_mode_changed', ({ mode, manualTranslations }) => {
  state.currentDisplayMode = mode || 'auto';
  state.manualTranslations = manualTranslations || state.manualTranslations || {};
  renderDisplay();
});

socket.on('display_manual_update', ({ mode, manualTranslations }) => {
  state.currentDisplayMode = mode || 'manual';
  state.manualTranslations = manualTranslations || {};
  renderDisplay();
});

socket.on('active_event_changed', async () => {
  if (!state.fixedEventId) await joinEvent();
});

$('translateLanguage')?.addEventListener('change', handleLanguageChange);
$('fullscreenBtn')?.addEventListener('click', enterFullscreen);
window.addEventListener('resize', autoFitText);
document.addEventListener('fullscreenchange', autoFitText);
window.addEventListener('load', async () => {
  try {
    const res = await fetch('/api/languages');
    const data = await res.json();
    availableLanguages = data.languages || {};
  } catch (_) {}
});
