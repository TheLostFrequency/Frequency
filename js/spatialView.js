/**
 * FREQUENCY SPATIAL COLLECTION ENGINE
 * Handles physical movement, drag/swipe, inertia, 3D perspective, and record selection.
 */
class SpatialVault {
    constructor(containerId, onSelectCallback) {
        this.container = document.getElementById(containerId);
        this.onSelectCallback = onSelectCallback;
        this.songs = [];
        this.currentIndex = 0;
        this.isDragging = false;
        this.startX = 0;
        this.dragOffset = 0;

        this.initEventListeners();
    }

    setSongs(songs) {
        this.songs = songs;
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        if (this.songs.length === 0) return;

        this.songs.forEach((song, index) => {
            const el = document.createElement('div');
            el.className = 'record-object';
            el.dataset.index = index;

            const coverUrl = song.cover_url || 'assets/default-cover.jpg';
            
            el.innerHTML = `
                <div class="album-sleeve" style="background-image: url('${coverUrl}')"></div>
                <div class="vinyl-disc"></div>
            `;

            el.addEventListener('click', () => this.selectRecord(index));
            this.container.appendChild(el);
        });

        this.updatePositions();
    }

    updatePositions() {
        const elements = this.container.querySelectorAll('.record-object');
        const spacing = 140; // Physical offset along depth

        elements.forEach((el, index) => {
            const offset = index - this.currentIndex;
            const absoluteOffset = Math.abs(offset);

            if (offset === 0) {
                // Active Record: Pulled forward out of vault
                el.classList.add('active');
                el.style.transform = `translate3d(0px, -60px, 150px) rotateY(0deg) scale(1.1)`;
                el.style.zIndex = 100;
                el.style.opacity = '1';
            } else {
                // Receding physical records
                el.classList.remove('active');
                const translateX = offset * spacing + (this.dragOffset);
                const translateZ = -absoluteOffset * 120;
                const rotateY = offset < 0 ? 25 : -25;
                const opacity = Math.max(0.2, 1 - absoluteOffset * 0.25);

                el.style.transform = `translate3d(${translateX}px, 0px, ${translateZ}px) rotateY(${rotateY}deg)`;
                el.style.zIndex = 50 - absoluteOffset;
                el.style.opacity = opacity.toString();
            }
        });
    }

    selectRecord(index) {
        if (this.currentIndex === index) return;
        this.currentIndex = index;
        this.updatePositions();
        if (this.onSelectCallback && this.songs[index]) {
            this.onSelectCallback(this.songs[index]);
        }
    }

    initEventListeners() {
        // Drag / Swipe Controls
        window.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.startX = e.clientX;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const diff = e.clientX - this.startX;
            this.dragOffset = diff;
            this.updatePositions();
        });

        window.addEventListener('mouseup', () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            if (this.dragOffset < -60 && this.currentIndex < this.songs.length - 1) {
                this.currentIndex++;
            } else if (this.dragOffset > 60 && this.currentIndex > 0) {
                this.currentIndex--;
            }
            this.dragOffset = 0;
            this.updatePositions();
            if (this.songs[this.currentIndex]) {
                this.onSelectCallback(this.songs[this.currentIndex]);
            }
        });
    }
}
