const socket = io();
const $ = (id) => document.getElementById(id);

const langNames = {
  ro: 'Română', no: 'Norvegiană', ru: 'Rusă', uk: 'Ucraineană', en: 'Engleză', es: 'Spaniolă',
  fr: 'Franceză', de: 'Germană', it: 'Italiană', pt: 'Portugheză', pl: 'Poloneză', tr: 'Turcă', ar: 'Arabă', fa: 'Persană', hu: 'Maghiară'
};
const voiceLocales = { ro:'ro-RO', no:'nb-NO', ru:'ru-RU', uk:'uk-UA', en:'en-US', es:'es-ES', fr:'fr-FR', de:'de-DE', it:'it-IT', pt:'pt-PT', pl:'pl-PL', tr:'tr-TR', ar:'ar-SA', fa:'fa-IR', hu:'hu-HU' };

function getOrCreateParticipantId() { const key='bpms_participant_id'; let id=localStorage.getItem(key); if (!id) { id=(window.crypto?.randomUUID?.() || `p_${Math.random().toString(36).slice(2)}_${Date.now()}`); localStorage.setItem(key, id); } return id; }
function escapeHtml(text) { return String(text || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'); }

const state = { fixedEventId: new URLSearchParams(window.location.search).get('event') || '', currentEvent: null, currentLanguage: 'no', lastLiveEntryId: null, lastSpokenEntryId: null, localAudioEnabled: true, serverAudioMuted: false, languageInitialized: false, participantId: getOrCreateParticipantId(), mode: 'live', songState: null };
const HISTORY_MIN_ITEMS = 4, HISTORY_MAX_ITEMS = 8, HISTORY_CHAR_BUDGET = 900;

function setStatus(text) { const el=$('participantStatus'); if (el) el.textContent=text; }
function setParticipantUpdating(show) { const badge=$('participantUpdatingBadge'); if (!badge) return; badge.style.display = show ? 'block' : 'none'; }
function sortEntries(entries = []) { return [...entries].sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0)); }
function getEntryById(entryId) { return (state.currentEvent?.transcripts || []).find((x)=>x.id===entryId) || null; }
function getLatestEntry() { const entries=sortEntries(state.currentEvent?.transcripts || []); return entries.length ? entries[entries.length - 1] : null; }
function getTextForEntry(entry) { if (!entry) return ''; return entry.translations?.[state.currentLanguage] || entry.original || ''; }
function getHistoryEntries() { const entries=sortEntries(state.currentEvent?.transcripts || []); if (entries.length <= 1) return []; const result=[]; let totalChars=0; for (let i=entries.length-2;i>=0;i--) { const entry=entries[i]; const text=String(getTextForEntry(entry) || '').trim(); if (!text) continue; const nextChars=totalChars + text.length; const canForceAdd=result.length < HISTORY_MIN_ITEMS; const canBudgetAdd=result.length < HISTORY_MAX_ITEMS && nextChars <= HISTORY_CHAR_BUDGET; if (!canForceAdd && !canBudgetAdd) break; result.push(entry); totalChars=nextChars; if (result.length >= HISTORY_MAX_ITEMS) break; } return result; }
function detectPreferredSupportedLanguage(available = []) { const candidates=[...(navigator.languages || []), navigator.language].filter(Boolean); for (const raw of candidates) { const code=String(raw).toLowerCase(); for (const key of available) { if (code.startsWith(key)) return key; } if ((code.startsWith('nb') || code.startsWith('nn') || code.startsWith('no')) && available.includes('no')) return 'no'; } return available[0] || 'en'; }
function syncLanguageOptions(event) { const select=$('languageSelect'); if (!select) return; const available=Array.from(new Set(event?.targetLangs || [])); select.innerHTML = available.map(lang=>`<option value="${lang}">${langNames[lang] || lang.toUpperCase()}</option>`).join(''); if (!state.languageInitialized) { select.value = detectPreferredSupportedLanguage(available); state.languageInitialized=true; } if (!available.includes(select.value)) select.value = available[0] || 'en'; state.currentLanguage=select.value; }
function updateTopMeta() { if (!state.currentEvent) return; $('participantEventName').textContent = state.currentEvent.name || 'Eveniment live'; const sourceName=langNames[state.currentEvent.sourceLang] || state.currentEvent.sourceLang?.toUpperCase() || '-'; const targetName=langNames[state.currentLanguage] || state.currentLanguage.toUpperCase(); $('participantEventMeta').textContent = state.mode === 'song' ? `Song mode · Traducere: ${targetName}` : `Intrare: ${sourceName} · Traducere: ${targetName}`; }
function stopSpeech() { try { window.speechSynthesis?.cancel(); } catch (_) {} }
function getVoiceForCurrentLanguage() { const locale=voiceLocales[state.currentLanguage] || 'en-US'; const voices=window.speechSynthesis ? window.speechSynthesis.getVoices() : []; const voice=voices.find((v)=>(v.lang || '').toLowerCase().startsWith(locale.toLowerCase().split('-')[0])); return { locale, voice: voice || null }; }
function speakText(text) { if (!text || !state.localAudioEnabled || state.serverAudioMuted) return; stopSpeech(); try { const utter=new SpeechSynthesisUtterance(text); const { locale, voice }=getVoiceForCurrentLanguage(); utter.lang=locale; if (voice) utter.voice=voice; utter.rate=1; utter.pitch=1; window.speechSynthesis?.speak(utter); } catch (_) {} }
function renderSongView() { const lastTextEl=$('lastText'); if (lastTextEl) lastTextEl.textContent = state.songState?.translations?.[state.currentLanguage] || 'Aștept traducerea...'; const historyEl=$('history'); const history=state.songState?.history || []; historyEl.innerHTML = history.length ? history.slice().reverse().map(item=>`<div class="history-item participant-history-item">${escapeHtml(item.translations?.[state.currentLanguage] || '')}</div>`).join('') : '<div class="small">Încă nu există istoric de cântări.</div>'; updateTopMeta(); }
function renderLiveView({ announce = false } = {}) { if (!state.currentEvent) return; if (state.mode === 'song') { renderSongView(); return; } const latestEntry=getLatestEntry(); state.lastLiveEntryId=latestEntry?.id || null; $('lastText').textContent = latestEntry ? getTextForEntry(latestEntry) : 'Aștept traducerea...'; const entries=getHistoryEntries(); $('history').innerHTML = entries.length ? entries.map(entry=>`<div class="history-item participant-history-item" data-entry-id="${entry.id}"><div class="history-text">${escapeHtml(getTextForEntry(entry))}</div></div>`).join('') : '<div class="small">Încă nu există text anterior.</div>'; updateTopMeta(); if (announce && latestEntry && latestEntry.id !== state.lastSpokenEntryId) { state.lastSpokenEntryId=latestEntry.id; speakText(getTextForEntry(latestEntry)); } }
function updateEntryInState(payload) { if (!state.currentEvent) return; const entry=getEntryById(payload.entryId); if (!entry) return; entry.sourceLang=payload.sourceLang; entry.original=payload.original; entry.translations=payload.translations || {}; entry.edited=true; }
function handleLanguageChange() { state.currentLanguage = $('languageSelect')?.value || 'no'; if (state.currentEvent?.id) socket.emit('participant_language', { eventId: state.currentEvent.id, language: state.currentLanguage }); renderLiveView({ announce:false }); }
async function resolveEventId() { if (state.fixedEventId) return state.fixedEventId; try { const res=await fetch('/api/events/active'); const data=await res.json(); if (data.ok && data.event?.id) return data.event.id; } catch (_) {} return ''; }
async function joinParticipantEvent() { const eventId=await resolveEventId(); if (!eventId) return setStatus('Nu există eveniment activ.'); socket.emit('join_event', { eventId, role:'participant', language: $('languageSelect')?.value || state.currentLanguage, participantId: state.participantId }); }

