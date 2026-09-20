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

function injectStyles() {
    if ($('library-manager-style')) return;
    const style = document.createElement('style');
    style.id = 'library-manager-style';
    style.textContent = `
        .list-row { position: relative; padding-right: 82px !important; }
        .signal-edit {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            z-index: 3;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 52px;
            height: 28px;
            padding: 0 9px;
            border: 1px solid rgba(255,255,255,.18);
            background: rgba(0,0,0,.55);
            color: rgba(255,255,255,.58);
            font: 8px/1 Arial, Helvetica, sans-serif;
            letter-spacing: .18em;
            cursor: pointer;
            transition: .2s ease;
            user-select: none;
        }
        .signal-edit:hover,
        .signal-edit:focus-visible {
            color: #fff;
            border-color: rgba(196,42,32,.75);
            background: rgba(196,42,32,.12);
            outline: none;
            box-shadow: 0 0 18px rgba(196,42,32,.12);
        }
        #edit-dialog .dialog-card,
        #upload-dialog .dialog-card { max-height: 90vh; overflow: auto; }
        #upload-form .upload-global-fields { display: none; }
        .upload-signal-editor {
            display: grid;
            gap: 12px;
            margin: 14px 0 16px;
        }
        .upload-signal-card {
            position: relative;
            padding: 16px;
            border: 1px solid rgba(255,255,255,.12);
            background: rgba(0,0,0,.28);
            box-shadow: inset 0 0 0 1px rgba(255,255,255,.025);
        }
        .upload-signal-card::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 2px;
            background: rgba(196,42,32,.72);
        }
        .upload-signal-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
        }
        .upload-signal-number {
            font: 9px/1 Arial, Helvetica, sans-serif;
            letter-spacing: .2em;
            color: rgba(255,255,255,.42);
        }
        .upload-signal-filename {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font: 11px/1.4 Arial, Helvetica, sans-serif;
            color: rgba(255,255,255,.7);
        }
        .upload-signal-card .form-grid { margin: 0 0 10px; }
        .upload-signal-card .file-drop { margin: 0; }
        .upload-signal-cover-name { display: block; }
        .upload-signal-hint {
            margin: 0 0 10px;
            color: rgba(255,255,255,.38);
            font: 9px/1.5 Arial, Helvetica, sans-serif;
            letter-spacing: .08em;
            text-transform: uppercase;
        }
        .edit-actions {
            display: flex;
            gap: 10px;
            align-items: stretch;
            margin-top: 4px;
        }
        .edit-actions .room-action {
            flex: 1;
        }
        .edit-delete-button {
            border-color: rgba(196,42,32,.38);
            color: rgba(255,120,110,.78);
        }
        .edit-delete-button:hover,
        .edit-delete-button:focus-visible {
            border-color: rgba(196,42,32,.9);
            color: #fff;
            background: rgba(196,42,32,.16);
            box-shadow: 0 0 22px rgba(196,42,32,.12);
        }
        .edit-delete-button:disabled {
            opacity: .45;
            cursor: wait;
        }
        @media(max-width:600px) {
            .edit-actions {
                flex-direction: column;
            }
        }
    `;
    document.head.appendChild(style);
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
            <div class="edit-actions">
                <button id="save-edit" class="room-action" type="submit">SAVE SIGNAL</button>
                <button id="delete-edit" class="room-action edit-delete-button" type="button">DELETE SIGNAL</button>
            </div>
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

function openEditor(track) {
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

async function uploadReplacement(bucket, file, userId) {
    if (!file?.size) return null;
    const safeName = file.name.replace(/[^a-z0-9._-]/gi, '_');
    const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false
    });
    if (error) throw error;
    return path;
}

