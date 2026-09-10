/**
 * FREQUENCY CORE APPLICATION CONTROLLER
 * Integrated Supabase Sync, Audio Controls & Mobile Vault Touch-Swipe
 */

let spatialVault = null;
let audioEngine = null;
let songsLibrary = [];
let userPlaylists = [];
let currentUser = null;

let currentTrackIndex = 0;
let isShuffle = false;
let isPlaying = false;
const audio = new Audio();

document.addEventListener('DOMContentLoaded', async () => {
    initAudioEngineControls();
    initMobileVaultSwipe();

    if (typeof SpatialVault !== 'undefined') {
        spatialVault = new SpatialVault('physicalVault', (selectedSong) => {
            playSelectedTrack(selectedSong);
        });
    }

    initAuth();
    initNavigation();
    initSongManagement();
    initPlaylistManagement();
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
        viewPanels.forEach(panel => {
            if (panel.id === `view${targetView.charAt(0).toUpperCase() + targetView.slice(1)}`) {
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
                s.title.toLowerCase().includes(query) || 
                s.artist.toLowerCase().includes(query) ||
                s.album.toLowerCase().includes(query)
            );
            if (spatialVault) spatialVault.setSongs(filtered);
            renderListView(filtered);
        });
    }
}

/* ==========================================
   4. AUDIO PLAYBACK & VOLUME CONTROLLER
   ========================================== */
function initAudioEngineControls() {
    const mainPlayBtn = document.querySelector('.main-play') || document.getElementById('btnPlay');
    const prevBtn = document.querySelector('.ctrl-prev') || document.getElementById('btnPrev');
    const nextBtn = document.querySelector('.ctrl-next') || document.getElementById('btnNext');
    const shuffleBtn = document.querySelector('.ctrl-shuffle') || document.getElementById('btnShuffle');
    const progressBar = document.querySelector('.progress-bar-container input[type="range"]');
    const volumeSlider = document.querySelector('.volume-slider');

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
            const currentEl = document.querySelector('.time-current');
            const totalEl = document.querySelector('.time-total');
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

/* ==========================================
   5. MOBILE TOUCH-SWIPE VAULT CONTROLLER
   ========================================== */
function initMobileVaultSwipe() {
    const vaultContainer = document.getElementById('physicalVault') || document.querySelector('.physical-vault-container');
    if (!vaultContainer) return;

    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 40;

    vaultContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    vaultContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, { passive: true });

    function handleSwipeGesture() {
        const swipeDistance = touchEndX - touchStartX;

        if (swipeDistance < -minSwipeDistance) {
            playNextTrack();
        } else if (swipeDistance > minSwipeDistance) {
            playPrevTrack();
        }
    }
}

function loadTrackIntoPlayer(index, shouldPlay = true) {
    if (!songsLibrary[index]) return;
    currentTrackIndex = index;
    const track = songsLibrary[currentTrackIndex];

    audio.src = track.audio_url;

    document.querySelectorAll('.track-title, .active-title-text').forEach(el => el.textContent = track.title);
    document.querySelectorAll('.track-artist, .active-artist-text').forEach(el => el.textContent = track.artist);

    const coverArtEl = document.querySelector('.player-cover-art');
    if (coverArtEl) coverArtEl.style.backgroundImage = `url('${track.cover_url || ''}')`;

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

    if (isShuffle && songsLibrary.length > 1) {
        let randomIndex = currentTrackIndex;
        while (randomIndex === currentTrackIndex) {
            randomIndex = Math.floor(Math.random() * songsLibrary.length);
        }
        currentTrackIndex = randomIndex;
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
   6. SONG UPLOAD & MANAGEMENT
   ========================================== */
function initSongManagement() {
    const songModal = document.getElementById('songModal');
    const btnOpenAdd = document.getElementById('btnOpenAddSong');
    const btnClose = document.getElementById('btnCloseSongModal');
    const songForm = document.getElementById('songForm');
    const btnSubmit = document.getElementById('btnSubmitSong');

    if (btnOpenAdd) btnOpenAdd.addEventListener('click', () => songModal?.classList.remove('hidden'));
    if (btnClose) btnClose.addEventListener('click', () => songModal?.classList.add('hidden'));

    if (songForm) {
        songForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const title = document.getElementById('inputTitle').value;
            const artist = document.getElementById('inputArtist').value;
            const album = document.getElementById('inputAlbum').value;
            const genre = document.getElementById('inputGenre').value;
            const audioFile = document.getElementById('inputAudioFile').files[0];
            const coverFile = document.getElementById('inputCoverFile').files[0];

            if (!audioFile) {
                alert('Audio file is required.');
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'UPLOADING TO VAULT...';

            try {
                const audioPath = `${currentUser.id}/${Date.now()}_${audioFile.name}`;
                const { data: audioData, error: audioErr } = await supabaseClient.storage
                    .from('audio-files')
                    .upload(audioPath, audioFile);

                if (audioErr) throw audioErr;

                const audioUrl = supabaseClient.storage.from('audio-files').getPublicUrl(audioPath).data.publicUrl;

                let coverUrl = '';
                if (coverFile) {
                    const coverPath = `${currentUser.id}/${Date.now()}_${coverFile.name}`;
                    await supabaseClient.storage.from('cover-art').upload(coverPath, coverFile);
                    coverUrl = supabaseClient.storage.from('cover-art').getPublicUrl(coverPath).data.publicUrl;
                }

                const { error: dbErr } = await supabaseClient.from('songs').insert({
                    user_id: currentUser.id,
                    title,
                    artist,
                    album: album || 'Single',
                    genre: genre || 'Vault Track',
                    audio_url: audioUrl,
                    cover_url: coverUrl
                });

                if (dbErr) throw dbErr;

                songForm.reset();
                songModal.classList.add('hidden');
                await loadUserLibrary();

            } catch (err) {
                alert('Upload failed: ' + err.message);
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'SAVE TO VAULT';
            }
        });
    }
}

/* ==========================================
   7. PLAYLIST MANAGEMENT
   ========================================== */
function initPlaylistManagement() {
    const playlistModal = document.getElementById('playlistModal');
    const btnOpen = document.getElementById('btnOpenCreatePlaylist');
    const btnClose = document.getElementById('btnClosePlaylistModal');
    const playlistForm = document.getElementById('playlistForm');

    if (btnOpen) btnOpen.addEventListener('click', () => playlistModal.classList.remove('hidden'));
    if (btnClose) btnClose.addEventListener('click', () => playlistModal.classList.add('hidden'));

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
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td><div class="table-cover" style="background-image: url('${song.cover_url || ''}')"></div></td>
            <td style="font-weight: bold; color: #fff;">${song.title}</td>
            <td>${song.artist}</td>
            <td>${song.album}</td>
            <td>
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
        if (!albumsMap[s.album]) albumsMap[s.album] = [];
        albumsMap[s.album].push(s);
    });

    Object.keys(albumsMap).forEach(albumName => {
        const albumSongs = albumsMap[albumName];
        const cover = albumSongs[0].cover_url;

        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <div class="card-art" style="background-image: url('${cover || ''}')"></div>
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
