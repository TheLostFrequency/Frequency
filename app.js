/**
 * FREQUENCY CORE APPLICATION CONTROLLER
 * Connects Supabase Backend, Spatial UI, Navigation, and Library Management.
 */

let spatialVault = null;
let audioEngine = null;
let songsLibrary = [];
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    audioEngine = new AudioEngine();
    spatialVault = new SpatialVault('physicalVault', (selectedSong) => {
        audioEngine.loadSong(selectedSong);
    });

    initAuth();
    initNavigation();
    initSongManagement();
});

/* 1. AUTHENTICATION CONTROLLER */
function initAuth() {
    const authModal = document.getElementById('authModal');
    const appContainer = document.getElementById('app');
    const authForm = document.getElementById('authForm');
    const authError = document.getElementById('authError');

    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            currentUser = session.user;
            authModal.classList.add('hidden');
            appContainer.classList.remove('hidden');
            loadUserLibrary();
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.textContent = '';
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            authError.textContent = error.message;
        } else {
            currentUser = data.user;
            authModal.classList.add('hidden');
            appContainer.classList.remove('hidden');
            loadUserLibrary();
        }
    });

    document.getElementById('btnSignUp').addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) authError.textContent = error.message;
        else authError.textContent = 'ACCOUNT CREATED. YOU MAY NOW LOGIN.';
    });

    document.getElementById('btnLogout').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.reload();
    });
}

/* 2. DATA MANAGEMENT (SUPABASE API) */
async function loadUserLibrary() {
    const { data: songs, error } = await supabase
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

/* 3. NAVIGATION CONTROLLER */
function initNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const viewPanels = document.querySelectorAll('.view-panel');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            viewPanels.forEach(panel => {
                if (panel.id === `view${targetView.charAt(0).toUpperCase() + targetView.slice(1)}`) {
                    panel.classList.add('active');
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.remove('active');
                    panel.classList.add('hidden');
                }
            });
        });
    });

    // Vault Search Filtering
    document.getElementById('searchInput').addEventListener('input', (e) => {
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

/* 4. SONG UPLOAD & MANAGEMENT */
function initSongManagement() {
    const songModal = document.getElementById('songModal');
    const btnOpenAdd = document.getElementById('btnOpenAddSong');
    const btnClose = document.getElementById('btnCloseSongModal');
    const songForm = document.getElementById('songForm');

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

        try {
            // Upload Audio File
            const audioPath = `${currentUser.id}/${Date.now()}_${audioFile.name}`;
            const { data: audioData, error: audioErr } = await supabase.storage
                .from('audio-files')
                .upload(audioPath, audioFile);

            if (audioErr) throw audioErr;

            const audioUrl = supabase.storage.from('audio-files').getPublicUrl(audioPath).data.publicUrl;

            // Upload Cover File (if exists)
            let coverUrl = '';
            if (coverFile) {
                const coverPath = `${currentUser.id}/${Date.now()}_${coverFile.name}`;
                await supabase.storage.from('cover-art').upload(coverPath, coverFile);
                coverUrl = supabase.storage.from('cover-art').getPublicUrl(coverPath).data.publicUrl;
            }

            // Insert Database Record
            const { error: dbErr } = await supabase.from('songs').insert({
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
            loadUserLibrary();

        } catch (err) {
            alert('Upload failed: ' + err.message);
        }
    });
}

/* 5. RENDER LIST VIEW */
function renderListView(songs) {
    const tbody = document.getElementById('songListBody');
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
                <button onclick="deleteTrack('${song.id}')" style="background:none; border:none; color:#888; cursor:pointer;">DELETE</button>
            </td>
        `;
        tr.addEventListener('dblclick', () => audioEngine.loadSong(song));
        tbody.appendChild(tr);
    });
}

/* 6. RENDER ALBUMS VIEW */
function renderAlbumsView(songs) {
    const grid = document.getElementById('albumsGrid');
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
            <div class="card-sub">${albumSongs.length} TRACKS —${albumSongs[0].artist}</div>
        `;
        card.addEventListener('click', () => {
            spatialVault.setSongs(albumSongs);
            document.querySelector('[data-view="collection"]').click();
        });
        grid.appendChild(card);
    });
}

/* GLOBAL DELETE TRACK HELPER */
window.deleteTrack = async function(songId) {
    if (confirm('Permanently remove this track from your vault?')) {
        await supabase.from('songs').delete().eq('id', songId);
        loadUserLibrary();
    }
};
