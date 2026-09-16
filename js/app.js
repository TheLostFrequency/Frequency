import { AudioPlayer } from './audioPlayer.js';
import { AudioAnalyzer } from './eq.js';
import { supabase } from './supabaseClient.js';

let playlist = []; // Clean empty state by default unless Supabase has records
let currentIndex = 0; 

const player = new AudioPlayer();
const analyzer = new AudioAnalyzer(player.audio);

// DOM Elements
const songListEl = document.getElementById('song-list');
const titleEl = document.getElementById('player-title');
const artistEl = document.getElementById('player-artist');
const thumbEl = document.getElementById('player-thumb');
const currentArtEl = document.getElementById('current-album-art');
const playPauseBtn = document.getElementById('play-pause-btn');
const playIcon = document.getElementById('play-icon');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const statusLabel = document.getElementById('player-status-label');

// Navigation Tab Elements
const navCollection = document.getElementById('nav-collection');
const navTransmissions = document.getElementById('nav-transmissions');
const transmissionsView = document.getElementById('transmissions-view');
const closeTransmissions = document.getElementById('close-transmissions');

navTransmissions.onclick = (e) => {
    e.preventDefault();
    transmissionsView.classList.remove('hidden');
    navTransmissions.classList.add('text-white', 'border-b', 'border-white', 'pb-1');
    navCollection.classList.remove('text-white', 'border-b', 'border-white', 'pb-1');
    navCollection.classList.add('text-gray-500');
};

closeTransmissions.onclick = () => {
    transmissionsView.classList.add('hidden');
    navCollection.classList.add('text-white', 'border-b', 'border-white', 'pb-1');
    navCollection.classList.remove('text-gray-500');
    navTransmissions.classList.remove('text-white', 'border-b', 'border-white', 'pb-1');
    navTransmissions.classList.add('text-gray-500');
};

function formatTime(seconds) {
    if (isNaN(seconds)) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Fetch real user track library from Supabase
async function loadLibrary() {
    try {
        const { data, error } = await supabase.from('tracks').select('*');
        
        if (error) {
            console.error('Error fetching tracks from Supabase:', error);
            renderEmptyState();
            return;
        }
        
        if (data && data.length > 0) {
            playlist = data;
            currentIndex = 0;
            statusLabel.textContent = "SIGNAL ACTIVE";
            updateActiveSong(false);
        } else {
            renderEmptyState();
        }
    } catch (err) {
        console.warn('Supabase not fully configured or empty state active:', err);
        renderEmptyState();
    }
}

function renderEmptyState() {
    playlist = [];
    songListEl.innerHTML = `
        <div class="text-right flex flex-col items-end py-10">
            <span class="text-xs text-white tracking-[0.2em] font-medium mb-1">VAULT EMPTY</span>
            <span class="text-[9px] text-gray-500 tracking-wider">NO REAL SIGNALS FOUND</span>
        </div>
    `;
    titleEl.textContent = "Vault Empty";
    artistEl.textContent = "Awaiting Real Supabase Data";
    thumbEl.src = "assets/default-art.jpg";
    currentArtEl.src = "assets/default-art.jpg";
    statusLabel.textContent = "STAND BY // VAULT EMPTY";
}

function renderSelector() {
    songListEl.innerHTML = '';
    
    if (playlist.length === 0) {
        renderEmptyState();
        return;
    }

    playlist.forEach((song, idx) => {
        const distance = idx - currentIndex;
        const absDist = Math.abs(distance);
        
        const opacity = Math.max(0.2, 1 - (absDist * 0.2));
        const scale = Math.max(0.75, 1 - (absDist * 0.05));
        const translatePr = absDist * 6;

        const item = document.createElement('div');
        item.className = `cursor-pointer transition-all duration-300 flex flex-col items-end`;
        item.style.transform = `translateX(${translatePr}px) scale(${scale})`;
        item.style.opacity = opacity;

        if (distance === 0) {
            item.innerHTML = `
                <span class="text-sm font-medium text-white tracking-wider">${song.title || 'Untitled'}</span>
                <span class="text-[11px] text-gray-300 tracking-wide">${song.artist || 'Unknown Artist'}</span>
            `;
        } else {
            item.innerHTML = `
                <span class="text-xs text-gray-400 tracking-wider">${song.title || 'Untitled'}</span>
                <span class="text-[9px] text-gray-600 tracking-wide">${song.artist || 'Unknown Artist'}</span>
            `;
        }

        item.onclick = () => {
            currentIndex = idx;
            updateActiveSong(true);
        };

        songListEl.appendChild(item);
    });
}

function updateActiveSong(autoPlay = false) {
    if (playlist.length === 0) return;
    const current = playlist[currentIndex];
    
    titleEl.textContent = current.title || 'Untitled';
    artistEl.textContent = current.artist || 'Unknown Artist';
    
    const artUrl = current.cover_path ? supabase.storage.from('covers').getPublicUrl(current.cover_path).data.publicUrl : 'assets/default-art.jpg';
    thumbEl.src = artUrl;
    currentArtEl.src = artUrl;
    
    if (current.audio_path) {
        const audioUrl = supabase.storage.from('audio').getPublicUrl(current.audio_path).data.publicUrl;
        player.load({ audioUrl });
    }

    if (autoPlay) {
        analyzer.init();
        player.play();
    }
    renderSelector();
}

// Wheel scroll navigation on the right-side curved selector
const selectorContainer = document.getElementById('song-selector-container');
selectorContainer.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (playlist.length === 0) return;
    if (e.deltaY > 0) {
        currentIndex = Math.min(playlist.length - 1, currentIndex + 1);
    } else {
        currentIndex = Math.max(0, currentIndex - 1);
    }
    updateActiveSong(false);
}, { passive: false });

// Media Player Controls Binding
playPauseBtn.onclick = () => {
    if (playlist.length === 0) return;
    analyzer.init();
    player.togglePlay();
};

document.getElementById('next-btn').onclick = () => {
    if (playlist.length === 0) return;
    currentIndex = (currentIndex + 1) % playlist.length;
    updateActiveSong(true);
};

document.getElementById('prev-btn').onclick = () => {
    if (playlist.length === 0) return;
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    updateActiveSong(true);
};

// Player callbacks
player.onTimeUpdate = (currentTime, duration) => {
    currentTimeEl.textContent = formatTime(currentTime);
    totalTimeEl.textContent = formatTime(duration);
};

player.onPlayStateChange = (isPlaying) => {
    if (isPlaying) {
        playIcon.innerHTML = '<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>';
    } else {
        playIcon.innerHTML = '<path d="M5 3l14 9-14 9V3z"/>';
    }
};

// Scientific Oscilloscope Canvas Rendering Loop
const canvas = document.getElementById('waveform-canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let phase = 0;
function drawWaveform() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';

    const sliceWidth = canvas.width / 150;
    let x = 0;

    for (let i = 0; i < 150; i++) {
        const amplitude = player.isPlaying ? 16 : 4;
        const v = Math.sin(i * 0.08 + phase) * Math.cos(i * 0.03 + phase * 0.5) * amplitude + 
                  Math.sin(i * 0.2 - phase * 1.5) * (amplitude * 0.4);
        const y = (canvas.height / 2) + v;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
        x += sliceWidth;
    }

    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    const progressPercent = player.duration ? (player.currentTime / player.duration) : 0.0;
    ctx.fillRect(canvas.width * progressPercent, 0, 1, canvas.height);

    phase += player.isPlaying ? 0.06 : 0.01;
    requestAnimationFrame(drawWaveform);
}

// Initialize by fetching real tracks from Supabase
loadLibrary();
drawWaveform();
