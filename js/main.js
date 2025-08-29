// This script is the entry point and handles user interaction.

// Create an instance of the audio system
const musicSystem = new MusicAnalysisSystem();

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // File upload
    document.getElementById('audioFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            musicSystem.handleFileUpload(file);
        }
    });

    // Playback controls
    document.getElementById('playBtn').addEventListener('click', () => musicSystem.play());
    document.getElementById('pauseBtn').addEventListener('click', () => musicSystem.pause());
    document.getElementById('stopBtn').addEventListener('click', () => musicSystem.stop());

    // Effect controls
    document.getElementById('playbackRate').addEventListener('input', (e) => {
        document.getElementById('rateValue').textContent = e.target.value;
        if (musicSystem.source) {
            musicSystem.source.playbackRate.value = parseFloat(e.target.value);
        }
    });
    
    document.getElementById('volume').addEventListener('input', (e) => {
        document.getElementById('volumeValue').textContent = e.target.value;
        if (musicSystem.gainNode) {
            musicSystem.gainNode.gain.value = e.target.value / 100;
        }
    });
    
    document.getElementById('lowpass').addEventListener('input', (e) => {
        document.getElementById('lowpassValue').textContent = e.target.value;
        if (musicSystem.lowpassFilter) {
            musicSystem.lowpassFilter.frequency.value = parseFloat(e.target.value);
        }
    });
    
    document.getElementById('highpass').addEventListener('input', (e) => {
        document.getElementById('highpassValue').textContent = e.target.value;
        if (musicSystem.highpassFilter) {
            musicSystem.highpassFilter.frequency.value = parseFloat(e.target.value);
        }
    });
    
    document.getElementById('distortion').addEventListener('input', (e) => {
        document.getElementById('distortionValue').textContent = e.target.value;
        musicSystem.updateDistortion(e.target.value);
    });
    
    document.getElementById('pitchShift').addEventListener('input', (e) => {
        document.getElementById('pitchValue').textContent = e.target.value;
    });
    
    document.getElementById('synthesisMode').addEventListener('change', (e) => {
        musicSystem.applySynthesisMode(e.target.value);
    });

    // Export
    document.getElementById('exportBtn').addEventListener('click', () => musicSystem.exportAudio());
    
    // Separation buttons
    document.getElementById('separateVocals').addEventListener('click', () => musicSystem.separateComponent('vocals'));
    document.getElementById('separateDrums').addEventListener('click', () => musicSystem.separateComponent('drums'));
    document.getElementById('separateBass').addEventListener('click', () => musicSystem.separateComponent('bass'));
    document.getElementById('separateOther').addEventListener('click', () => musicSystem.separateComponent('other'));
    document.getElementById('playOriginal').addEventListener('click', () => musicSystem.playOriginalMix());
});