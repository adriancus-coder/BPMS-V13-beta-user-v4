const socket = io();
const params = new URLSearchParams(window.location.search);
const state = { fixedEventId: params.get('event') || '', currentLanguage: params.get('lang') || 'no', currentEvent: null, mode: 'live', songState: null };
function $(id){ return document.getElementById(id); }
function textFit(el) {
  if (!el) return;
  const stage = document.querySelector('.display-stage');
  let size = Math.min(window.innerWidth * 0.08, window.innerHeight * 0.16);
  el.style.fontSize = `${size}px`;
  let tries = 0;
  while ((el.scrollHeight > stage.clientHeight * 0.75 || el.scrollWidth > stage.clientWidth * 0.95) && size > 22 && tries < 60) {
    size -= 2; el.style.fontSize = `${size}px`; tries += 1;
  }
}
function renderHistory(items) { const box=$('displayHistory'); box.innerHTML = items.length ? items.slice().reverse().map(text=>`<div class="display-history-item">${text}</div>`).join('') : ''; }
function renderLive() { const entries = [...(state.currentEvent?.transcripts || [])].sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0)); const latest = entries[entries.length-1]; const current = latest?.translations?.[state.currentLanguage] || latest?.original || 'Aștept conținut...'; $('displayCurrent').textContent = current; renderHistory(entries.slice(-5,-1).map(entry=>entry.translations?.[state.currentLanguage] || entry.original || '')); $('displayModeBadge').textContent='LIVE'; textFit($('displayCurrent')); }
function renderSong() { const current = state.songState?.translations?.[state.currentLanguage] || 'Aștept traducerea...'; $('displayCurrent').textContent = current; renderHistory((state.songState?.history || []).map(item=>item.translations?.[state.currentLanguage] || '').filter(Boolean)); $('displayModeBadge').textContent='SONG'; textFit($('displayCurrent')); }
function render() { $('displayEventName').textContent = state.currentEvent?.name || ''; if (state.mode === 'song') renderSong(); else renderLive(); }
async function resolveEventId() { if (state.fixedEventId) return state.fixedEventId; try { const res=await fetch('/api/events/active'); const data=await res.json(); if (data.ok && data.event?.id) return data.event.id; } catch (_) {} return ''; }
async function joinEvent() { const eventId=await resolveEventId(); if (!eventId) return; socket.emit('join_event', { eventId, role:'participant', language: state.currentLanguage, participantId: `display_${state.currentLanguage}` }); }
socket.on('connect', joinEvent);
socket.on('joined_event', ({ event })=>{ state.currentEvent=event; state.mode=event.mode || 'live'; state.songState=event.songState || null; render(); });
socket.on('transcript_entry', (entry)=>{ if (!state.currentEvent) return; state.currentEvent.transcripts = state.currentEvent.transcripts || []; if (!state.currentEvent.transcripts.find(x=>x.id===entry.id)) state.currentEvent.transcripts.push(entry); if (state.mode !== 'song') renderLive(); });
socket.on('transcript_source_updated', ({ entryId, sourceLang, original, translations })=>{ if (!state.currentEvent) return; const entry=(state.currentEvent.transcripts || []).find(x=>x.id===entryId); if (!entry) return; entry.sourceLang=sourceLang; entry.original=original; entry.translations=translations || {}; if (state.mode !== 'song') renderLive(); });
socket.on('mode_changed', ({ mode })=>{ state.mode=mode || 'live'; render(); });
socket.on('song_state', (songState)=>{ state.songState=songState; state.mode='song'; renderSong(); });
socket.on('song_clear', ()=>{ state.songState=null; state.mode='live'; render(); });
socket.on('active_event_changed', async ()=>{ if (!state.fixedEventId) await joinEvent(); });
$('displayLangBtn')?.addEventListener('click', ()=>{ const langs = state.currentEvent?.targetLangs || ['no']; const index = langs.indexOf(state.currentLanguage); state.currentLanguage = langs[(index + 1) % langs.length] || langs[0] || 'no'; socket.emit('participant_language', { eventId: state.currentEvent?.id, language: state.currentLanguage }); render(); });
$('fullscreenBtn')?.addEventListener('click', async ()=>{ const el=document.documentElement; if (!document.fullscreenElement) { if (el.requestFullscreen) await el.requestFullscreen(); } else if (document.exitFullscreen) await document.exitFullscreen(); });
window.addEventListener('resize', ()=>textFit($('displayCurrent')));
