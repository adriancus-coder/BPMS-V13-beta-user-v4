const socket = io();
const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(window.location.search);
const state = {
  eventId: params.get('event') || '',
  accessCode: params.get('code') || '',
  currentEvent: null,
  availableLanguages: {}
};

function langLabel(code) {
  return state.availableLanguages[code] || String(code || '').toUpperCase();
}

function setStatus(text) {
  $('remoteStatus').textContent = text;
}

function eventCodeOptions(method, payload = {}) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, code: state.accessCode })
  };
}

function updateHeader() {
  $('remoteEventName').textContent = state.currentEvent?.name || 'Remote control';
  const displayState = state.currentEvent?.displayState || {};
  const modeLabel = displayState.blackScreen
    ? 'Black screen'
    : ({ auto: 'Live follow', manual: 'Pinned text', song: 'Song' }[displayState.mode] || 'Live follow');
  $('remoteModeBadge').textContent = displayState.sceneLabel || modeLabel;
  $('remoteLanguageBadge').textContent = displayState.blackScreen ? '-' : langLabel(displayState.language || 'no');
  $('remoteSongLabel').textContent = state.currentEvent?.songState?.blockLabels?.[state.currentEvent?.songState?.currentIndex] || 'No active verse';
}

function renderQuickLanguages() {
  const box = $('remoteQuickLanguages');
  const langs = state.currentEvent?.targetLangs || [];
  if (!langs.length) {
    box.innerHTML = '<div class="muted">Waiting for event languages...</div>';
    return;
  }
  box.innerHTML = langs.map((lang) => {
    const active = state.currentEvent?.displayState?.language === lang;
    return `<button class="btn ${active ? 'btn-primary' : 'btn-dark'}" type="button" data-remote-language="${lang}">${langLabel(lang)}</button>`;
  }).join('');
}

function renderPresets() {
  const box = $('remotePresetsList');
  const presets = state.currentEvent?.displayPresets || [];
  if (!presets.length) {
    box.innerHTML = '<div class="muted">No presets available.</div>';
    return;
  }
  box.innerHTML = presets.map((preset) => `
    <div class="history-item">
      <div><b>${preset.name}</b></div>
      <div class="actions">
        <button class="btn btn-primary" type="button" data-remote-preset="${preset.id}">Apply</button>
      </div>
    </div>
  `).join('');
}

function refreshRemoteUi() {
  const displayState = state.currentEvent?.displayState || {};
  const activeMode = displayState.blackScreen ? 'blank' : (displayState.mode || 'auto');
  [
    { id: 'remoteLiveBtn', active: activeMode === 'auto', activeClass: 'btn-primary' },
    { id: 'remotePinnedBtn', active: activeMode === 'manual', activeClass: 'btn-primary' },
    { id: 'remoteSongBtn', active: activeMode === 'song', activeClass: 'btn-primary' },
    { id: 'remoteBlackBtn', active: activeMode === 'blank', activeClass: 'btn-danger' }
  ].forEach(({ id, active, activeClass }) => {
    const btn = $(id);
    if (!btn) return;
    btn.classList.remove('btn-primary', 'btn-danger', 'btn-dark');
    btn.classList.add(active ? activeClass : 'btn-dark');
  });
  updateHeader();
  renderQuickLanguages();
  renderPresets();
}

async function post(path, payload = {}) {
  const res = await fetch(path, eventCodeOptions('POST', payload));
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Request failed.');
  if (data.event) state.currentEvent = data.event;
  if (data.displayState && state.currentEvent) {
    state.currentEvent.displayState = data.displayState;
  }
  if (data.presets && state.currentEvent) {
    state.currentEvent.displayPresets = data.presets;
  }
  refreshRemoteUi();
  return data;
}

async function join() {
  if (!state.eventId || !state.accessCode) {
    setStatus('Missing event or operator code.');
    return;
  }
  socket.emit('join_event', {
    eventId: state.eventId,
    role: 'screen',
    code: state.accessCode
  });
}