async function deleteEdit() {
    if (!editingTrack || !supabase) return;

    const user = await getUser();
    if (!user) return;

    const confirmed = window.confirm(
        'DELETE SIGNAL?\n\nThis will permanently remove "' +
        (editingTrack.title || 'Untitled') +
        '" from your Frequency vault.'
    );
    if (!confirmed) return;

    const deleteButton = $('delete-edit');
    const saveButton = $('save-edit');
    deleteButton.disabled = true;
    saveButton.disabled = true;
    $('edit-progress').textContent = 'DELETING SIGNAL...';

    try {
        const { error } = await supabase
            .from('tracks')
            .delete()
            .eq('id', editingTrack.id)
            .eq('user_id', user.id);

        if (error) throw error;

        const removals = [];
        if (editingTrack.audio_path) removals.push(['audio', editingTrack.audio_path]);
        if (editingTrack.cover_path) removals.push(['covers', editingTrack.cover_path]);

        for (const [bucket, path] of removals) {
            const { error: removeError } = await supabase.storage.from(bucket).remove([path]);
            if (removeError) console.warn('Could not remove old ' + bucket + ' file:', removeError);
        }

        $('edit-progress').textContent = 'SIGNAL DELETED.';
        setTimeout(() => {
            $('edit-dialog')?.close();
            window.location.reload();
        }, 350);
    } catch (error) {
        console.error('Signal delete failed:', error);
        $('edit-progress').textContent = error.message || 'Could not delete signal.';
        deleteButton.disabled = false;
        saveButton.disabled = false;
    }
}

async function saveEdit(event) {
    event.preventDefault();
    if (!editingTrack || !supabase) return;

    const user = await getUser();
    if (!user) return;

    const button = $('save-edit');
    button.disabled = true;
    $('edit-progress').textContent = 'SAVING SIGNAL...';

    let newAudioPath = null;
    let newCoverPath = null;

    try {
        const audioFile = $('edit-audio').files[0];
        const coverFile = $('edit-cover').files[0];

        newAudioPath = await uploadReplacement('audio', audioFile, user.id);
        newCoverPath = await uploadReplacement('covers', coverFile, user.id);

        const audioPath = newAudioPath || editingTrack.audio_path || null;
        const coverPath = coverFile?.size ? newCoverPath : (editingTrack.cover_path || null);

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

        const removals = [];
        if (newAudioPath && editingTrack.audio_path) removals.push(['audio', editingTrack.audio_path]);
        if (newCoverPath && editingTrack.cover_path) removals.push(['covers', editingTrack.cover_path]);
        for (const [bucket, path] of removals) {
            const { error: removeError } = await supabase.storage.from(bucket).remove([path]);
            if (removeError) console.warn(`Could not remove old ${bucket} file:`, removeError);
        }

        $('edit-progress').textContent = 'SIGNAL UPDATED.';
        dialogCloseAndRefresh();
    } catch (error) {
        if (newAudioPath) await supabase.storage.from('audio').remove([newAudioPath]).catch(() => {});
        if (newCoverPath) await supabase.storage.from('covers').remove([newCoverPath]).catch(() => {});
        console.error('Signal edit failed:', error);
        $('edit-progress').textContent = error.message || 'Could not update signal.';
        button.disabled = false;
    }
}

function dialogCloseAndRefresh() {
    const dialog = $('edit-dialog');
    setTimeout(() => {
        dialog?.close();
        window.location.reload();
    }, 350);
}

function injectEditButtons() {
    const container = $('list-container');
    if (!container) return;

    container.querySelectorAll('.list-row').forEach(row => {
        if (row.querySelector('.signal-edit')) return;

        const edit = document.createElement('span');
        edit.className = 'signal-edit';
        edit.textContent = 'EDIT';
        edit.setAttribute('role', 'button');
        edit.setAttribute('tabindex', '0');
        edit.setAttribute('aria-label', 'Edit signal');

        const launch = async event => {
            event.preventDefault();
            event.stopPropagation();
            const tracks = await loadTracks();
            const index = Number(row.dataset.i);
            const track = tracks[index];
            if (track) openEditor(track);
        };

        edit.addEventListener('click', launch);
        edit.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') launch(event);
        });
        row.appendChild(edit);
    });
}