socket.on('connect', async ()=>{ setStatus('Conectare...'); await joinParticipantEvent(); });
socket.on('disconnect', ()=>setStatus('Reconectare...'));
socket.on('join_error', ({ message })=>setStatus(message || 'Nu mă pot conecta la eveniment.'));
socket.on('joined_event', ({ event, role }) => { if (role !== 'participant') return; state.currentEvent=event; state.serverAudioMuted=!!event.audioMuted; state.mode=event.mode || 'live'; state.songState=event.songState || null; syncLanguageOptions(event); renderLiveView({ announce:false }); setParticipantUpdating(false); setStatus(state.serverAudioMuted ? 'Audio oprit de admin.' : 'Conectat la eveniment.'); });
socket.on('transcript_entry', (entry) => { if (!state.currentEvent) return; state.currentEvent.transcripts = state.currentEvent.transcripts || []; const exists=getEntryById(entry.id); if (!exists) state.currentEvent.transcripts.push(entry); setParticipantUpdating(false); renderLiveView({ announce:true }); });
socket.on('transcript_source_updated', (payload)=>{ if (!state.currentEvent) return; updateEntryInState(payload); setParticipantUpdating(false); renderLiveView({ announce:false }); });
socket.on('entry_refreshing', ({ entryId })=>{ if (entryId && entryId === state.lastLiveEntryId) setParticipantUpdating(true); });
socket.on('entry_refresh_failed', ({ entryId })=>{ if (entryId && entryId === state.lastLiveEntryId) setParticipantUpdating(false); });
socket.on('audio_state', ({ audioMuted })=>{ state.serverAudioMuted=!!audioMuted; if (state.serverAudioMuted) { stopSpeech(); setStatus('Audio oprit de admin.'); } else setStatus(state.localAudioEnabled ? 'Audio activ.' : 'Audio local în pauză.'); });
socket.on('active_event_changed', async ()=>{ if (!state.fixedEventId) await joinParticipantEvent(); });
socket.on('mode_changed', ({ mode })=>{ state.mode = mode || 'live'; renderLiveView({ announce:false }); });
socket.on('song_state', (songState)=>{ state.songState=songState; state.mode='song'; renderSongView(); const currentText = songState?.translations?.[state.currentLanguage] || ''; if (currentText) speakText(currentText); });
socket.on('song_clear', ()=>{ state.songState=null; state.mode='live'; renderLiveView({ announce:false }); });

$('languageSelect')?.addEventListener('change', handleLanguageChange);
$('playAudioBtn')?.addEventListener('click', ()=>{ state.localAudioEnabled=true; setStatus(state.serverAudioMuted ? 'Audio oprit de admin.' : 'Audio local activ.'); if (state.mode === 'song') speakText(state.songState?.translations?.[state.currentLanguage] || ''); else { const latest=getLatestEntry(); if (latest) speakText(getTextForEntry(latest)); } });
$('pauseAudioBtn')?.addEventListener('click', ()=>{ state.localAudioEnabled=false; stopSpeech(); setStatus('Audio local în pauză.'); });
try { window.speechSynthesis?.getVoices(); window.speechSynthesis.onvoiceschanged = () => {}; } catch (_) {}
