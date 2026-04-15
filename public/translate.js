const socket = io();
const $ = (id) => document.getElementById(id);
let availableLanguages = {};

const params = new URLSearchParams(window.location.search);
const state = {
  fixedEventId: params.get('event') || '',
  currentEvent: null,
  currentLanguage: params.get('lang') || 'no',
  currentDisplayMode: 'auto',
  currentTheme: 'dark',
  manualTranslations: {},
  latestLiveEntry: null,
  songState: null
};

function langLabel(code) {
  return availableLanguages[code] || code.toUpperCase();
}

function setStatus(text) {
  const el = $('translateStatus');
  if (el) el.textContent = text;
}

function detectPreferredSupportedLanguage(available = []) {
  const candidates = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const raw of candidates) {
    const code = String(raw).toLowerCase();
    if ((code.startsWith('nb') || code.startsWith('nn') || code.startsWith('no')) && available.includes('no')) return 'no';
    for (const short of available) {
      if (code.startsWith(short)) return short;
    }
  }
  return available[0] || 'en';
}

function syncLanguageOptions(event) {
  const select = $('translateLanguage');
  if (!select) return;
  const available = Array.from(new Set(event?.targetLangs || []));
  select.innerHTML = available
    .map((code) => `<option value="${code}">${langLabel(code)}</option>`)
    .join('');
  if (!available.includes(state.currentLanguage)) {
    state.currentLanguage = detectPreferredSupportedLanguage(available);
  }
  select.value = state.currentLanguage;
}

function applyDisplayTheme(theme) {
  document.body.classList.remove('display-theme-dark', 'display-theme-light');
  document.body.classList.add(theme === 'light' ? 'display-theme-light' : 'display-theme-dark');
}

function getTextToDisplay() {
  if (state.currentEvent?.mode === 'song' && state.songState) {
    return state.songState.translations?.[state.currentLanguage]
      || state.songState.activeBlock
      || 'Waiting for song translation...';
  }
  if (state.currentDisplayMode === 'manual') {
    return state.manualTranslations?.[state.currentLanguage] || 'Astept textul manual...';
  }
  if (state.latestLiveEntry) {
    return state.latestLiveEntry.translations?.[state.currentLanguage]
      || state.latestLiveEntry.original
      || 'Waiting for translation...';
  }
  return 'Waiting for translation...';
}

function updateMeta() {
  const isSongMode = state.currentEvent?.mode === 'song';
  $('translateModeBadge').textContent = isSongMode ? 'Song mode' : (state.currentDisplayMode === 'manual' ? 'Manual' : 'Auto');
  $('translateLanguageLabel').textContent = langLabel(state.currentLanguage);
  $('translateEventName').textContent = state.currentEvent?.name || 'BPMS Main Screen';
  $('translateScreenLabel').textContent = isSongMode ? 'Song mode' : 'Live translation';
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
  applyDisplayTheme(state.currentTheme);
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
    setStatus('Nu exista eveniment activ.');
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
  setStatus('Connecting...');
  await joinEvent();
});

socket.on('disconnect', () => setStatus('Reconnecting...'));

socket.on('joined_event', ({ event, languageNames }) => {
  if (languageNames) availableLanguages = languageNames;
  state.currentEvent = event;
  state.currentDisplayMode = event.displayState?.mode || 'auto';
  state.currentTheme = event.displayState?.theme || 'dark';
  state.manualTranslations = event.displayState?.manualTranslations || {};
  state.songState = event.songState || null;
  state.latestLiveEntry = (event.transcripts || [])
    .slice()
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    .pop() || null;
  syncLanguageOptions(event);
  renderDisplay();
  setStatus('Connected.');
});

socket.on('mode_changed', ({ mode }) => {
  if (!state.currentEvent) return;
  state.currentEvent.mode = mode || 'live';
  renderDisplay();
});

socket.on('song_state', (songState) => {
  state.songState = songState;
  if (state.currentEvent) state.currentEvent.mode = 'song';
  renderDisplay();
});

socket.on('song_clear', () => {
  state.songState = null;
  if (state.currentEvent) state.currentEvent.mode = 'live';
  renderDisplay();
});

socket.on('transcript_entry', (entry) => {
  if (state.currentEvent?.mode === 'song' || state.currentDisplayMode !== 'auto') return;
  state.latestLiveEntry = entry;
  renderDisplay();
});

socket.on('display_live_entry', (entry) => {
  if (state.currentEvent?.mode === 'song' || state.currentDisplayMode !== 'auto') return;
  state.latestLiveEntry = entry;
  renderDisplay();
});

socket.on('transcript_source_updated', (payload) => {
  if (state.currentEvent?.mode === 'song' || state.currentDisplayMode !== 'auto') return;
  if (!state.latestLiveEntry || state.latestLiveEntry.id !== payload.entryId) return;
  state.latestLiveEntry = {
    ...state.latestLiveEntry,
    sourceLang: payload.sourceLang,
    original: payload.original,
    translations: payload.translations || {}
  };
  renderDisplay();
});

socket.on('display_mode_changed', ({ mode, theme, manualTranslations }) => {
  state.currentDisplayMode = mode || 'auto';
  state.currentTheme = theme || state.currentTheme || 'dark';
  state.manualTranslations = manualTranslations || state.manualTranslations || {};
  renderDisplay();
});

socket.on('display_theme_changed', ({ theme }) => {
  state.currentTheme = theme || 'dark';
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
document.addEventListener('fullscreenchange', () => {
  document.body.classList.toggle('display-fullscreen', !!document.fullscreenElement);
  autoFitText();
});

window.addEventListener('load', async () => {
  try {
    const res = await fetch('/api/languages');
    const data = await res.json();
    availableLanguages = data.languages || {};
  } catch (_) {}
});
