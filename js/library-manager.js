import { supabase } from './supabaseClient.js';

const $ = id => document.getElementById(id);

function esc(value) {
    return String(value ?? '').replace(/[&<>'\"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '\"': '&quot;'
    }[char]));
}

async function getUser() {
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user || null;
}

async function loadTracks() {
    if (!supabase) return [];
    const user = await getUser();
    if (!user) return [];
    const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) {
        console.error('Could not load editable signals:', error);
        return [];
    }
    return data || [];
}

function ensureEditDialog() {
    if ($('edit-dialog')) return $('edit-dialog');

    const dialog = document.createElement('dialog');
    dialog.id = 'edit-dialog';
    dialog.className = 'vault-dialog';
    dialog.innerHTML = `
        <form id="edit-form" class="dialog-card">
            <button type="button" class="dialog-close" id="edit-close">×</button>
            <span class="micro-label">SIGNAL ARCHIVE</span>
            <h2>EDIT SIGNAL</h2>
            <p class="dialog-note">Change the identity, artwork, or audio attached to this signal.</p>
            <div class="form-grid">
                <label>TITLE<input id="edit-title" name="title" required></label>
                <label>ARTIST<input id="edit-artist" name="artist" required></label>
                <label>ALBUM<input id="edit-album" name="album"></label>
                <label>GENRE<input id="edit-genre" name="genre"></label>
            </div>
            <label class="file-drop">REPLACE AUDIO<input id="edit-audio" type="file" accept="audio/*"><span id="edit-audio-name">Keep current audio</span></label>
            <label class="file-drop">REPLACE COVER<input id="edit-cover" type="file" accept="image/*"><span id="edit-cover-name">Keep current cover</span></label>
            <button id="save-edit" class="room-action" type="submit">SAVE SIGNAL</button>
            <div id="edit-progress" class="upload-progress"></div>
        </form>`;
    document.body.appendChild(dialog);

    $('edit-close').addEventListener('click', () => dialog.close());
    $('edit-audio').addEventListener('change', () => {
        $('edit-audio-name').textContent = $('edit-audio').files[0]?.name || 'Keep current audio';
    });
    $('edit-cover').addEventListener('change', () => {
        $('edit-cover-name').textContent = $('edit-cover').files[0]?.name || 'Keep current cover';
    });

    return dialog;
}

let editingTrack = null;

async function openEditor(track) {
    const dialog = ensureEditDialog();
    editingTrack = track;
    $('edit-title').value = track.title || '';
    $('edit-artist').value = track.artist || '';
    $('edit-album').value = track.album || '';
    $('edit-genre').value = track.genre || '';
    $('edit-audio').value = '';
    $('edit-cover').value = '';
    $('edit-audio-name').textContent = 'Keep current audio';
    $('edit-cover-name').textContent = 'Keep current cover';
    $('edit-progress').textContent = '';
    dialog.showModal();
}

async function replaceStorageFile(bucket, oldPath, file, userId) {
    if (!file?.size) return oldPath || null;

    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false
    });
    if (error) throw error;

    if (oldPath) {
        const { error: removeError } = await supabase.storage.from(bucket).remove([oldPath]);
        if (removeError) console.warn(`Could not remove old ${bucket} file:`, removeError);
    }
    return path;
}

async function saveEdit(event) {
    event.preventDefault();
    if (!editingTrack || !supabase) return;

    const user = await getUser();
    if (!user) return;

    const button = $('save-edit');
    button.disabled = true;
    $('edit-progress').textContent = 'SAVING SIGNAL...';

    try {
        const audioFile = $('edit-audio').files[0];
        const coverFile = $('edit-cover').files[0];

        const audioPath = await replaceStorageFile('audio', editingTrack.audio_path, audioFile, user.id);
        const coverPath = await replaceStorageFile('covers', editingTrack.cover_path, coverFile, user.id);

        const { error } = await supabase
            .from('tracks')
            .update({
                title: $('edit-title').value.trim() || 'Untitled',
                artist: $('edit-artist').value.trim() || 'Unknown Artist',
                album: $('edit-album').value.trim() || null,
                genre: $('edit-genre').value.trim() || null,
                audio_path: audioPath,
                cover_path: coverPath
            })
            .eq('id', editingTrack.id)
            .eq('user_id', user.id);

        if (error) throw error;

        $('edit-progress').textContent = 'SIGNAL UPDATED.';
        setTimeout(() => window.location.reload(), 250);
    } catch (error) {
        console.error('Signal edit failed:', error);
        $('edit-progress').textContent = error.message || 'Could not update signal.';
        button.disabled = false;
    }
}

