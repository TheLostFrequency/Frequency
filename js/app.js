/**
 * FREQUENCY CORE APPLICATION CONTROLLER
 * Mass Multi-File Upload, Precise Shuffle Engine, Mobile Optimization, Song Editing & Sanitized Storage Keys
 */

let spatialVault = null;
let songsLibrary = [];
let userPlaylists = [];
let currentUser = null;

let currentTrackIndex = 0;
let isShuffle = false;
let isPlaying = false;
let shuffleQueue = [];
let batchSelectedFiles = [];

const audio = document.getElementById('audioElement') || new Audio();

document.addEventListener('DOMContentLoaded', async () => {
    initAudioEngineControls();

    if (typeof SpatialVault !== 'undefined') {
        spatialVault = new SpatialVault('physicalVault', (selectedSong, index) => {
            loadTrackIntoPlayer(index, true);
        });
    }

    initAuth();
    initNavigation();
    initSongManagement();
    initPlaylistManagement();
    initEditSongManagement(); // Edit Song Modal Handler
});

/* ==========================================
   1. AUTHENTICATION CONTROLLER
   ========================================== */
function initAuth() {
    const authModal = document.getElementById('authModal');
    const appContainer = document.getElementById('app');
    const authForm = document.getElementById('authForm');
    const authError = document.getElementById('authError');

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            authModal?.classList.add('hidden');
            appContainer?.classList.remove('hidden');
            loadUserLibrary();
            loadUserPlaylists();
        }
    });

    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (authError) authError.textContent = '';
            const email = document.getElementById('authEmail').value;
            const password = document.getElementById('authPassword').value;

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                if (authError) authError.textContent = error.message;
            } else {
                currentUser = data.user;
                authModal?.classList.add('hidden');
                appContainer?.classList.remove('hidden');
                loadUserLibrary();
                loadUserPlaylists();
            }
        });
    }

    document.getElementById('btnSignUp')?.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            if (authError) authError.textContent = error.message;
        } else {
            if (authError) authError.textContent = 'ACCOUNT CREATED. YOU MAY NOW LOGIN.';
        }
    });

    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    });
}

/* ==========================================
   2. DATA MANAGEMENT (SUPABASE API)
   ========================================== */
async function loadUserLibrary() {
    const { data: songs, error } = await supabaseClient
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });

    if (!error && songs) {
        songsLibrary = songs;
        if (spatialVault) spatialVault.setSongs(songsLibrary);
        renderListView(songsLibrary);
        renderAlbumsView(songsLibrary);

        if (songsLibrary.length > 0 && !audio.src) {
            loadTrackIntoPlayer(0, false);
        }
    }
}

async function loadUserPlaylists() {
    const { data: playlists, error } = await supabaseClient
        .from('playlists')
        .select('*')
        .order('created_at', { ascending: false });

    if (!error && playlists) {
        userPlaylists = playlists;
        renderPlaylistsView(userPlaylists);
    }
}

/* ==========================================
   3. NAVIGATION CONTROLLER
   ========================================== */
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const viewPanels = document.querySelectorAll('.view-panel');

    function switchView(targetView) {
        // Construct target DOM ID (e.g., 'eq' -> 'viewEq', 'collection' -> 'viewCollection')
        const targetId = `view${targetView.charAt(0).toUpperCase() + targetView.slice(1)}`;

        viewPanels.forEach(panel => {
            if (panel.id === targetId) {
                panel.classList.add('active');
                panel.classList.remove('hidden');
            } else {
                panel.classList.remove('active');
                panel.classList.add('hidden');
            }
        });
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchView(targetView);
        });
    });

    const btnCollection = document.getElementById('btnModeCollection');
    const btnList = document.getElementById('btnModeList');

    if (btnCollection && btnList) {
        btnCollection.addEventListener('click', () => {
            btnCollection.classList.add('active');
            btnList.classList.remove('active');
            switchView('collection');
        });

        btnList.addEventListener('click', () => {
            btnList.classList.add('active');
            btnCollection.classList.remove('active');
            switchView('list');
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = songsLibrary.filter(s => 
                (s.title && s.title.toLowerCase().includes(query)) || 
                (s.artist && s.artist.toLowerCase().includes(query)) ||
                (s.album && s.album.toLowerCase().includes(query))
            );
            if (spatialVault) spatialVault.setSongs(filtered);
            renderListView(filtered);
        });
    }
}