socket.on('connect', join);
socket.on('disconnect', () => setStatus('Reconnecting...'));
socket.on('join_error', ({ message }) => setStatus(message || 'Cannot join remote control.'));
socket.on('joined_event', ({ role, event }) => {
  if (role !== 'screen') return;
  state.currentEvent = event;
  refreshRemoteUi();
  setStatus('Remote control connected.');
});
socket.on('display_mode_changed', (payload) => {
  if (!state.currentEvent) return;
  state.currentEvent.displayState = {
    ...(state.currentEvent.displayState || {}),
    ...payload
  };
  if (Array.isArray(payload.presets)) state.currentEvent.displayPresets = payload.presets;
  refreshRemoteUi();
});
socket.on('display_manual_update', (payload) => {
  if (!state.currentEvent) return;
  state.currentEvent.displayState = {
    ...(state.currentEvent.displayState || {}),
    ...payload
  };
  if (Array.isArray(payload.presets)) state.currentEvent.displayPresets = payload.presets;
  refreshRemoteUi();
});
socket.on('song_state', (songState) => {
  if (!state.currentEvent) return;
  state.currentEvent.songState = songState;
  refreshRemoteUi();
});
socket.on('song_clear', () => {
  if (!state.currentEvent) return;
  state.currentEvent.songState = null;
  refreshRemoteUi();
});
socket.on('display_presets_updated', ({ presets }) => {
  if (!state.currentEvent) return;
  state.currentEvent.displayPresets = presets || [];
  refreshRemoteUi();
});

$('remoteLiveBtn').addEventListener('click', async () => {
  try { await post(`/api/events/${state.eventId}/display/mode`, { mode: 'auto' }); setStatus('Main screen set to live follow.'); } catch (err) { setStatus(err.message); }
});
$('remotePinnedBtn').addEventListener('click', async () => {
  try { await post(`/api/events/${state.eventId}/display/mode`, { mode: 'manual' }); setStatus('Main screen set to pinned text.'); } catch (err) { setStatus(err.message); }
});
$('remoteSongBtn').addEventListener('click', async () => {
  try { await post(`/api/events/${state.eventId}/display/mode`, { mode: 'song' }); setStatus('Main screen set to Song mode.'); } catch (err) { setStatus(err.message); }
});
$('remoteBlackBtn').addEventListener('click', async () => {
  try { await post(`/api/events/${state.eventId}/display/blank`); setStatus('Main screen set to black screen.'); } catch (err) { setStatus(err.message); }
});
$('remoteUndoBtn').addEventListener('click', async () => {
  try { await post(`/api/events/${state.eventId}/display/restore-last`); setStatus('Restored previous screen state.'); } catch (err) { setStatus(err.message); }
});
$('remotePrevSongBtn').addEventListener('click', async () => {
  try { await post(`/api/events/${state.eventId}/song/prev`); setStatus('Moved to previous verse.'); } catch (err) { setStatus(err.message); }
});
$('remoteNextSongBtn').addEventListener('click', async () => {
  try { await post(`/api/events/${state.eventId}/song/next`); setStatus('Moved to next verse.'); } catch (err) { setStatus(err.message); }
});

$('remoteQuickLanguages').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-remote-language]');
  if (!btn) return;
  try {
    await post(`/api/events/${state.eventId}/display/language`, { language: btn.getAttribute('data-remote-language') });
    setStatus('Screen language updated.');
  } catch (err) {
    setStatus(err.message);
  }
});

$('remoteShortcuts').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-remote-shortcut]');
  if (!btn) return;
  try {
    await post(`/api/events/${state.eventId}/display/shortcut`, {
      shortcut: btn.getAttribute('data-remote-shortcut'),
      language: state.currentEvent?.displayState?.language || 'no'
    });
    setStatus('Service shortcut applied.');
  } catch (err) {
    setStatus(err.message);
  }
});

$('remotePresetsList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-remote-preset]');
  if (!btn) return;
  try {
    await post(`/api/events/${state.eventId}/display-presets/${btn.getAttribute('data-remote-preset')}/apply`);
    setStatus('Preset applied.');
  } catch (err) {
    setStatus(err.message);
  }
});

window.addEventListener('load', async () => {
  try {
    const res = await fetch('/api/languages');
    const data = await res.json();
    state.availableLanguages = data.languages || {};
  } catch (_) {}
  refreshRemoteUi();
  await join();
});
