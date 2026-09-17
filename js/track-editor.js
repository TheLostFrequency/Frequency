import { supabase } from './supabaseClient.js';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
}[char]));

let authUser = null;
let editingTrack = null;
let lastListSignature = '';

const style = document.createElement('style');
style.textContent = `
.track-edit-control{display:inline-flex;align-items:center;justify-content:center;margin-left:14px;padding:7px 9px;border:1px solid rgba(255,255,255,.13);color:rgba(255,255,255,.48);font-size:7px;letter-spacing:.18em;line-height:1;vertical-align:middle;transition:.2s;cursor:pointer}
.track-edit-control:hover{color:#fff;border-color:rgba(196,42,32,.65);background:rgba(196,42,32,.08)}
.list-row .track-edit-control{position:relative;z-index:3}
.track-edit-dialog{width:min(620px,92vw);border:1px solid rgba(255,255,255,.14);background:linear-gradient(145deg,rgba(22,20,19,.99),rgba(3,3,3,.99));color:#f3f3f0;padding:0;box-shadow:0 40px 120px #000,0 0 80px rgba(90,15,12,.14)}
.track-edit-dialog::backdrop{background:rgba(0,0,0,.72);backdrop-filter:blur(5px)}
.track-edit-card{padding:30px;position:relative}
.track-edit-card h2{font-size:18px;font-weight:300;letter-spacing:.18em;margin:7px 0 8px}
.track-edit-note{margin:0 0 22px;color:rgba(255,255,255,.4);font-size:9px;line-height:1.6;letter-spacing:.08em}
.track-edit-close{position:absolute;right:20px;top:18px;font-size:24px;color:rgba(255,255,255,.4);cursor:pointer}
.track-edit-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.track-edit-field{display:block;color:rgba(255,255,255,.42);font-size:7px;letter-spacing:.2em}
.track-edit-field input{display:block;width:100%;margin-top:7px;padding:11px 12px;border:1px solid rgba(255,255,255,.1);background:#070707;color:#fff;outline:none;font-size:10px;letter-spacing:.04em}
.track-edit-field input:focus{border-color:rgba(196,42,32,.7);box-shadow:0 0 18px rgba(196,42,32,.08)}
.track-edit-file{display:block;margin-top:14px;padding:14px;border:1px dashed rgba(255,255,255,.13);color:rgba(255,255,255,.42);font-size:7px;letter-spacing:.2em;cursor:pointer}
.track-edit-file input{display:none}
.track-edit-file span{display:block;margin-top:7px;color:rgba(255,255,255,.7);font-size:9px;letter-spacing:.05em;text-transform:none}
.track-edit-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
.track-edit-actions button{border:1px solid rgba(255,255,255,.2);padding:11px 16px;font-size:8px;letter-spacing:.2em;color:#fff;cursor:pointer}
.track-edit-actions button:hover{background:#fff;color:#000}
.track-edit-actions .track-edit-save{border-color:rgba(196,42,32,.65);background:rgba(196,42,32,.1)}
.track-edit-actions .track-edit-save:hover{background:#c42a20;color:#fff}
.track-edit-status{min-height:15px;margin-top:12px;color:rgba(255,255,255,.45);font-size:8px;letter-spacing:.12em;text-align:right}
@media(max-width:620px){.track-edit-grid{grid-template-columns:1fr}.track-edit-card{padding:24px}.track-edit-actions{flex-wrap:wrap}}
`;
document.head.appendChild(style);

const dialog = document.createElement('dialog');
dialog.id = 'track-edit-dialog';
dialog.className = 'track-edit-dialog';
dialog.innerHTML = `
<form id="track-edit-form" class="track-edit-card">
    <button type="button" class="track-edit-close" id="track-edit-close" aria-label="Close">×</button>
    <span class="micro-label">VAULT MAINTENANCE</span>
    <h2>EDIT SIGNAL</h2>
    <p class="track-edit-note">Update the information attached to this signal. Changes are saved directly to your private vault.</p>
    <div class="track-edit-grid">
        <label class="track-edit-field">TITLE<input id="edit-title" required></label>
        <label class="track-edit-field">ARTIST<input id="edit-artist" required></label>
        <label class="track-edit-field">ALBUM<input id="edit-album"></label>
        <label class="track-edit-field">GENRE<input id="edit-genre"></label>
        <label class="track-edit-field">YEAR<input id="edit-year" type="number" min="0" max="9999" placeholder="Optional"></label>
    </div>
    <label class="track-edit-file">REPLACE AUDIO<input id="edit-audio" type="file" accept="audio/*"><span id="edit-audio-name">Keep current audio</span></label>
    <label class="track-edit-file">REPLACE COVER ART<input id="edit-cover" type="file" accept="image/*"><span id="edit-cover-name">Keep current cover</span></label>
    <div id="track-edit-status" class="track-edit-status"></div>
    <div class="track-edit-actions"><button type="button" id="track-edit-cancel">CANCEL</button><button type="submit" class="track-edit-save" id="track-edit-save">SAVE CHANGES</button></div>
</form>`;
document.body.appendChild(dialog);

