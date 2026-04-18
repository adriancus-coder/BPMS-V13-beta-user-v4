const socket = io();
const $ = (id) => document.getElementById(id);

const params = new URLSearchParams(window.location.search);
const state = {
  eventId: params.get('event') || '',
  accessCode: params.get('code') || '',
  currentEvent: null,
  availableLanguages: {},
  access: null
};

const remoteProfileLabels = {
  main_screen: 'Main Screen only',
  song_only: 'Song only',
  main_and_song: 'Main Screen + Song',
  full: 'Full operator'
};

function langLabel(code) {
  return state.availableLanguages[code] || String(code || '').toUpperCase();
}

function setStatus(text) {
  $('remoteStatus').textContent = text;
}

function can(permission) {
  const permissions = state.access?.permissions || [];
  if (!permissions.length) return true;
  return permissions.includes(permission);
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
  const profileBadge = $('remoteAccessProfileBadge');
  if (profileBadge) {
    const profile = state.access?.operator?.profile || '';
    profileBadge.textContent = remoteProfileLabels[profile] || 'Remote operator';
  }
}

function populateRemoteLanguageSelects() {
  const available = Object.entries(state.availableLanguages || {});
  const songLangSelect = $('remoteSongSourceLang');
  const glossaryLangSelect = $('remoteGlossaryLang');
  [songLangSelect, glossaryLangSelect].forEach((select) => {
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = available.map(([code, label]) => `<option value="${code}">${label}</option>`).join('');
    if (currentValue && state.availableLanguages[currentValue]) {
      select.value = currentValue;
    } else if (state.currentEvent?.sourceLang && state.availableLanguages[state.currentEvent.sourceLang]) {
      select.value = state.currentEvent.sourceLang;
    } else if (available[0]?.[0]) {
      select.value = available[0][0];
    }
  });
}

function updateRemoteGlossaryMode() {
  const mode = $('remoteGlossaryMode')?.value || 'translation';
  const translationFields = $('remoteTranslationGlossaryFields');
  const sourceFields = $('remoteSourceCorrectionFields');
  const langWrap = $('remoteGlossaryLangWrap');
  if (translationFields) translationFields.style.display = mode === 'translation' ? 'grid' : 'none';
  if (sourceFields) sourceFields.style.display = mode === 'source' ? 'grid' : 'none';
  if (langWrap) langWrap.style.display = mode === 'translation' ? 'block' : 'none';
}