/* ==========================================
   4. AUDIO PLAYBACK & SHUFFLE CONTROLLER
   ========================================== */
function initAudioEngineControls() {
    const mainPlayBtn = document.querySelector('.main-play') || document.getElementById('btnPlay');
    const prevBtn = document.querySelector('.ctrl-prev') || document.getElementById('btnPrev');
    const nextBtn = document.querySelector('.ctrl-next') || document.getElementById('btnNext');
    const shuffleBtn = document.querySelector('.ctrl-shuffle') || document.getElementById('btnShuffle');
    const progressBar = document.getElementById('seekSlider');
    const volumeSlider = document.getElementById('volumeSlider');

    if (mainPlayBtn) mainPlayBtn.addEventListener('click', togglePlay);
    if (nextBtn) nextBtn.addEventListener('click', playNextTrack);
    if (prevBtn) prevBtn.addEventListener('click', playPrevTrack);
    if (shuffleBtn) shuffleBtn.addEventListener('click', toggleShuffle);

    if (volumeSlider) {
        audio.volume = volumeSlider.value / 100;
        volumeSlider.addEventListener('input', (e) => {
            audio.volume = e.target.value / 100;
        });
    }

    audio.addEventListener('ended', () => {
        playNextTrack();
    });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration && progressBar) {
            progressBar.value = (audio.currentTime / audio.duration) * 100;
            const currentEl = document.getElementById('currentTime');
            const totalEl = document.getElementById('durationTime');
            if (currentEl) currentEl.textContent = formatTime(audio.currentTime);
            if (totalEl) totalEl.textContent = formatTime(audio.duration);
        }
    });

    if (progressBar) {
        progressBar.addEventListener('input', (e) => {
            if (audio.duration) {
                audio.currentTime = (e.target.value / 100) * audio.duration;
            }
        });
    }
}

function loadTrackIntoPlayer(index, shouldPlay = true) {
    if (!songsLibrary[index]) return;
    currentTrackIndex = index;
    const track = songsLibrary[currentTrackIndex];

    audio.src = track.audio_url;

    const coverUrl = track.cover_url || 'assets/default-cover.jpg';

    document.querySelectorAll('.track-title').forEach(el => el.textContent = track.title || 'Untitled');
    document.querySelectorAll('.track-artist').forEach(el => el.textContent = track.artist || 'Unknown Artist');

    const coverArtEl = document.getElementById('playerCover');
    if (coverArtEl) coverArtEl.style.backgroundImage = `url('${coverUrl}')`;

    if (spatialVault && spatialVault.currentIndex !== index) {
        spatialVault.selectRecordSilently(index);
    }

    if (shouldPlay) {
        audio.play().then(() => {
            isPlaying = true;
            updatePlayButtonIcon();
        }).catch(err => console.error("Playback interrupted:", err));
    } else {
        isPlaying = false;
        updatePlayButtonIcon();
    }
}

function playSelectedTrack(song) {
    const foundIndex = songsLibrary.findIndex(s => s.id === song.id);
    if (foundIndex !== -1) {
        loadTrackIntoPlayer(foundIndex, true);
    }
}

function togglePlay() {
    if (songsLibrary.length === 0) return;

    if (isPlaying) {
        audio.pause();
        isPlaying = false;
    } else {
        if (!audio.src) loadTrackIntoPlayer(currentTrackIndex, false);
        audio.play();
        isPlaying = true;
    }
    updatePlayButtonIcon();
}

function playNextTrack() {
    if (songsLibrary.length === 0) return;

    if (isShuffle) {
        if (shuffleQueue.length === 0) {
            generateShuffleQueue();
        }
        currentTrackIndex = shuffleQueue.pop();
    } else {
        currentTrackIndex = (currentTrackIndex + 1) % songsLibrary.length;
    }
    loadTrackIntoPlayer(currentTrackIndex, true);
}

