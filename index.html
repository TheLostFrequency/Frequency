<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>FREQUENCY — Personal Music Vault</title>
    <link rel="stylesheet" href="css/main.css">
    <!-- Supabase JS Client Library -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body>

    <!-- AUTHENTICATION OVERLAY -->
    <div id="authModal" class="overlay-modal active">
        <div class="auth-box">
            <div class="brand-monolith">
                <span class="pedestal-engraving">FREQUENCY</span>
            </div>
            <p class="auth-subtitle">ENTER YOUR PRIVATE FREQUENCY VAULT</p>
            <form id="authForm">
                <input type="email" id="authEmail" placeholder="EMAIL ADDRESS" required />
                <input type="password" id="authPassword" placeholder="PASSWORD" required />
                <div class="auth-actions">
                    <button type="submit" id="btnLogin" class="btn-primary">ENTER VAULT</button>
                    <button type="button" id="btnSignUp" class="btn-secondary">INITIALIZE ACCOUNT</button>
                </div>
            </form>
            <div id="authError" class="error-msg"></div>
        </div>
    </div>

    <!-- MAIN APP WRAPPER -->
    <div id="app" class="app-container hidden">

        <!-- TOP NAVIGATION BAR -->
        <header class="top-bar">
            <div class="nav-pill-group">
                <div class="brand-emblem"><img src="assets/logo.png" alt="Frequency"></div>
                <button class="nav-btn active" data-view="collection">Library</button>
                <button class="nav-btn" data-view="search">Search</button>
                <button class="nav-btn" data-view="albums">Albums</button>
                <button class="nav-btn" data-view="playlists">Playlists</button>
                <button class="nav-btn" data-view="eq">Equalizer</button>
                <button class="nav-btn" data-view="transmissions">Transmissions</button>
            </div>

            <div class="top-right-group">
                <button id="btnOpenAddSong" class="btn-add-pill">+ ADD TRACKS</button>
                <button id="btnLogout" class="btn-exit-pill">EXIT</button>
                <div class="view-toggle-pill">
                    <button class="toggle-btn active" id="btnModeCollection">COLLECTION</button>
                    <span class="divider">/</span>
                    <button class="toggle-btn" id="btnModeList">LIST</button>
                </div>
            </div>
        </header>

        <!-- VIEW CONTAINER: SEARCH -->
        <main id="viewSearch" class="view-panel hidden">
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="SEARCH VAULT BY TITLE, ARTIST, OR ALBUM..." />
            </div>
        </main>

        <!-- VIEW CONTAINER: SPATIAL COLLECTION VIEW -->
        <main id="viewCollection" class="view-panel active">
            <div class="architectural-stage">
                <div class="room-wall-back"></div>
                <div class="ambient-spotlight"></div>
                
                <div class="pillar pillar-left"></div>
                <div class="pillar pillar-right"></div>

                <!-- Dynamic 3D Fanning Album Vault -->
                <div id="physicalVault" class="physical-vault-container"></div>

                <!-- Center Pedestal Monolith with Metallic Logo -->
                <div class="center-monolith">
                    <div class="monolith-top">
                        <img src="assets/logo.png" class="physical-emblem-3d" alt="FREQUENCY Emblem">
                    </div>
                    <div class="monolith-front">
                        <div id="activeArtist" class="active-artist-text">ARTIST NAME</div>
                        <div id="activeTitle" class="active-title-text">Album Title</div>
                        <div id="activeMeta" class="active-meta-text">2026 • 12 tracks</div>
                    </div>
                </div>
            </div>
        </main>

        <!-- VIEW CONTAINER: LIST VIEW -->
        <main id="viewList" class="view-panel hidden">
            <div class="list-wrapper">
                <table class="frequency-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>COVER</th>
                            <th>TITLE</th>
                            <th>ARTIST</th>
                            <th>ALBUM</th>
                            <th>ACTIONS</th>
                        </tr>
                    </thead>
                    <tbody id="songListBody">
                        <!-- Dynamic Song Rows -->
                    </tbody>
                </table>
            </div>
        </main>

        <!-- VIEW CONTAINER: ALBUMS VIEW -->
        <main id="viewAlbums" class="view-panel hidden">
            <div id="albumsGrid" class="albums-grid">
                <!-- Dynamic Album Cards -->
            </div>
        </main>

        <!-- VIEW CONTAINER: PLAYLISTS VIEW -->
        <main id="viewPlaylists" class="view-panel hidden">
            <div class="playlists-wrapper">
                <div class="playlist-bar-header">
                    <h2 class="view-section-title">YOUR PLAYLISTS</h2>
                    <button id="btnOpenCreatePlaylist" class="btn-action">+ CREATE PLAYLIST</button>
                </div>
                <div id="playlistsGrid" class="playlists-grid">
                    <!-- Dynamic Playlists -->
                </div>
            </div>
        </main>

        <!-- VIEW CONTAINER: EQUALIZER VIEW -->
        <main id="viewEq" class="view-panel hidden">
            <div class="eq-page-container">
                <header class="eq-header">
                    <h1 class="eq-title">FREQUENCY</h1>
                    <p class="eq-subtitle">SIGNAL PARAMETRICS / EQUALIZER</p>
                </header>

                <div class="eq-rack">
                    <!-- SUB BASS (60Hz) -->
                    <div class="eq-channel">
                        <div class="eq-slider-wrapper">
                            <input type="range" class="eq-slider" id="eq-60" min="-12" max="12" value="0" step="0.5" orient="vertical">
                        </div>
                        <span class="eq-value" id="val-60">0 dB</span>
                        <span class="eq-label">60 Hz</span>
                        <span class="eq-subtext">SUB</span>
                    </div>

                    <!-- LOW BASS (250Hz) -->
                    <div class="eq-channel">
                        <div class="eq-slider-wrapper">
                            <input type="range" class="eq-slider" id="eq-250" min="-12" max="12" value="0" step="0.5" orient="vertical">
                        </div>
                        <span class="eq-value" id="val-250">0 dB</span>
                        <span class="eq-label">250 Hz</span>
                        <span class="eq-subtext">LOW</span>
                    </div>

                    <!-- MID (1kHz) -->
                    <div class="eq-channel">
                        <div class="eq-slider-wrapper">
                            <input type="range" class="eq-slider" id="eq-1000" min="-12" max="12" value="0" step="0.5" orient="vertical">
                        </div>
                        <span class="eq-value" id="val-1000">0 dB</span>
                        <span class="eq-label">1 kHz</span>
                        <span class="eq-subtext">MID</span>
                    </div>

                    <!-- PRESENCE (4kHz) -->
                    <div class="eq-channel">
                        <div class="eq-slider-wrapper">
                            <input type="range" class="eq-slider" id="eq-4000" min="-12" max="12" value="0" step="0.5" orient="vertical">
                        </div>
                        <span class="eq-value" id="val-4000">0 dB</span>
                        <span class="eq-label">4 kHz</span>
                        <span class="eq-subtext">PRESENCE</span>
                    </div>

                    <!-- TREBLE (12kHz) -->
                    <div class="eq-channel">
                        <div class="eq-slider-wrapper">
                            <input type="range" class="eq-slider" id="eq-12000" min="-12" max="12" value="0" step="0.5" orient="vertical">
                        </div>
                        <span class="eq-value" id="val-12000">0 dB</span>
                        <span class="eq-label">12 kHz</span>
                        <span class="eq-subtext">TREBLE</span>
                    </div>
                </div>

                <div class="eq-actions">
                    <button id="eq-reset" class="eq-btn">FLAT RESPONSE</button>
                </div>
            </div>
        </main>

        <!-- VIEW CONTAINER: TRANSMISSIONS VIEW -->
        <main id="viewTransmissions" class="view-panel hidden">
            <div class="transmissions-stage">
                <div class="transmission-asset-wrapper">
                    <picture>
                        <!-- Mobile Asset Override -->
                        <source media="(max-width: 768px)" srcset="assets/mobile-transmission.png">
                        <!-- Desktop Fallback Asset -->
                        <img id="transGraphic" src="assets/transmission.png" class="transmission-graphic" alt="Transmissions Visual">
                    </picture>
                </div>
            </div>
        </main>

        <!-- FLOATING CAPSULE PLAYER -->
        <footer id="musicPlayer" class="floating-player">
            <div class="player-left">
                <div id="playerCover" class="player-cover-art"></div>
                <div class="player-meta">
                    <div id="playerTitle" class="track-title">NO TRACK SELECTED</div>
                    <div id="playerArtist" class="track-artist">—</div>
                </div>
            </div>
            <div class="player-center">
                <div class="player-controls">
                    <button class="ctrl-btn ctrl-shuffle" id="btnShuffle">🔀</button>
                    <button class="ctrl-btn ctrl-prev" id="btnPrev">⏮</button>
                    <button class="ctrl-btn main-play" id="btnPlay">▶</button>
                    <button class="ctrl-btn ctrl-next" id="btnNext">⏭</button>
                </div>
                <div class="progress-bar-container">
                    <span id="currentTime" class="time-current">0:00</span>
                    <input type="range" id="seekSlider" value="0" min="0" max="100" step="0.1">
                    <span id="durationTime" class="time-total">0:00</span>
                </div>
            </div>
            <div class="player-right">
                <div class="volume-container">
                    <span class="vol-icon">🔊</span>
                    <input type="range" id="volumeSlider" class="volume-slider" value="80" min="0" max="100">
                </div>
            </div>
        </footer>

    </div>

    <!-- MODAL: ADD / MASS UPLOAD SONGS -->
    <div id="songModal" class="overlay-modal hidden">
        <div class="modal-card modal-card-wide">
            <h2 id="songModalTitle">MASS UPLOAD TRACKS TO VAULT</h2>
            <form id="songForm">
                <div class="form-group">
                    <label>SELECT AUDIO FILES (MP3 / WAV — CHOOSE MULTIPLE)</label>
                    <input type="file" id="inputAudioFiles" accept="audio/*" multiple required />
                </div>
                
                <!-- Dynamic Batch Processing Container -->
                <div id="batchContainer" class="batch-tracks-wrapper">
                    <p class="batch-placeholder-text">SELECT ONE OR MORE AUDIO FILES ABOVE TO CUSTOMIZE TRACK METADATA</p>
                </div>

                <div class="modal-actions">
                    <button type="button" id="btnCloseSongModal" class="btn-secondary">CANCEL</button>
                    <button type="submit" id="btnSubmitSong" class="btn-primary">SAVE ALL TO VAULT</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: EDIT TRACK METADATA & COVER ART -->
    <div id="editSongModal" class="overlay-modal hidden">
        <div class="modal-card">
            <h2>EDIT TRACK DETAILS</h2>
            <form id="editSongForm">
                <input type="hidden" id="editSongId">
                <div class="form-group">
                    <label>SONG TITLE</label>
                    <input type="text" id="editInputTitle" required />
                </div>
                <div class="form-group">
                    <label>ARTIST</label>
                    <input type="text" id="editInputArtist" required />
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>ALBUM</label>
                        <input type="text" id="editInputAlbum" />
                    </div>
                    <div class="form-group">
                        <label>GENRE</label>
                        <input type="text" id="editInputGenre" />
                    </div>
                </div>
                <div class="form-group">
                    <label>UPDATE COVER ARTWORK (NEW IMAGE)</label>
                    <input type="file" id="editInputCoverFile" accept="image/*" />
                </div>
                <div class="modal-actions">
                    <button type="button" id="btnCloseEditSongModal" class="btn-secondary">CANCEL</button>
                    <button type="submit" id="btnSubmitEditSong" class="btn-primary">UPDATE TRACK</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL: CREATE PLAYLIST -->
    <div id="playlistModal" class="overlay-modal hidden">
        <div class="modal-card">
            <h2>CREATE NEW PLAYLIST</h2>
            <form id="playlistForm">
                <div class="form-group">
                    <label>PLAYLIST NAME</label>
                    <input type="text" id="inputPlaylistTitle" required placeholder="e.g. UNRELEASED VAULT" />
                </div>
                <div class="form-group">
                    <label>DESCRIPTION</label>
                    <input type="text" id="inputPlaylistDesc" placeholder="e.g. Rare studio sessions and remixes" />
                </div>
                <div class="modal-actions">
                    <button type="button" id="btnClosePlaylistModal" class="btn-secondary">CANCEL</button>
                    <button type="submit" id="btnSubmitPlaylist" class="btn-primary">CREATE PLAYLIST</button>
                </div>
            </form>
        </div>
    </div>

    <audio id="audioElement" preload="metadata" crossorigin="anonymous"></audio>

    <!-- JS MODULES -->
    <script src="js/supabaseClient.js"></script>
    <script src="js/audioPlayer.js"></script>
    <script src="js/eq.js"></script>
    <script src="js/spatialView.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