function filenameTitle(name) {
    return name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildUploadEditor(files) {
    const form = $('upload-form');
    const globalFields = form.querySelector('.form-grid');
    const audioLabel = form.querySelector('.file-drop');
    if (!form || !globalFields || !audioLabel) return null;

    globalFields.classList.add('upload-global-fields');

    let editor = $('upload-signal-editor');
    if (!editor) {
        editor = document.createElement('div');
        editor.id = 'upload-signal-editor';
        editor.className = 'upload-signal-editor';
        audioLabel.insertAdjacentElement('afterend', editor);
    }

    editor.innerHTML = '';

    files.forEach((file, index) => {
        const title = filenameTitle(file.name) || 'Untitled';
        const card = document.createElement('div');
        card.className = 'upload-signal-card';
        card.dataset.index = String(index);
        card.innerHTML = `
            <div class="upload-signal-header">
                <span class="upload-signal-number">SIGNAL ${String(index + 1).padStart(2, '0')}</span>
                <span class="upload-signal-filename" title="${esc(file.name)}">${esc(file.name)}</span>
            </div>
            <div class="form-grid">
                <label>TITLE<input data-field="title" required value="${esc(title)}" placeholder="Track title"></label>
                <label>ARTIST<input data-field="artist" required placeholder="Artist"></label>
                <label>ALBUM<input data-field="album" placeholder="Album"></label>
                <label>GENRE<input data-field="genre" placeholder="Genre"></label>
            </div>
            <label class="file-drop">COVER ART<input data-field="cover" type="file" accept="image/*"><span class="upload-signal-cover-name">Choose cover art for this song</span></label>
        `;
        editor.appendChild(card);

        const coverInput = card.querySelector('[data-field="cover"]');
        coverInput.addEventListener('change', () => {
            card.querySelector('.upload-signal-cover-name').textContent = coverInput.files[0]?.name || 'Choose cover art for this song';
        });
    });

    return editor;
}

function setupBulkUpload() {
    const form = $('upload-form');
    const input = $('audio-file');
    if (!form || !input || !supabase) return;

    input.multiple = true;
    const label = $('audio-file-name');

    input.addEventListener('change', () => {
        const files = [...input.files];
        label.textContent = files.length
            ? `${files.length} signal${files.length === 1 ? '' : 's'} selected`
            : 'Choose one or more audio files';
        buildUploadEditor(files);
        $('upload-progress').textContent = '';
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        const user = await getUser();
        const files = [...input.files];
        const editor = $('upload-signal-editor');
        if (!user || !files.length || !editor) {
            $('upload-progress').textContent = 'Select one or more audio files.';
            return;
        }

        const cards = [...editor.querySelectorAll('.upload-signal-card')];
        if (cards.length !== files.length) {
            $('upload-progress').textContent = 'Please select the audio files again.';
            return;
        }

        const metadata = cards.map(card => ({
            title: card.querySelector('[data-field="title"]').value.trim() || 'Untitled',
            artist: card.querySelector('[data-field="artist"]').value.trim() || 'Unknown Artist',
            album: card.querySelector('[data-field="album"]').value.trim() || null,
            genre: card.querySelector('[data-field="genre"]').value.trim() || null,
            coverFile: card.querySelector('[data-field="cover"]').files[0] || null
        }));

        const button = $('submit-upload');
        button.disabled = true;
        $('upload-progress').textContent = `UPLOADING 0 / ${files.length} SIGNALS...`;

        let completed = 0;
        try {
            for (let index = 0; index < files.length; index += 1) {
                const audioFile = files[index];
                const info = metadata[index];
                const base = `${user.id}/${crypto.randomUUID()}`;
                const safeName = audioFile.name.replace(/[^a-z0-9._-]/gi, '_');
                const audioPath = `${base}-${safeName}`;

                let result = await supabase.storage.from('audio').upload(audioPath, audioFile, {
                    contentType: audioFile.type || 'audio/mpeg',
                    upsert: false
                });
                if (result.error) throw result.error;

                let coverPath = null;
                if (info.coverFile?.size) {
                    const coverName = info.coverFile.name.replace(/[^a-z0-9._-]/gi, '_');
                    coverPath = `${base}-${coverName}`;
                    result = await supabase.storage.from('covers').upload(coverPath, info.coverFile, {
                        contentType: info.coverFile.type || 'image/jpeg',
                        upsert: false
                    });
                    if (result.error) throw result.error;
                }

                const { error } = await supabase.from('tracks').insert({
                    user_id: user.id,
                    title: info.title,
                    artist: info.artist,
                    album: info.album,
                    genre: info.genre,
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

function init() {
    injectStyles();
    ensureEditDialog();
    $('edit-form')?.addEventListener('submit', saveEdit);
    $('delete-edit')?.addEventListener('click', deleteEdit);
    setupBulkUpload();
    watchList();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}