function playPrevTrack() {
    if (songsLibrary.length === 0) return;
    currentTrackIndex = (currentTrackIndex - 1 + songsLibrary.length) % songsLibrary.length;
    loadTrackIntoPlayer(currentTrackIndex, true);
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    const shuffleBtn = document.querySelector('.ctrl-shuffle') || document.getElementById('btnShuffle');
    if (shuffleBtn) {
        shuffleBtn.classList.toggle('active-mode', isShuffle);
        shuffleBtn.style.color = isShuffle ? '#ffffff' : '#888888';
    }
    if (isShuffle) {
        generateShuffleQueue();
    }
}

function generateShuffleQueue() {
    shuffleQueue = Array.from({ length: songsLibrary.length }, (_, i) => i);
    for (let i = shuffleQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleQueue[i], shuffleQueue[j]] = [shuffleQueue[j], shuffleQueue[i]];
    }
}

function updatePlayButtonIcon() {
    const mainPlayBtn = document.querySelector('.main-play') || document.getElementById('btnPlay');
    if (mainPlayBtn) {
        mainPlayBtn.textContent = isPlaying ? '❚❚' : '▶';
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/* ==========================================
   5. MASS / BATCH MULTI-TRACK UPLOADER (SANITIZED KEYS)
   ========================================== */
function sanitizeFileName(filename) {
    return filename
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '_')
        .replace(/_+/g, '_');
}

function initSongManagement() {
    const songModal = document.getElementById('songModal');
    const btnOpenAdd = document.getElementById('btnOpenAddSong');
    const btnClose = document.getElementById('btnCloseSongModal');
    const songForm = document.getElementById('songForm');
    const btnSubmit = document.getElementById('btnSubmitSong');
    const inputAudioFiles = document.getElementById('inputAudioFiles');
    const batchContainer = document.getElementById('batchContainer');

    if (btnOpenAdd) btnOpenAdd.addEventListener('click', () => songModal?.classList.remove('hidden'));
    if (btnClose) btnClose.addEventListener('click', () => songModal?.classList.add('hidden'));

    if (inputAudioFiles) {
        inputAudioFiles.addEventListener('change', (e) => {
            batchSelectedFiles = Array.from(e.target.files);
            renderBatchInputFields(batchSelectedFiles);
        });
    }

    function renderBatchInputFields(files) {
        if (!batchContainer) return;
        batchContainer.innerHTML = '';

        if (files.length === 0) {
            batchContainer.innerHTML = `<p class="batch-placeholder-text">SELECT ONE OR MORE AUDIO FILES ABOVE TO CUSTOMIZE TRACK METADATA</p>`;
            return;
        }

        files.forEach((file, index) => {
            const cleanTitle = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
            const card = document.createElement('div');
            card.className = 'batch-track-card';
            card.innerHTML = `
                <h4>TRACK #${index + 1}: ${file.name}</h4>
                <div class="form-group">
                    <label>TITLE</label>
                    <input type="text" class="batch-title" value="${cleanTitle}" required />
                </div>
                <div class="form-group">
                    <label>ARTIST</label>
                    <input type="text" class="batch-artist" placeholder="Artist name" required />
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>ALBUM</label>
                        <input type="text" class="batch-album" placeholder="Single" />
                    </div>
                    <div class="form-group">
                        <label>GENRE</label>
                        <input type="text" class="batch-genre" placeholder="Genre" />
                    </div>
                </div>
                <div class="form-group">
                    <label>COVER ARTWORK (OPTIONAL)</label>
                    <input type="file" class="batch-cover" accept="image/*" />
                </div>
            `;
            batchContainer.appendChild(card);
        });
    }

    if (songForm) {
        songForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (batchSelectedFiles.length === 0) {
                alert('Please select at least one audio file.');
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = `UPLOADING 0 / ${batchSelectedFiles.length}...`;

            const batchCards = batchContainer.querySelectorAll('.batch-track-card');

            try {
                for (let i = 0; i < batchSelectedFiles.length; i++) {
                    const audioFile = batchSelectedFiles[i];
                    const card = batchCards[i];

                    const title = card.querySelector('.batch-title').value;
                    const artist = card.querySelector('.batch-artist').value;
                    const album = card.querySelector('.batch-album').value || 'Single';
                    const genre = card.querySelector('.batch-genre').value || 'Vault Track';
                    const coverFile = card.querySelector('.batch-cover').files[0];

                    const safeAudioName = sanitizeFileName(audioFile.name);
                    const audioPath = `${currentUser.id}/${Date.now()}_${i}_${safeAudioName}`;
                    
                    const { error: audioErr } = await supabaseClient.storage
                        .from('audio-files')
                        .upload(audioPath, audioFile);

                    if (audioErr) throw audioErr;

                    const audioUrl = supabaseClient.storage.from('audio-files').getPublicUrl(audioPath).data.publicUrl;

                    let coverUrl = '';
                    if (coverFile) {
                        const safeCoverName = sanitizeFileName(coverFile.name);
                        const coverPath = `${currentUser.id}/${Date.now()}_${i}_${safeCoverName}`;
                        
                        await supabaseClient.storage.from('cover-art').upload(coverPath, coverFile);
                        coverUrl = supabaseClient.storage.from('cover-art').getPublicUrl(coverPath).data.publicUrl;
                    }

                    const { error: dbErr } = await supabaseClient.from('songs').insert({
                        user_id: currentUser.id,
                        title,
                        artist,
                        album,
                        genre,
                        audio_url: audioUrl,
                        cover_url: coverUrl
                    });

                    if (dbErr) throw dbErr;

                    btnSubmit.textContent = `UPLOADING ${i + 1} / ${batchSelectedFiles.length}...`;
                }

                songForm.reset();
                batchContainer.innerHTML = `<p class="batch-placeholder-text">SELECT ONE OR MORE AUDIO FILES ABOVE TO CUSTOMIZE TRACK METADATA</p>`;
                batchSelectedFiles = [];
                songModal.classList.add('hidden');
                await loadUserLibrary();

            } catch (err) {
                alert('Batch upload failed: ' + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'SAVE ALL TO VAULT';
            }
        });
    }
}

/* ==========================================
   6. EDIT SONG MANAGEMENT (SINGLE TRACK EDIT)
   ========================================== */
function initEditSongManagement() {
    const editModal = document.getElementById('editSongModal');
    const btnCloseEdit = document.getElementById('btnCloseEditSongModal');
    const editForm = document.getElementById('editSongForm');

    if (btnCloseEdit) {
        btnCloseEdit.addEventListener('click', () => {
            editModal?.classList.add('hidden');
        });
    }

    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const songId = document.getElementById('editSongId').value;
            const title = document.getElementById('editInputTitle').value;
            const artist = document.getElementById('editInputArtist').value;
            const album = document.getElementById('editInputAlbum').value;
            const genre = document.getElementById('editInputGenre').value;
            const coverFile = document.getElementById('editInputCoverFile').files[0];

            const btnSubmit = document.getElementById('btnSubmitEditSong');
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'SAVING...';

            try {
                let coverUrl = null;

                if (coverFile) {
                    const safeCoverName = sanitizeFileName(coverFile.name);
                    const coverPath = `${currentUser.id}/${Date.now()}_edit_${safeCoverName}`;

                    const { error: coverErr } = await supabaseClient.storage
                        .from('cover-art')
                        .upload(coverPath, coverFile);

                    if (coverErr) throw coverErr;

                    coverUrl = supabaseClient.storage.from('cover-art').getPublicUrl(coverPath).data.publicUrl;
                }

                const updatePayload = { title, artist, album, genre };
                if (coverUrl) updatePayload.cover_url = coverUrl;

                const { error: dbErr } = await supabaseClient
                    .from('songs')
                    .update(updatePayload)
                    .eq('id', songId);

                if (dbErr) throw dbErr;

                editForm.reset();
                editModal.classList.add('hidden');
                await loadUserLibrary();

            } catch (err) {
                alert('Failed to update track: ' + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'UPDATE TRACK';
            }
        });
    }
}