function clearRemoteSongEditor() {
  if ($('remoteSongTitle')) $('remoteSongTitle').value = '';
  if ($('remoteSongText')) $('remoteSongText').value = '';
  if ($('remoteSongSourceLang')) $('remoteSongSourceLang').value = state.currentEvent?.sourceLang || 'ro';
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
  const mainScreenAllowed = can('main_screen');
  const songAllowed = can('song');
  const glossaryAllowed = can('glossary');
  [
    { id: 'remoteLiveBtn', active: activeMode === 'auto', activeClass: 'btn-primary', visible: mainScreenAllowed },
    { id: 'remotePinnedBtn', active: activeMode === 'manual', activeClass: 'btn-primary', visible: mainScreenAllowed },
    { id: 'remoteSongBtn', active: activeMode === 'song', activeClass: 'btn-primary', visible: songAllowed },
    { id: 'remoteBlackBtn', active: activeMode === 'blank', activeClass: 'btn-danger', visible: mainScreenAllowed },
    { id: 'remoteUndoBtn', active: false, activeClass: 'btn-primary', visible: mainScreenAllowed }
  ].forEach(({ id, active, activeClass, visible }) => {
    const btn = $(id);
    if (!btn) return;
    btn.hidden = !visible;
    btn.disabled = !visible;
    btn.classList.remove('btn-primary', 'btn-danger', 'btn-dark');
    btn.classList.add(active ? activeClass : 'btn-dark');
  });
  const quickLanguages = $('remoteQuickLanguages');
  const shortcuts = $('remoteShortcuts');
  const presetsList = $('remotePresetsList');
  const mainScreenPanel = $('remoteMainScreenPanel');
  const songPanel = $('remotePrevSongBtn')?.closest('.panel');
  const presetsPanel = presetsList?.closest('.panel');
  const songEditorPanel = $('remoteSongEditorPanel');
  const glossaryPanel = $('remoteGlossaryPanel');
  if (mainScreenPanel) mainScreenPanel.hidden = !mainScreenAllowed;
  if (quickLanguages) quickLanguages.hidden = !mainScreenAllowed;
  if (shortcuts) shortcuts.hidden = !mainScreenAllowed;
  if (songPanel) songPanel.hidden = !songAllowed;
  if (presetsPanel) presetsPanel.hidden = !mainScreenAllowed;
  if (songEditorPanel) songEditorPanel.hidden = !songAllowed;
  if (glossaryPanel) glossaryPanel.hidden = !glossaryAllowed;
  updateHeader();
  populateRemoteLanguageSelects();
  updateRemoteGlossaryMode();
  if (mainScreenAllowed) {
    renderQuickLanguages();
    renderPresets();
  }
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
socket.on('joined_event', ({ role, event, access }) => {
  if (role !== 'screen') return;
  state.currentEvent = event;
  state.access = access || null;
  clearRemoteSongEditor();
  refreshRemoteUi();
  setStatus(access?.operator?.name ? `Remote control connected as ${access.operator.name}.` : 'Remote control connected.');
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

$('remoteOpenMainPreviewBtn').addEventListener('click', () => {
  const url = state.currentEvent?.translateLink || '';
  if (url) window.open(url, '_blank');
});

$('remoteOpenParticipantPreviewBtn').addEventListener('click', () => {
  const url = state.currentEvent?.participantLink || '';
  if (url) window.open(url, '_blank');
});

$('remoteOpenBothPreviewsBtn').addEventListener('click', () => {
  const mainUrl = state.currentEvent?.translateLink || '';
  const participantUrl = state.currentEvent?.participantLink || '';
  if (mainUrl) window.open(mainUrl, '_blank');
  if (participantUrl) window.open(participantUrl, '_blank');
});

$('remoteSongClearBtn').addEventListener('click', () => {
  clearRemoteSongEditor();
  setStatus('Song editor cleared.');
});

$('remoteSongSaveBtn').addEventListener('click', async () => {
  const title = $('remoteSongTitle')?.value.trim() || '';
  const text = $('remoteSongText')?.value.trim() || '';
  const sourceLang = $('remoteSongSourceLang')?.value || state.currentEvent?.sourceLang || 'ro';
  if (!title || !text) return setStatus('Add title and song text first.');
  try {
    const res = await fetch(`/api/events/${state.eventId}/global-song-library`, eventCodeOptions('POST', { title, text, labels: [], sourceLang }));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not save song.');
    clearRemoteSongEditor();
    setStatus('Song saved to church library.');
  } catch (err) {
    setStatus(err.message);
  }
});

$('remoteSongSendBtn').addEventListener('click', async () => {
  const title = $('remoteSongTitle')?.value.trim() || '';
  const text = $('remoteSongText')?.value.trim() || '';
  const sourceLang = $('remoteSongSourceLang')?.value || state.currentEvent?.sourceLang || 'ro';
  if (!text) return setStatus('Add song text first.');
  try {
    const res = await fetch(`/api/events/${state.eventId}/song/load`, eventCodeOptions('POST', { title, text, labels: [], sourceLang }));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not send song.');
    state.currentEvent = data.event || state.currentEvent;
    refreshRemoteUi();
    setStatus('Song loaded and first verse sent live.');
  } catch (err) {
    setStatus(err.message);
  }
});

$('remoteGlossaryMode').addEventListener('change', updateRemoteGlossaryMode);

$('remoteSaveGlossaryBtn').addEventListener('click', async () => {
  const source = $('remoteGlossarySource')?.value.trim() || '';
  const target = $('remoteGlossaryTarget')?.value.trim() || '';
  const lang = $('remoteGlossaryLang')?.value || '';
  const permanent = !!$('remoteGlossaryPermanent')?.checked;
  if (!source || !target || !lang) return setStatus('Complete glossary fields first.');
  try {
    const res = await fetch(`/api/events/${state.eventId}/glossary`, eventCodeOptions('POST', { source, target, lang, permanent }));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not save glossary item.');
    $('remoteGlossarySource').value = '';
    $('remoteGlossaryTarget').value = '';
    setStatus('Glossary item saved.');
  } catch (err) {
    setStatus(err.message);
  }
});

$('remoteSaveSourceCorrectionBtn').addEventListener('click', async () => {
  const heard = $('remoteSourceWrong')?.value.trim() || '';
  const correct = $('remoteSourceCorrect')?.value.trim() || '';
  const permanent = !!$('remoteGlossaryPermanent')?.checked;
  if (!heard || !correct) return setStatus('Complete correction fields first.');
  try {
    const res = await fetch(`/api/events/${state.eventId}/source-corrections`, eventCodeOptions('POST', { heard, correct, permanent }));
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not save correction.');
    $('remoteSourceWrong').value = '';
    $('remoteSourceCorrect').value = '';
    setStatus('Speech correction saved.');
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
  populateRemoteLanguageSelects();
  updateRemoteGlossaryMode();
  refreshRemoteUi();
  await join();
});