async function getUser() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    authUser = data.session?.user || null;
    return authUser;
}

async function fetchTracks() {
    if (!supabase || !authUser) return [];
    const { data, error } = await supabase.from('tracks').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
}

function addEditControls() {
    const container = $('list-container');
    if (!container) return;
    const rows = [...container.querySelectorAll('.list-row')];
    const signature = rows.map((row, index) => `${index}:${row.dataset.i}:${row.textContent}`).join('|');
    if (signature === lastListSignature) return;
    lastListSignature = signature;

    rows.forEach((row, index) => {
        if (row.querySelector('.track-edit-control')) return;
        const control = document.createElement('span');
        control.className = 'track-edit-control';
        control.dataset.editIndex = row.dataset.i ?? index;
        control.textContent = 'EDIT';
        control.setAttribute('role', 'button');
        control.setAttribute('tabindex', '0');
        control.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            openEditor(Number(control.dataset.editIndex));
        });
        control.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                openEditor(Number(control.dataset.editIndex));
            }
        });
        const meta = row.querySelector('div');
        (meta || row).appendChild(control);
    });
}

async function openEditor(index) {
    try {
        await getUser();
        if (!authUser) {
            $('toast')?.replaceChildren(document.createTextNode('Enter your vault before editing.'));
            $('auth-dialog')?.showModal();
            return;
        }
        const tracks = await fetchTracks();
        const track = tracks[index];
        if (!track) return;
        editingTrack = track;
        $('edit-title').value = track.title || '';
        $('edit-artist').value = track.artist || '';
        $('edit-album').value = track.album || '';
        $('edit-genre').value = track.genre || '';
        $('edit-year').value = track.year ?? '';
        $('edit-audio-name').textContent = track.audio_path?.split('/').pop() || 'Keep current audio';
        $('edit-cover-name').textContent = track.cover_path?.split('/').pop() || 'Keep current cover';
        $('track-edit-status').textContent = '';
        dialog.showModal();
    } catch (error) {
        console.error('Could not open signal editor:', error);
        $('track-edit-status').textContent = error.message || 'Could not open editor.';
    }
}

async function replaceFile(bucket, oldPath, file, userId) {
    if (!file?.size) return oldPath || null;
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type || (bucket === 'covers' ? 'image/jpeg' : 'audio/mpeg'),
        upsert: false
    });
    if (error) throw error;
    if (oldPath) {
        const { error: removeError } = await supabase.storage.from(bucket).remove([oldPath]);
        if (removeError) console.warn(`Could not remove old ${bucket} file:`, removeError);
    }
    return path;
}

$('edit-audio').addEventListener('change', event => {
    $('edit-audio-name').textContent = event.target.files[0]?.name || 'Keep current audio';
});
$('edit-cover').addEventListener('change', event => {
    $('edit-cover-name').textContent = event.target.files[0]?.name || 'Keep current cover';
});
$('track-edit-close').addEventListener('click', () => dialog.close());
$('track-edit-cancel').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
});

$('track-edit-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!editingTrack || !authUser || !supabase) return;

    const save = $('track-edit-save');
    const status = $('track-edit-status');
    save.disabled = true;
    status.textContent = 'SAVING SIGNAL...';

    try {
        const audioFile = $('edit-audio').files[0];
        const coverFile = $('edit-cover').files[0];
        const audioPath = await replaceFile('audio', editingTrack.audio_path, audioFile, authUser.id);
        const coverPath = await replaceFile('covers', editingTrack.cover_path, coverFile, authUser.id);
        const yearValue = $('edit-year').value.trim();

        const { error } = await supabase.from('tracks').update({
            title: $('edit-title').value.trim(),
            artist: $('edit-artist').value.trim(),
            album: $('edit-album').value.trim() || null,
            genre: $('edit-genre').value.trim() || null,
            year: yearValue ? Number(yearValue) : null,
            audio_path: audioPath,
            cover_path: coverPath
        }).eq('id', editingTrack.id).eq('user_id', authUser.id);
        if (error) throw error;

        dialog.close();
        editingTrack = null;
        $('edit-audio').value = '';
        $('edit-cover').value = '';
        lastListSignature = '';
        window.dispatchEvent(new CustomEvent('frequency:track-updated'));
        const toast = $('toast');
        if (toast) {
            toast.textContent = 'Signal updated.';
            toast.classList.add('show');
            clearTimeout(toast._editTimer);
            toast._editTimer = setTimeout(() => toast.classList.remove('show'), 2500);
        }
    } catch (error) {
        console.error('Signal update failed:', error);
        status.textContent = error.message || 'Could not save changes.';
    } finally {
        save.disabled = false;
    }
});

const observer = new MutationObserver(addEditControls);
const startObserver = () => {
    const container = $('list-container');
    if (container) observer.observe(container, { childList: true, subtree: true, characterData: true });
    addEditControls();
};
startObserver();

supabase?.auth.onAuthStateChange((_event, sessionData) => {
    authUser = sessionData?.user || null;
    lastListSignature = '';
    setTimeout(addEditControls, 0);
});

setInterval(addEditControls, 1200);
