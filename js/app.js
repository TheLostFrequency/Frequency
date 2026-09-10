/**
 * FREQUENCY CORE APPLICATION CONTROLLER
 * Connects Supabase Backend, Spatial UI, Navigation, and Playlists.
 */

let spatialVault = null;
let audioEngine = null;
let songsLibrary = [];
let userPlaylists = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    audioEngine = new AudioEngine();
    spatialVault = new SpatialVault('physicalVault', (selectedSong) => {
        audioEngine.loadSong(selectedSong);
    });

    initAuth();
    initNavigation();
    initSongManagement();
    initPlaylistManagement();
});

/* 1. AUTHENTICATION CONTROLLER */
function initAuth() {
    const authModal = document.getElementById('authModal');
    const appContainer = document.getElementById('app');
    const authForm = document.getElementById('authForm');
    const authError = document.getElementById('authError');

    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            authModal.classList.add('hidden');
            appContainer.classList.remove('hidden');
            loadUserLibrary();
            loadUserPlaylists();
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            authError.textContent = error.message;
        } else {
            currentUser = data.user;
            authModal.classList.add('hidden');
            appContainer.classList.remove('hidden');
            loadUserLibrary();
            loadUserPlaylists();
        }
    });

    document.getElementById('btnSignUp').addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) {
            authError.textContent = error.message;
        } else {
            authError.textContent = 'ACCOUNT CREATED. YOU MAY NOW LOGIN.';
        }
    });

    document.getElementById('btnLogout').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.reload();
    });
}

/* 2. DATA MANAGEMENT (SUPABASE API) */
async function loadUserLibrary() {
    const { data: songs, error } = await supabaseClient
        .from('songs')
        .select('*')
        .order('created_at', { ascending: false });

    if (!error && songs) {
        songsLibrary = songs;
        spatialVault.setSongs(songsLibrary);
        renderListView(songsLibrary);
        renderAlbumsView(songsLibrary);
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

/* 3. NAVIGATION CONTROLLER */
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
            spatialVault.setSongs(filtered);
            renderListView(filtered);
        });
    }
}

/* 4. SONG UPLOAD & MANAGEMENT */
function initSongManagement() {
    const songModal = document.getElementById('songModal');
    const btnOpenAdd = document.getElementById('btnOpenAddSong');
    const btnClose = document.getElementById('btnCloseSongModal');
    const songForm = document.getElementById('songForm');
    const btnSubmit = document.getElementById('btnSubmitSong');

    btnOpenAdd.addEventListener('click', () => songModal.classList.remove('hidden'));
    btnClose.addEventListener('click', () => songModal.classList.add('hidden'));

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

/* 5. PLAYLIST CREATION & MANAGEMENT */
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

/* 6. RENDER LIST VIEW WITH DELETE CONTROLS */
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
                <button onclick="deleteTrack('${song.id}')" style="background:none; border:1px solid #333; color:#aaa; padding:4px 8px; cursor:pointer; font-size:10px;">DELETE</button>
            </td>
        `;
        tr.addEventListener('click', () => audioEngine.loadSong(song));
        tbody.appendChild(tr);
    });
}

/* 7. RENDER ALBUMS VIEW */
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
            spatialVault.setSongs(albumSongs);
            document.getElementById('btnModeCollection').click();
        });
        grid.appendChild(card);
    });
}

/* 8. RENDER PLAYLISTS VIEW */
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

/* GLOBAL DELETE TRACK HELPER */
window.deleteTrack = async function(songId) {
    if (confirm('Permanently remove this track from your vault?')) {
        await supabaseClient.from('songs').delete().eq('id', songId);
        await loadUserLibrary();
    }
};