window.openEditTrackModal = function(songId) {
    const song = songsLibrary.find(s => s.id === songId);
    if (!song) return;

    document.getElementById('editSongId').value = song.id;
    document.getElementById('editInputTitle').value = song.title || '';
    document.getElementById('editInputArtist').value = song.artist || '';
    document.getElementById('editInputAlbum').value = song.album || '';
    document.getElementById('editInputGenre').value = song.genre || '';

    const editModal = document.getElementById('editSongModal');
    editModal?.classList.remove('hidden');
};

/* ==========================================
   7. PLAYLIST MANAGEMENT
   ========================================== */
function initPlaylistManagement() {
    const playlistModal = document.getElementById('playlistModal');
    const btnOpen = document.getElementById('btnOpenCreatePlaylist');
    const btnClose = document.getElementById('btnClosePlaylistModal');
    const playlistForm = document.getElementById('playlistForm');

    if (btnOpen) btnOpen.addEventListener('click', () => playlistModal?.classList.remove('hidden'));
    if (btnClose) btnClose.addEventListener('click', () => playlistModal?.classList.add('hidden'));

    if (playlistForm) {
        playlistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('inputPlaylistTitle').value;
            const description = document.getElementById('inputPlaylistDesc').value;

            const { error } = await supabaseClient.from('playlists').insert({
                user_id: currentUser.id,
                title,
                description
            });

            if (error) {
                alert('Could not create playlist: ' + error.message);
            } else {
                playlistForm.reset();
                playlistModal.classList.add('hidden');
                await loadUserPlaylists();
            }
        });
    }
}