function injectEditButtons() {
    const container = $('list-container');
    if (!container) return;

    container.querySelectorAll('.list-row').forEach(row => {
        if (row.querySelector('.signal-edit')) return;

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'signal-edit';
        edit.textContent = 'EDIT';
        edit.setAttribute('aria-label', 'Edit signal');
        edit.addEventListener('click', async event => {
            event.stopPropagation();
            const tracks = await loadTracks();
            const track = tracks[Number(row.dataset.i)];
            if (track) openEditor(track);
        });
        row.appendChild(edit);
    });
}

function setupBulkUpload() {
    const form = $('upload-form');
    const input = $('audio-file');
    if (!form || !input || !supabase) return;

    input.multiple = true;
    const label = $('audio-file-name');
    const artistInput = form.querySelector('[name="artist"]');
    const titleInput = form.querySelector('[name="title"]');
    artistInput.required = false;
    titleInput.required = false;

    input.addEventListener('change', () => {
        const files = [...input.files];
        label.textContent = files.length
            ? `${files.length} signal${files.length === 1 ? '' : 's'} selected`
            : 'Choose one or more audio files';
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.cancelable) return;

        const user = await getUser();
        const files = [...input.files];
        if (!user || !files.length) {
            $('upload-progress').textContent = 'Select one or more audio files.';
            return;
        }

        const artist = artistInput.value.trim() || 'Unknown Artist';
        const album = form.querySelector('[name="album"]').value.trim() || null;
        const genre = form.querySelector('[name="genre"]').value.trim() || null;
        const coverFile = $('cover-file').files[0] || null;
        const title = titleInput.value.trim();
        const button = $('submit-upload');

        button.disabled = true;
        $('upload-progress').textContent = `UPLOADING 0 / ${files.length} SIGNALS...`;

        let completed = 0;
        try {
            for (const audioFile of files) {
                const base = `${user.id}/${crypto.randomUUID()}`;
                const safeName = audioFile.name.replace(/[^a-z0-9._-]/gi, '_');
                const audioPath = `${base}-${safeName}`;

                let result = await supabase.storage.from('audio').upload(audioPath, audioFile, {
                    contentType: audioFile.type || 'audio/mpeg',
                    upsert: false
                });
                if (result.error) throw result.error;

                let coverPath = null;
                if (coverFile?.size) {
                    const coverName = coverFile.name.replace(/[^a-z0-9._-]/gi, '_');
                    coverPath = `${base}-${coverName}`;
                    result = await supabase.storage.from('covers').upload(coverPath, coverFile, {
                        contentType: coverFile.type || 'image/jpeg',
                        upsert: false
                    });
                    if (result.error) throw result.error;
                }

                const filenameTitle = audioFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
                const { error } = await supabase.from('tracks').insert({
                    user_id: user.id,
                    title: files.length === 1 && title ? title : (filenameTitle || 'Untitled'),
                    artist,
                    album,
                    genre,
                    audio_path: audioPath,
                    cover_path: coverPath
                });
                if (error) throw error;

                completed += 1;
                $('upload-progress').textContent = `UPLOADING ${completed} / ${files.length} SIGNALS...`;
            }

            $('upload-progress').textContent = `${completed} SIGNAL${completed === 1 ? '' : 'S'} ADDED TO THE VAULT.`;
            setTimeout(() => window.location.reload(), 400);
        } catch (error) {
            console.error('Bulk signal upload failed:', error);
            $('upload-progress').textContent = `${completed} uploaded. ${error.message || 'Upload failed.'}`;
            button.disabled = false;
        }
    }, true);
}

function watchList() {
    const container = $('list-container');
    if (!container) return;
    const observer = new MutationObserver(injectEditButtons);
    observer.observe(container, { childList: true, subtree: true });
    injectEditButtons();
}

document.addEventListener('DOMContentLoaded', () => {
    ensureEditDialog();
    $('edit-form').addEventListener('submit', saveEdit);
    setupBulkUpload();
    watchList();
});
