const socket = io();
const $ = (id) => document.getElementById(id);

let currentEvent = null;
let currentVolume = 70;
let currentMuted = false;
let selectedEntryId = null;
let sourceEditLock = false;
let activeTab = 'dashboard';
let lastManualEnterAt = 0;
let screenWakeLock = null;
window.isRecognitionRunning = false;
let availableLanguages = {};

let audioState = {
  stream: null,
  context: null,
  source: null,
  gainNode: null,
  preampNode: null,
  analyser: null,
  destination: null,
  meterFrame: null,
  recorder: null,
  running: false,
  busy: false,
  uploadQueue: [],
  chunks: [],
  chunkTimer: null,
  mimeType: '',
  monitorGainNode: null,
  monitorEnabled: false
};

function langLabel(code) {
  return availableLanguages[code] || code.toUpperCase();
}

function selectedLangs() {
  return Array.from(document.querySelectorAll('#targetLangList input[type="checkbox"][value]:checked')).map((i) => i.value);
}

function setStatus(text) {
  const el = $('recognitionStatus');
  if (el) el.textContent = text;
}

function setOnAirState(isOn) {
  const badge = $('onAirBadge');
  if (!badge) return;
  badge.textContent = isOn ? 'On-Air' : 'Off-Air';
  badge.className = isOn ? 'status-pill active' : 'status-pill';
}

async function enableScreenWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return;
    if (document.visibilityState !== 'visible') return;
    if (screenWakeLock) return;
    screenWakeLock = await navigator.wakeLock.request('screen');
    screenWakeLock.addEventListener('release', () => { screenWakeLock = null; });
  } catch (_) {}
}

async function disableScreenWakeLock() {
  try {
    if (screenWakeLock) {
      await screenWakeLock.release();
      screenWakeLock = null;
    }
  } catch (_) {}
}

function switchTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
  document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tabName}`));
}

function updateGlossaryMode() {
  const mode = $('glossaryMode')?.value || 'translation';
  $('translationGlossaryFields').style.display = mode === 'translation' ? 'flex' : 'none';
  $('sourceCorrectionFields').style.display = mode === 'source' ? 'flex' : 'none';
}

function escapeHtml(text) {
  return String(text || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function escapeHtmlWithBreaks(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function renderActiveEventBadge(event) {
  const badge = $('activeEventBadge');
  const opened = $('openedEventBadge');
  if (!badge) return;
  if (!event) {
    badge.textContent = 'No live event';
    badge.className = 'status-pill';
    opened.textContent = 'No event opened';
    $('songModeBadge').textContent = 'Live';
    return;
  }
  const extra = event.scheduledAt ? ` · ${formatDateTime(event.scheduledAt)}` : '';
  badge.textContent = event.isActive ? `Live: ${event.name}${extra}` : 'Another event is live';
  badge.className = event.isActive ? 'status-pill active' : 'status-pill';
  opened.textContent = `Opened: ${event.name}${extra}`;
  $('songModeBadge').textContent = event.displayState?.mode === 'manual' ? 'Display Manual' : 'Live';
  $('songModeBadge').className = event.displayState?.mode === 'manual' ? 'status-pill active' : 'status-pill';
}

function renderParticipantStats(stats = {}) {
  const uniqueCount = Number(stats.uniqueCount || stats.total || 0);
  const languages = Array.isArray(stats.languages) ? stats.languages : Object.entries(stats.byLanguage || {}).map(([lang, count]) => ({ lang, count }));
  $('participantStatsSummary').textContent = uniqueCount === 1 ? '1 unique participant' : `${uniqueCount} unique participants`;
  $('participantStatsList').innerHTML = languages.length
    ? languages.map((item) => `<div class="history-item">${escapeHtml(langLabel(item.lang))}: ${item.count}</div>`).join('')
    : '<div class="muted">No connected participant.</div>';
}

function resetParticipantStats() {
  renderParticipantStats({ uniqueCount: 0, languages: [] });
}

function getEntryById(entryId) {
  return (currentEvent?.transcripts || []).find((x) => x.id === entryId) || null;
}

function fillGlossaryLangs(targetLangs = []) {
  const select = $('glossaryLang');
  select.innerHTML = '';
  targetLangs.forEach((lang) => {
    const opt = document.createElement('option');
    opt.value = lang;
    opt.textContent = langLabel(lang);
    select.appendChild(opt);
  });
}

function fillLanguageSelectors() {
  const sourceSelect = $('sourceLang');
  const targetBox = $('targetLangList');
  sourceSelect.innerHTML = '';
  targetBox.innerHTML = '';
  Object.entries(availableLanguages).forEach(([code, label]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = label;
    if (code === 'ro') option.selected = true;
    sourceSelect.appendChild(option);

    const checked = ['no', 'en'].includes(code);
    const row = document.createElement('label');
    row.className = 'checkbox-item';
    row.innerHTML = `<input type="checkbox" value="${code}" ${checked ? 'checked' : ''}> ${escapeHtml(label)}`;
    targetBox.appendChild(row);
  });
}

function copyField(id, buttonId) {
  const value = ($(id)?.value || '').trim();
  if (!value) return;
  navigator.clipboard.writeText(value).then(() => {
    const btn = $(buttonId);
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => btn.textContent = old, 1200);
  }).catch(() => setStatus('Copy failed.'));
}

function adminJsonOptions(method, payload = {}) {
  if (!currentEvent?.adminCode) {
    throw new Error('Open or create an event first.');
  }

  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, code: currentEvent.adminCode })
  };
}

async function copyTextQuick(text, button) {
  try {
    await navigator.clipboard.writeText(String(text || '').trim());
    const old = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => button.textContent = old, 1200);
  } catch (_) {
    setStatus('Copy failed.');
  }
}

async function copyQrImage() {
  const src = $('qrImage')?.src;
  if (!src) return;
  try {
    if (!navigator.clipboard || !window.ClipboardItem) return;
    const blob = await (await fetch(src)).blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    setStatus('QR copied.');
  } catch (_) {
    setStatus('QR copy failed.');
  }
}

function downloadQr() {
  const src = $('qrImage')?.src;
  if (!src) return;
  const a = document.createElement('a');
  a.href = src;
  a.download = `bpms-qr-${Date.now()}.png`;
  a.click();
}

function buildScheduledAt() {
  const date = $('eventDate')?.value;
  const time = $('eventTime')?.value;
  if (!date) return null;
  return time ? `${date}T${time}:00` : `${date}T00:00:00`;
}

function openInlineEditor(entryId) {
  selectedEntryId = entryId;
  sourceEditLock = true;
  document.querySelectorAll('.entry.active').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.inline-editor.open').forEach((el) => el.classList.remove('open'));
  const card = document.querySelector(`[data-entry-id="${entryId}"]`);
  if (!card) return;
  card.classList.add('active');
  const editor = card.querySelector('.inline-editor');
  if (editor) editor.classList.add('open');
  requestAnimationFrame(() => {
    const textarea = card.querySelector('.inline-source');
    if (!textarea) return;
    textarea.focus();
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;
  });
}

function closeInlineEditors() {
  document.querySelectorAll('.entry.active').forEach((el) => el.classList.remove('active'));
  document.querySelectorAll('.inline-editor.open').forEach((el) => el.classList.remove('open'));
  selectedEntryId = null;
  sourceEditLock = false;
}

function renderEntry(entry) {
  const list = $('transcriptList');
  const div = document.createElement('div');
  div.className = 'entry';
  div.dataset.entryId = entry.id;
  const editedBadge = entry.edited ? '<div class="mini-badge">Edited</div>' : '';
  const sourceLabel = langLabel(entry.sourceLang);
  const translations = Object.entries(entry.translations || {}).map(([lang, text]) => `<div class="trans" data-lang="${lang}"><b>${lang.toUpperCase()}:</b> ${escapeHtml(text)}</div>`).join('');
  div.innerHTML = `
    <div class="entry-meta">${formatDateTime(entry.createdAt)}</div>
    <div class="entry-head">
      <div class="orig"><b>${sourceLabel}:</b> ${escapeHtml(entry.original)}</div>
      <div class="button-row compact"><button class="btn btn-dark entry-copy-btn" type="button">Copy</button>${editedBadge}</div>
    </div>
    ${translations}
    <div class="inline-editor">
      <div class="muted">Edit source and retranslate all languages</div>
      <textarea class="inline-source">${escapeHtml(entry.original)}</textarea>
      <div class="button-row compact">
        <button class="btn btn-primary inline-save" type="button">Retranslate</button>
        <button class="btn btn-dark inline-close" type="button">Close</button>
      </div>
    </div>`;
  div.addEventListener('click', (e) => { if (!e.target.closest('button') && !e.target.closest('textarea')) openInlineEditor(entry.id); });
  div.querySelector('.entry-copy-btn').addEventListener('click', (e) => { e.stopPropagation(); copyTextQuick(entry.original, e.currentTarget); });
  div.querySelector('.inline-save').addEventListener('click', (e) => { e.stopPropagation(); saveInlineSource(entry.id); });
  div.querySelector('.inline-close').addEventListener('click', (e) => { e.stopPropagation(); closeInlineEditors(); });
  div.querySelector('.inline-source').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveInlineSource(entry.id); } });
  list.prepend(div);
}

function updateEntry({ entryId, lang, text }) {
  const entry = document.querySelector(`[data-entry-id="${entryId}"]`);
  if (!entry) return;
  let line = entry.querySelector(`.trans[data-lang="${lang}"]`);
  if (!line) {
    line = document.createElement('div');
    line.className = 'trans';
    line.dataset.lang = lang;
    entry.insertBefore(line, entry.querySelector('.inline-editor'));
  }
  line.innerHTML = `<b>${lang.toUpperCase()}:</b> ${escapeHtml(text)}`;
}

function updateSourceEntry({ entryId, sourceLang, original, translations }) {
  const entry = document.querySelector(`[data-entry-id="${entryId}"]`);
  if (!entry) return;
  entry.querySelector('.orig').innerHTML = `<b>${langLabel(sourceLang)}:</b> ${escapeHtml(original)}`;
  entry.querySelector('.inline-source').value = original;
  Object.entries(translations || {}).forEach(([lang, text]) => updateEntry({ entryId, lang, text }));
  const actual = getEntryById(entryId);
  if (actual) {
    actual.sourceLang = sourceLang;
    actual.original = original;
    actual.translations = translations;
    actual.edited = true;
  }
}

function saveInlineSource(entryId) {
  if (!currentEvent) return;
  const card = document.querySelector(`[data-entry-id="${entryId}"]`);
  const textarea = card?.querySelector('.inline-source');
  const text = textarea?.value.trim();
  if (!text) return;
  socket.emit('admin_update_source', { eventId: currentEvent.id, entryId, sourceText: text });
  closeInlineEditors();
}

function renderEventList(events = [], activeEventId = null, openedEventId = null) {
  const box = $('eventList');
  box.innerHTML = '';
  if (!events.length) {
    box.innerHTML = '<div class="muted">No events yet.</div>';
    return;
  }
  events.forEach((event) => {
    const card = document.createElement('div');
    card.className = `event-card${event.id === activeEventId ? ' active' : ''}${event.id === openedEventId ? ' opened' : ''}`;
    const langs = (event.targetLangs || []).map((lang) => langLabel(lang)).join(', ');
    card.innerHTML = `
      <div class="event-card-head"><div class="event-name">${escapeHtml(event.name || 'New event')}</div><div class="mini-badge">${event.mode || 'live'}</div></div>
      <div class="muted">Scheduled: ${escapeHtml(formatDateTime(event.scheduledAt || event.createdAt))}</div>
      <div class="muted">Languages: ${escapeHtml(langs || '-')}</div>
      <div class="muted">Texts: ${event.transcriptCount || 0}</div>
      <div class="button-row compact">
        <button class="btn btn-dark" data-action="open" data-id="${event.id}">Open</button>
        <button class="btn btn-dark" data-action="activate" data-id="${event.id}">Set live</button>
        <button class="btn btn-danger" data-action="delete" data-id="${event.id}">Delete</button>
      </div>`;
    box.appendChild(card);
  });
}

async function refreshEventList() {
  const res = await fetch('/api/events');
  const data = await res.json();
  if (data.ok) renderEventList(data.events || [], data.activeEventId || null, currentEvent?.id || null);
}

async function syncSpeedToEvent() {
  if (!currentEvent) return;
  const speed = $('speed').value || 'balanced';
  const res = await fetch(`/api/events/${currentEvent.id}/settings`, adminJsonOptions('POST', { speed }));
  const data = await res.json();
  if (data.ok) currentEvent = data.event;
}

function populateEventLinks() {
  if (!currentEvent) return;
  $('adminCode').textContent = currentEvent.adminCode || '-';
  $('participantLink').value = currentEvent.participantLink || '';
  $('translateLink').value = currentEvent.translateLink || '';
  $('songLink').value = currentEvent.songLink || '';
  $('qrImage').src = currentEvent.qrCodeDataUrl || '';
}


function renderSongStateLegacy(songState) {
  if (true) return;
  const libraryCount = Array.isArray(currentEvent?.songLibrary) ? currentEvent.songLibrary.length : 0;
  const historyCount = Array.isArray(currentEvent?.songHistory) ? currentEvent.songHistory.length : 0;
  $('songCurrentIndex').textContent = `Saved: ${libraryCount} · History: ${historyCount}`;
  $('songPreview').textContent = currentEvent?.displayState?.manualSource || 'Prepared text will appear here.';
  $('songBlocksList').innerHTML = '<div class="muted">Use Save in library or Send live + display.</div>';
}



function renderSongState(songState) {
  const summaryEl = $('songCurrentIndex');
  const previewEl = $('songPreview');
  const blocksEl = $('songBlocksList');
  if (!summaryEl || !previewEl || !blocksEl) return;

  const libraryCount = Array.isArray(currentEvent?.songLibrary) ? currentEvent.songLibrary.length : 0;
  const historyCount = Array.isArray(currentEvent?.songHistory) ? currentEvent.songHistory.length : 0;
  const blocks = Array.isArray(songState?.blocks) ? songState.blocks : [];
  const currentIndex = Number.isInteger(songState?.currentIndex) ? songState.currentIndex : -1;

  summaryEl.textContent = `Saved: ${libraryCount} · History: ${historyCount}`;
  previewEl.textContent = currentEvent?.displayState?.manualSource || 'Prepared text will appear here.';

  if (!blocks.length) {
    blocksEl.innerHTML = '<div class="muted">Use Save in library or Send live + display.</div>';
    return;
  }

  blocksEl.innerHTML = blocks.map((block, index) => {
    const activeClass = index === currentIndex ? ' active' : '';
    return `<div class="history-item${activeClass}"><b>Block ${index + 1}</b><div class="small">${escapeHtml(block)}</div></div>`;
  }).join('');
}

function renderSongLibrary(items = []) {
  const box = $('songLibraryList');
  if (!box) return;
  if (!items.length) {
    box.innerHTML = '<div class="muted">No saved songs yet.</div>';
    return;
  }
  box.innerHTML = items.map((item) => `
    <div class="event-card">
      <div class="name">${escapeHtml(item.title || 'Untitled')}</div>
      <div class="meta">${escapeHtmlWithBreaks((item.text || '').slice(0, 220))}${(item.text || '').length > 220 ? '...' : ''}</div>
      <div class="actions">
        <button class="btn btn-dark" data-song-action="load" data-song-id="${item.id}">Load</button>
        <button class="btn btn-primary" data-song-action="send" data-song-id="${item.id}">Send live</button>
        <button data-song-action="delete" data-song-id="${item.id}">Delete</button>
      </div>
    </div>
  `).join('');
}

function renderSongHistory(items = []) {
  const box = $('songHistoryList');
  if (!box) return;
  if (!items.length) {
    box.innerHTML = '<div class="muted">Nothing sent yet.</div>';
    return;
  }
  box.innerHTML = items.map((item) => {
    const preview = item.source || '';
    return `
      <div class="history-item">
        <div><b>${escapeHtml(item.title || 'Sent text')}</b></div>
        <div class="small">${escapeHtmlWithBreaks(preview.slice(0, 220))}${preview.length > 220 ? '...' : ''}</div>
      </div>
    `;
  }).join('');
}

async function loadSongLibrary() {
  if (!currentEvent) return;
  try {
    const res = await fetch(`/api/events/${currentEvent.id}/song-library`);
    const data = await res.json();
    if (!data.ok) return;
    currentEvent.songLibrary = data.songLibrary || [];
    renderSongLibrary(currentEvent.songLibrary);
  } catch (err) {
    console.error(err);
  }
}

function fillSongEditor(item) {
  $('songTitle').value = item?.title || '';
  $('songText').value = item?.text || '';
}

async function saveSongToLibrary() {
  if (!currentEvent) return alert('Open or create an event first.');
  const title = $('songTitle').value.trim();
  const text = $('songText').value.trim();
  if (!title || !text) return alert('Complete title and text first.');
  const res = await fetch(`/api/events/${currentEvent.id}/song-library`, adminJsonOptions('POST', { title, text }));
  const data = await res.json();
  if (!data.ok) return alert(data.error || 'Could not save item.');
  currentEvent.songLibrary = data.songLibrary || [];
  renderSongLibrary(currentEvent.songLibrary);
  renderSongState(currentEvent.songState || {});
  setStatus('Saved in library.');
}

async function sendSongToLive() {
  if (!currentEvent) return alert('Open or create an event first.');
  const title = $('songTitle').value.trim();
  const text = $('songText').value.trim();
  if (!text) return alert('Write text first.');
  const res = await fetch(`/api/events/${currentEvent.id}/display/manual`, adminJsonOptions('POST', { title, text }));
  const data = await res.json();
  if (!data.ok) return alert(data.error || 'Could not send text.');
  currentEvent.displayState = data.displayState || currentEvent.displayState;
  currentEvent.songHistory = data.songHistory || currentEvent.songHistory || [];
  renderSongHistory(currentEvent.songHistory);
  renderActiveEventBadge(currentEvent);
  renderSongState(currentEvent.songState || {});
  if ($('displayModeLabel')) {
    $('displayModeLabel').textContent = currentEvent.displayState?.mode === 'manual' ? 'Display: Manual' : 'Display: Auto';
  }
  setStatus('Text sent to live and display.');
}

async function setDisplayMode(mode) {
  if (!currentEvent) return;
  const res = await fetch(`/api/events/${currentEvent.id}/display/mode`, adminJsonOptions('POST', { mode }));
  const data = await res.json();
  if (!data.ok) return alert(data.error || 'Could not change display mode.');
  currentEvent.displayState = data.displayState || currentEvent.displayState;
  $('displayModeLabel').textContent = currentEvent.displayState?.mode === 'manual' ? 'Display: Manual' : 'Display: Auto';
  renderActiveEventBadge(currentEvent);
  setStatus(mode === 'manual' ? 'Display switched to manual.' : 'Display switched to auto.');
}

async function openEventById(eventId) {
  const res = await fetch(`/api/events/${eventId}`);
  const data = await res.json();
  if (!data.ok) return;
  currentEvent = data.event;
  populateEventLinks();
  $('speed').value = currentEvent.speed || 'balanced';
  currentVolume = currentEvent.audioVolume;
  currentMuted = currentEvent.audioMuted;
  $('volumeRange').value = String(currentVolume);
  $('transcriptList').innerHTML = '';
  (currentEvent.transcripts || []).forEach(renderEntry);
  fillGlossaryLangs(currentEvent.targetLangs || []);
  renderActiveEventBadge(currentEvent);
  renderSongState(currentEvent.songState || {});
  $('displayModeLabel').textContent = currentEvent.displayState?.mode === 'manual' ? 'Display: Manual' : 'Display: Auto';
  renderSongHistory(currentEvent.songHistory || []);
  await loadSongLibrary();
  closeInlineEditors();
  $('partialTranscript').textContent = 'Waiting for full sentence...';
  socket.emit('join_event', { eventId: currentEvent.id, role: 'admin', code: currentEvent.adminCode });
  await refreshEventList();
  setStatus(`Opened: ${currentEvent.name}.`);
  switchTab('dashboard');
}

async function createEvent() {
  const name = $('eventName').value.trim() || 'New event';
  const sourceLang = $('sourceLang').value;
  const targetLangs = selectedLangs();
  if (!targetLangs.length) return alert('Choose at least one target language.');
  if (targetLangs.includes(sourceLang)) return alert('Remove source language from target languages.');
  const res = await fetch('/api/events', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      name, speed: $('speed').value || 'balanced', sourceLang, targetLangs, scheduledAt: buildScheduledAt()
    })
  });
  const data = await res.json();
  if (!data.ok) return alert(data.error || 'Could not create event.');
  currentEvent = data.event;
  populateEventLinks();
  fillGlossaryLangs(currentEvent.targetLangs || []);
  renderActiveEventBadge(currentEvent);
  renderSongState(currentEvent.songState || {});
  $('displayModeLabel').textContent = currentEvent.displayState?.mode === 'manual' ? 'Display: Manual' : 'Display: Auto';
  renderSongHistory(currentEvent.songHistory || []);
  await loadSongLibrary();
  socket.emit('join_event', { eventId: currentEvent.id, role: 'admin', code: currentEvent.adminCode });
  if ($('eventModePreset').value === 'song') await setEventMode('song');
  await refreshEventList();
  setStatus('Event created.');
  switchTab('dashboard');
}

async function setEventMode(mode) {
  if (!currentEvent) return;
  const res = await fetch(`/api/events/${currentEvent.id}/mode`, adminJsonOptions('POST', { mode }));
  const data = await res.json();
  if (data.ok) {
    currentEvent = data.event;
    renderActiveEventBadge(currentEvent);
  }
}

async function setActiveEvent() {
  if (!currentEvent) return;
  const res = await fetch(`/api/events/${currentEvent.id}/activate`, adminJsonOptions('POST'));
  const data = await res.json();
  if (data.ok) {
    currentEvent = data.event;
    renderActiveEventBadge(currentEvent);
    setStatus('Event is live now.');
  }
}

async function loadAudioInputs(keepValue = true) {
  const select = $('audioInput');
  const previous = keepValue ? select.value : '';
  select.innerHTML = '';
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === 'audioinput');
    if (!inputs.length) {
      const o = document.createElement('option');
      o.textContent = 'No audio input';
      o.value = '';
      select.appendChild(o);
      return;
    }
    inputs.forEach((d) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || 'Audio input';
      select.appendChild(o);
    });
    if (previous && inputs.some((d) => d.deviceId === previous)) select.value = previous;
  } catch (_) {
    setStatus('Could not read audio inputs.');
  }
}

async function destroyAudioPipeline() {
  audioState.running = false;
  if (audioState.chunkTimer) clearTimeout(audioState.chunkTimer);
  audioState.chunkTimer = null;
  audioState.chunks = [];
  audioState.mimeType = '';
  if (audioState.recorder && audioState.recorder.state !== 'inactive') { try { audioState.recorder.stop(); } catch (_) {} }
  audioState.recorder = null;
  if (audioState.meterFrame) cancelAnimationFrame(audioState.meterFrame);
  audioState.meterFrame = null;
  if (audioState.stream) audioState.stream.getTracks().forEach((t) => t.stop());
  audioState.stream = null;
  if (audioState.context) await audioState.context.close().catch(() => {});
  audioState.context = null;
  audioState.source = null;
  audioState.gainNode = null;
  audioState.preampNode = null;
  audioState.analyser = null;
  audioState.monitorGainNode = null;
  audioState.destination = null;
  audioState.busy = false;
  audioState.uploadQueue = [];
  $('audioLevel').value = 0;
  setOnAirState(false);
}

function sliderToGain(value) {
  const v = Math.max(0, Number(value || 100));
  return Math.pow(v / 100, 2);
}

function updateInputGain() {
  const value = Number($('inputGainRange').value || 100);
  const gain = sliderToGain(value);
  $('inputGainLabel').textContent = `${value}% · ${gain.toFixed(1)}x`;
  if (audioState.preampNode) audioState.preampNode.gain.value = gain;
}

function updateMonitorGain() {
  const enabled = !!$('monitorAudioBox').checked;
  const value = Number($('monitorGainRange').value || 0);
  const gain = enabled ? sliderToGain(value) : 0;
  $('monitorGainLabel').textContent = `${value}% · ${gain.toFixed(1)}x`;
  if (audioState.monitorGainNode) audioState.monitorGainNode.gain.value = gain;
}

function startMeterLoop() {
  if (!audioState.analyser) return;
  const data = new Uint8Array(audioState.analyser.fftSize);
  const draw = () => {
    if (!audioState.analyser) return;
    audioState.analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const db = 20 * Math.log10(Math.max(rms, 0.00001));
    const level = Math.max(0, Math.min(100, Math.round(((db + 60) / 60) * 100)));
    $('audioLevel').value = level;
    audioState.meterFrame = requestAnimationFrame(draw);
  };
  draw();
}

async function createAudioPipeline() {
  const deviceId = $('audioInput').value;
  await destroyAudioPipeline();
  audioState.stream = await navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId }, channelCount: 2, sampleRate: 48000, sampleSize: 16, echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { channelCount: 2, sampleRate: 48000, sampleSize: 16, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
  });
  audioState.context = new (window.AudioContext || window.webkitAudioContext)();
  await audioState.context.resume();
  audioState.source = audioState.context.createMediaStreamSource(audioState.stream);
  audioState.gainNode = audioState.context.createGain();
  audioState.preampNode = audioState.context.createGain();
  audioState.analyser = audioState.context.createAnalyser();
  audioState.analyser.fftSize = 2048;
  audioState.destination = audioState.context.createMediaStreamDestination();
  audioState.source.connect(audioState.gainNode);
  audioState.gainNode.connect(audioState.preampNode);
  audioState.preampNode.connect(audioState.analyser);
  audioState.preampNode.connect(audioState.destination);
  audioState.monitorGainNode = audioState.context.createGain();
  audioState.monitorGainNode.gain.value = 0;
  audioState.preampNode.connect(audioState.monitorGainNode);
  audioState.monitorGainNode.connect(audioState.context.destination);
  audioState.gainNode.gain.value = 1;
  updateInputGain();
  updateMonitorGain();
  startMeterLoop();
}

function chooseRecorderMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm'];
  return candidates.find((type) => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

function getAudioFileInfo(mimeType) {
  const type = String(mimeType || '').toLowerCase();
  if (type.includes('wav')) return { mimeType: 'audio/wav', ext: 'wav' };
  if (type.includes('mp4') || type.includes('m4a')) return { mimeType: 'audio/mp4', ext: 'm4a' };
  return { mimeType: 'audio/webm', ext: 'webm' };
}

async function postAudioChunk(blob) {
  if (!currentEvent || !blob || blob.size < 3500) return;
  const detectedType = blob.type || audioState.mimeType || 'audio/webm';
  const fileInfo = getAudioFileInfo(detectedType);
  const form = new FormData();
  form.append('code', currentEvent.adminCode);
  form.append('audio', new File([blob], `chunk.${fileInfo.ext}`, { type: fileInfo.mimeType }));
  const res = await fetch(`/api/events/${currentEvent.id}/transcribe`, { method: 'POST', body: form });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Audio upload failed.');
}

function enqueueAudioBlob(blob) {
  if (!blob || blob.size < 3500) return;
  audioState.uploadQueue.push(blob);
  if (!audioState.busy) drainAudioUploadQueue().catch(console.error);
}

async function drainAudioUploadQueue() {
  if (audioState.busy) return;
  audioState.busy = true;
  try {
    while (audioState.uploadQueue.length) {
      const blob = audioState.uploadQueue.shift();
      try { await postAudioChunk(blob); } catch (err) { setStatus(err.message || 'Audio send failed.'); }
    }
  } finally {
    audioState.busy = false;
  }
}

async function startTranslation() {
  if (!currentEvent) return alert('Open or create an event first.');
  await syncSpeedToEvent();
  if (!window.MediaRecorder) return alert('Use Chrome or Edge.');
  try { await createAudioPipeline(); } catch (_) { return setStatus('Audio start failed.'); }
  const mimeType = chooseRecorderMimeType();
  if (!mimeType) return alert('Unsupported audio format in this browser.');
  await setEventMode('live');
  audioState.running = true;
  audioState.mimeType = mimeType;
  window.isRecognitionRunning = true;
  setOnAirState(true);
  await enableScreenWakeLock();
  const startRecorderCycle = () => {
    if (!audioState.running) return;
    audioState.chunks = [];
    const recorder = new MediaRecorder(audioState.destination.stream, { mimeType, audioBitsPerSecond: 128000 });
    audioState.recorder = recorder;
    recorder.ondataavailable = (event) => { if (event.data && event.data.size > 0) audioState.chunks.push(event.data); };
    recorder.onstop = () => {
      const finalType = recorder.mimeType || mimeType || 'audio/webm';
      const blob = new Blob(audioState.chunks, { type: finalType });
      audioState.chunks = [];
      if (audioState.chunkTimer) clearTimeout(audioState.chunkTimer);
      audioState.chunkTimer = null;
      if (audioState.recorder === recorder) audioState.recorder = null;
      if (audioState.running) startRecorderCycle();
      if (blob.size >= 3500) enqueueAudioBlob(blob);
    };
    recorder.start();
    audioState.chunkTimer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 5200);
  };
  startRecorderCycle();
  setStatus('On-Air. Translating from selected source.');
}

async function stopTranslation() {
  audioState.running = false;
  window.isRecognitionRunning = false;
  if (audioState.chunkTimer) clearTimeout(audioState.chunkTimer);
  audioState.chunkTimer = null;
  setOnAirState(false);
  await disableScreenWakeLock();
  if (audioState.recorder && audioState.recorder.state === 'recording') {
    audioState.recorder.stop();
    setTimeout(() => destroyAudioPipeline().catch(console.error), 100);
    return;
  }
  await destroyAudioPipeline();
  setStatus('Stopped.');
}

function sendManualText() {
  if (!currentEvent) return alert('Open or create an event first.');
  const text = $('manualText').value.trim();
  if (!text) return;
  setEventMode('live');
  socket.emit('submit_text', { eventId: currentEvent.id, text });
  $('manualText').value = '';
  lastManualEnterAt = 0;
}


async function loadSong() {
  switchTab('song');
}

async function moveSong(direction) {
  return;
}

async function showSongIndex(index) {
  return;
}

async function clearSong() {
  $('songTitle').value = '';
  $('songText').value = '';
  setStatus('Editor cleared.');
}


socket.on('joined_event', ({ event, role }) => {
  if (role !== 'admin') return;
  currentEvent = event;
  $('speed').value = event.speed || 'balanced';
  currentVolume = event.audioVolume;
  currentMuted = event.audioMuted;
  $('volumeRange').value = String(currentVolume);
  $('audioStateLabel').textContent = currentMuted ? 'Global audio off.' : 'Global audio active.';
  $('transcriptList').innerHTML = '';
  (event.transcripts || []).forEach(renderEntry);
  fillGlossaryLangs(currentEvent.targetLangs || []);
  renderActiveEventBadge(currentEvent);
  renderSongState(currentEvent.songState || {});
  $('displayModeLabel').textContent = currentEvent.displayState?.mode === 'manual' ? 'Display: Manual' : 'Display: Auto';
  renderSongHistory(event.songHistory || []);
  loadSongLibrary();
  populateEventLinks();
  closeInlineEditors();
  refreshEventList();
  $('partialTranscript').textContent = 'Waiting for full sentence...';
});

socket.on('transcript_entry', (entry) => {
  if (!currentEvent) return;
  currentEvent.transcripts = currentEvent.transcripts || [];
  if (!getEntryById(entry.id)) currentEvent.transcripts.push(entry);
  renderEntry(entry);
  $('partialTranscript').textContent = 'Waiting for full sentence...';
});

socket.on('transcript_updated', updateEntry);
socket.on('transcript_source_updated', (payload) => { updateSourceEntry(payload); $('partialTranscript').textContent = 'Waiting for full sentence...'; });
socket.on('audio_state', ({ audioMuted, audioVolume }) => {
  currentMuted = audioMuted;
  currentVolume = audioVolume;
  $('volumeRange').value = String(audioVolume);
  $('audioStateLabel').textContent = audioMuted ? 'Global audio off.' : 'Global audio active.';
});
socket.on('partial_transcript', ({ text }) => { $('partialTranscript').textContent = text || 'Waiting for full sentence...'; });
socket.on('participant_stats', renderParticipantStats);
socket.on('server_error', ({ message }) => setStatus(message || 'Server error.'));
socket.on('active_event_changed', async ({ eventId }) => {
  if (currentEvent) {
    currentEvent.isActive = currentEvent.id === eventId;
    renderActiveEventBadge(currentEvent);
  }
  await refreshEventList();
});
socket.on('mode_changed', ({ mode }) => {
  if (!currentEvent) return;
  currentEvent.mode = mode;
  renderActiveEventBadge(currentEvent);
});
socket.on('song_state', (songState) => {
  if (!currentEvent) return;
  currentEvent.songState = songState;
  currentEvent.mode = 'song';
  renderSongState(songState);
});
socket.on('song_clear', () => {
  if (!currentEvent) return;
  currentEvent.songState = { title: '', blocks: [], currentIndex: -1, activeBlock: null, translations: {}, allTranslations: [], updatedAt: null };
  currentEvent.mode = 'live';
  renderSongState(currentEvent.songState);
  renderActiveEventBadge(currentEvent);
});
socket.on('display_mode_changed', ({ mode }) => {
  if (!currentEvent) return;
  currentEvent.displayState = currentEvent.displayState || {};
  currentEvent.displayState.mode = mode;
  $('displayModeLabel').textContent = mode === 'manual' ? 'Display: Manual' : 'Display: Auto';
  renderActiveEventBadge(currentEvent);
});
socket.on('song_history_updated', ({ songHistory }) => {
  if (!currentEvent) return;
  currentEvent.songHistory = songHistory || [];
  renderSongHistory(currentEvent.songHistory);
  renderSongState(currentEvent.songState || {});
});

document.querySelectorAll('.nav-btn').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
$('createEventBtn').addEventListener('click', createEvent);
$('sendManualBtn').addEventListener('click', sendManualText);
$('speed').addEventListener('change', syncSpeedToEvent);
$('openTranscriptTabBtn').addEventListener('click', () => switchTab('transcript'));
$('manualText').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const now = Date.now();
  if (now - lastManualEnterAt < 600) { e.preventDefault(); sendManualText(); return; }
  lastManualEnterAt = now;
});
$('saveGlossaryBtn').addEventListener('click', async () => {
  if (!currentEvent) return alert('Open or create an event first.');
  const source = $('glossarySource').value.trim();
  const target = $('glossaryTarget').value.trim();
  const lang = $('glossaryLang').value;
  const permanent = !!$('glossaryPermanent').checked;
  if (!source || !target) return;
  const res = await fetch(`/api/events/${currentEvent.id}/glossary`, adminJsonOptions('POST', { source, target, lang, permanent }));
  const data = await res.json();
  if (data.ok) { $('glossarySource').value = ''; $('glossaryTarget').value = ''; setStatus('Glossary saved.'); }
});
$('saveSourceCorrectionBtn').addEventListener('click', async () => {
  if (!currentEvent) return alert('Open or create an event first.');
  const heard = $('sourceWrong').value.trim();
  const correct = $('sourceCorrect').value.trim();
  const permanent = !!$('sourceCorrectionPermanent').checked;
  if (!heard || !correct) return;
  const res = await fetch(`/api/events/${currentEvent.id}/source-corrections`, adminJsonOptions('POST', { heard, correct, permanent }));
  const data = await res.json();
  if (data.ok) { $('sourceWrong').value = ''; $('sourceCorrect').value = ''; setStatus('Speech correction saved.'); }
});
$('glossaryMode').addEventListener('change', updateGlossaryMode);
$('muteGlobalBtn').addEventListener('click', () => {
  if (!currentEvent) return;
  currentMuted = !currentMuted;
  socket.emit('set_audio_state', { eventId: currentEvent.id, audioMuted: currentMuted, audioVolume: currentVolume, code: currentEvent.adminCode });
});
$('panicBtn').addEventListener('click', () => {
  if (!currentEvent) return;
  currentMuted = true;
  currentVolume = 0;
  $('volumeRange').value = '0';
  socket.emit('set_audio_state', { eventId: currentEvent.id, audioMuted: true, audioVolume: 0, code: currentEvent.adminCode });
});
$('volumeRange').addEventListener('input', () => {
  currentVolume = Number($('volumeRange').value || 70);
  if (!currentEvent) return;
  socket.emit('set_audio_state', { eventId: currentEvent.id, audioMuted: currentMuted, audioVolume: currentVolume, code: currentEvent.adminCode });
});
$('inputGainRange').addEventListener('input', updateInputGain);
$('monitorAudioBox').addEventListener('change', updateMonitorGain);
$('monitorGainRange').addEventListener('input', updateMonitorGain);
$('audioInput').addEventListener('change', async () => {
  if (audioState.running) await startTranslation();
  else { try { await createAudioPipeline(); setStatus('Audio source changed.'); } catch (_) { setStatus('Selected source failed.'); } }
});
$('startRecognitionBtn').addEventListener('click', startTranslation);
$('stopRecognitionBtn').addEventListener('click', stopTranslation);
$('copyParticipantBtn').addEventListener('click', () => copyField('participantLink', 'copyParticipantBtn'));
$('copyTranslateBtn').addEventListener('click', () => copyField('translateLink', 'copyTranslateBtn'));
$('copySongBtn').addEventListener('click', () => copyField('songLink', 'copySongBtn'));
$('copyQrBtn').addEventListener('click', copyQrImage);
$('downloadQrBtn').addEventListener('click', downloadQr);
$('setActiveEventBtn').addEventListener('click', setActiveEvent);
$('refreshEventsBtn').addEventListener('click', refreshEventList);
$('jumpLiveBtn').addEventListener('click', () => {
  closeInlineEditors();
  const first = document.querySelector('#transcriptList .entry');
  if (first) first.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('saveSongBtn').addEventListener('click', saveSongToLibrary);
$('sendSongBtn').addEventListener('click', sendSongToLive);
$('displayAutoBtn').addEventListener('click', () => setDisplayMode('auto'));
$('displayManualBtn').addEventListener('click', () => setDisplayMode('manual'));
$('songLibraryList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-song-action]');
  if (!btn || !currentEvent) return;
  const action = btn.getAttribute('data-song-action');
  const songId = btn.getAttribute('data-song-id');
  const item = (currentEvent.songLibrary || []).find((x) => x.id === songId);
  if (!item) return;
  if (action === 'load') { fillSongEditor(item); setStatus('Loaded into editor.'); return; }
  if (action === 'send') { fillSongEditor(item); await sendSongToLive(); return; }
  if (action === 'delete') {
    if (!confirm('Delete this saved item?')) return;
    const res = await fetch(`/api/events/${currentEvent.id}/song-library/${songId}`, adminJsonOptions('DELETE'));
    const data = await res.json();
    if (!data.ok) return;
    currentEvent.songLibrary = data.songLibrary || [];
    renderSongLibrary(currentEvent.songLibrary);
    renderSongState(currentEvent.songState || {});
    setStatus('Deleted.');
  }
});
$('openTranslateScreenBtn').addEventListener('click', () => { const url = $('translateLink').value || '/translate'; if (url) window.open(url, '_blank'); });
$('openSongScreenBtn').addEventListener('click', () => { const url = $('songLink').value || '/song'; if (url) window.open(url, '_blank'); });
$('eventList').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.getAttribute('data-id');
  const action = btn.getAttribute('data-action');
  if (action === 'open') return openEventById(id);
  if (action === 'activate') {
    const adminCode = currentEvent?.id === id ? currentEvent.adminCode : (prompt('Enter admin code for this event to activate it:') || '').trim();
    if (!adminCode) return;
    const res = await fetch(`/api/events/${id}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: adminCode })
    });
    const data = await res.json();
    if (data.ok) { if (currentEvent && currentEvent.id === id) currentEvent = data.event; await refreshEventList(); renderActiveEventBadge(currentEvent); }
    return;
  }
  if (action === 'delete') {
    if (!confirm('Delete this event permanently?')) return;
    const adminCode = currentEvent?.id === id ? currentEvent.adminCode : (prompt('Enter admin code for this event to delete it:') || '').trim();
    if (!adminCode) return;
    const res = await fetch(`/api/events/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: adminCode })
    });
    const data = await res.json();
    if (data.ok) {
      if (currentEvent?.id === id) {
        currentEvent = null;
        $('adminCode').textContent = '-'; $('participantLink').value = ''; $('translateLink').value = ''; $('songLink').value = '';
        $('qrImage').src = ''; $('transcriptList').innerHTML = ''; renderActiveEventBadge(null); resetParticipantStats();
      }
      await refreshEventList();
    }
  }
});
document.addEventListener('visibilitychange', async () => { if (document.visibilityState === 'visible' && window.isRecognitionRunning && !screenWakeLock) await enableScreenWakeLock(); });
window.addEventListener('beforeunload', async () => { await disableScreenWakeLock(); });

window.addEventListener('load', async () => {
  const now = new Date();
  $('eventDate').value = now.toISOString().slice(0, 10);
  $('eventTime').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (_) {}
  const langRes = await fetch('/api/languages');
  const langData = await langRes.json();
  availableLanguages = langData.languages || {};
  fillLanguageSelectors();
  await loadAudioInputs();
  updateGlossaryMode();
  updateInputGain();
  updateMonitorGain();
  setOnAirState(false);
  resetParticipantStats();
  await refreshEventList();
  try {
    const res = await fetch('/api/events/active');
    const data = await res.json();
    if (data.ok && data.event) await openEventById(data.event.id);
  } catch (_) {}
});