/* ==========================================
   8. RENDERING VIEWS
   ========================================== */
function renderListView(songs) {
    const tbody = document.getElementById('songListBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    songs.forEach((song, idx) => {
        const coverUrl = song.cover_url || 'assets/default-cover.jpg';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><div class="table-cover" style="background-image: url('${coverUrl}')"></div></td>
            <td style="font-weight: bold; color: #fff;">${song.title}</td>
            <td>${song.artist}</td>
            <td>${song.album}</td>
            <td>
                <button onclick="event.stopPropagation(); openEditTrackModal('${song.id}')" style="background:none; border:1px solid #444; color:#fff; padding:4px 8px; cursor:pointer; font-size:10px; margin-right:4px;">EDIT</button>
                <button onclick="event.stopPropagation(); deleteTrack('${song.id}')" style="background:none; border:1px solid #333; color:#aaa; padding:4px 8px; cursor:pointer; font-size:10px;">DELETE</button>
            </td>
        `;
        tr.addEventListener('click', () => playSelectedTrack(song));
        tbody.appendChild(tr);
    });
}

function renderAlbumsView(songs) {
    const grid = document.getElementById('albumsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const albumsMap = {};
    songs.forEach(s => {
        const key = s.album || 'Single';
        if (!albumsMap[key]) albumsMap[key] = [];
        albumsMap[key].push(s);
    });

    Object.keys(albumsMap).forEach(albumName => {
        const albumSongs = albumsMap[albumName];
        const cover = albumSongs[0].cover_url || 'assets/default-cover.jpg';

        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <div class="card-art" style="background-image: url('${cover}')"></div>
            <div class="card-title">${albumName}</div>
            <div class="card-sub">${albumSongs.length} TRACKS — ${albumSongs[0].artist}</div>
        `;
        card.addEventListener('click', () => {
            if (spatialVault) spatialVault.setSongs(albumSongs);
            document.getElementById('btnModeCollection')?.click();
        });
        grid.appendChild(card);
    });
}

function renderPlaylistsView(playlists) {
    const grid = document.getElementById('playlistsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (playlists.length === 0) {
        grid.innerHTML = `<p style="color:#666; font-size:12px;">No playlists created yet. Click "+ CREATE PLAYLIST" above.</p>`;
        return;
    }

    playlists.forEach(pl => {
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.innerHTML = `
            <div class="card-art" style="background: #18181f; display:flex; justify-content:center; align-items:center; font-size:24px; color:#444;">🎵</div>
            <div class="card-title">${pl.title}</div>
            <div class="card-sub">${pl.description || 'Custom Vault Playlist'}</div>
        `;
        grid.appendChild(card);
    });
}

window.deleteTrack = async function(songId) {
    if (confirm('Permanently remove this track from your vault?')) {
        await supabaseClient.from('songs').delete().eq('id', songId);
        await loadUserLibrary();
    }
};
