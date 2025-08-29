
class MusicAnalysisSystem {
    constructor() {
        this.audioContext = null;
        this.audioBuffer = null;
        this.source = null;
        this.analyser = null;
        this.gainNode = null;
        this.lowpassFilter = null;
        this.highpassFilter = null;
        this.waveShaperNode = null;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.animationId = null;
        this.extractedFeatures = {};
        this.separatedTracks = {};
        this.originalBuffer = null;
    }

    async handleFileUpload(file) {
        Utils.showStatus('Loading audio file...', 'info');
        document.getElementById('loadingSpinner').style.display = 'block';
        
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            const arrayBuffer = await file.arrayBuffer();
            this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.originalBuffer = this.audioBuffer; // Store the original for later use
            
            this.extractFeatures();
            this.setupAudioNodes();
            this.startVisualization();
            
            document.getElementById('controlsGrid').style.display = 'grid';
            document.getElementById('separatorControls').style.display = 'block';
            document.getElementById('visualizationContainer').style.display = 'grid';
            document.getElementById('featureDisplay').style.display = 'block';
            
            document.getElementById('loadingSpinner').style.display = 'none';
            Utils.showStatus('Audio loaded successfully!', 'success');
            
        } catch (error) {
            document.getElementById('loadingSpinner').style.display = 'none';
            Utils.showStatus('Error loading audio file: ' + error.message, 'error');
        }
    }

    extractFeatures() {
        const data = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;
        
        this.extractedFeatures.duration = this.audioBuffer.duration.toFixed(2) + ' s';
        this.extractedFeatures.sampleRate = sampleRate + ' Hz';
        this.extractedFeatures.channels = this.audioBuffer.numberOfChannels;
        
        // ... (all feature extraction logic)
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i] * data[i];
        }
        this.extractedFeatures.rmsEnergy = Math.sqrt(sum / data.length).toFixed(4);

        let zeroCrossings = 0;
        for (let i = 1; i < data.length; i++) {
            if ((data[i] >= 0) !== (data[i-1] >= 0)) {
                zeroCrossings++;
            }
        }
        this.extractedFeatures.zeroCrossingRate = (zeroCrossings / data.length).toFixed(4);
        
        const tempo = this.estimateTempo(data, sampleRate);
        this.extractedFeatures.estimatedBPM = tempo.toFixed(0);

        this.displayFeatures();
    }

    displayFeatures() {
        const featureGrid = document.getElementById('featureGrid');
        featureGrid.innerHTML = '';
        
        for (const [key, value] of Object.entries(this.extractedFeatures)) {
            const item = document.createElement('div');
            item.className = 'feature-item';
            item.innerHTML = `
                <div class="label">${Utils.formatFeatureName(key)}</div>
                <div class="value">${value}</div>
            `;
            featureGrid.appendChild(item);
        }
    }

    estimateTempo(data, sampleRate) {
        // ... (estimateTempo function logic)
        const windowSize = sampleRate * 0.5;
        const hopSize = windowSize / 2;
        const energies = [];
        for (let i = 0; i < data.length - windowSize; i += hopSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += data[i + j] * data[i + j];
            }
            energies.push(energy);
        }
        const peaks = [];
        for (let i = 1; i < energies.length - 1; i++) {
            if (energies[i] > energies[i-1] && energies[i] > energies[i+1]) {
                peaks.push(i);
            }
        }
        if (peaks.length > 1) {
            let totalInterval = 0;
            for (let i = 1; i < peaks.length; i++) {
                totalInterval += peaks[i] - peaks[i-1];
            }
            const avgInterval = totalInterval / (peaks.length - 1);
            const beatsPerSecond = 1 / (avgInterval * hopSize / sampleRate);
            return beatsPerSecond * 60;
        }
        return 120;
    }

    setupAudioNodes() {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 0.7;
        
        this.lowpassFilter = this.audioContext.createBiquadFilter();
        this.lowpassFilter.type = 'lowpass';
        this.lowpassFilter.frequency.value = 20000;
        
        this.highpassFilter = this.audioContext.createBiquadFilter();
        this.highpassFilter.type = 'highpass';
        this.highpassFilter.frequency.value = 0;
        
        this.waveShaperNode = this.audioContext.createWaveShaper();
        this.waveShaperNode.curve = Utils.makeDistortionCurve(0);
        this.waveShaperNode.oversample = '4x';
    }

    updateDistortion(value) {
        if (this.waveShaperNode) {
            this.waveShaperNode.curve = Utils.makeDistortionCurve(parseInt(value));
        }
    }

    play() {
        if (this.isPlaying) return;
        if (!this.audioBuffer) {
            Utils.showStatus('Please load an audio file first', 'error');
            return;
        }
        
        this.source = this.audioContext.createBufferSource();
        this.source.buffer = this.audioBuffer;
        this.source.playbackRate.value = parseFloat(document.getElementById('playbackRate').value);
        
        this.source.connect(this.highpassFilter);
        this.highpassFilter.connect(this.lowpassFilter);
        this.lowpassFilter.connect(this.waveShaperNode);
        this.waveShaperNode.connect(this.gainNode);
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        
        const offset = this.pauseTime;
        this.source.start(0, offset);
        this.startTime = this.audioContext.currentTime - offset;
        this.isPlaying = true;
        
        this.source.onended = () => {
            if (this.isPlaying) {
                this.stop();
            }
        };
    }

    pause() {
        if (!this.isPlaying) return;
        this.pauseTime = this.audioContext.currentTime - this.startTime;
        this.stop();
    }

    stop() {
        if (this.source) {
            this.source.stop();
            this.source.disconnect();
            this.source = null;
        }
        this.isPlaying = false;
        this.pauseTime = 0;
        this.startTime = 0;
    }

    applySynthesisMode(mode) {
        if (!this.originalBuffer) return;
        
        let newBuffer;
        switch(mode) {
            case 'reversed':
                newBuffer = this.reverseBuffer(this.originalBuffer);
                break;
            case 'pitched':
                const semitones = parseInt(document.getElementById('pitchShift').value);
                newBuffer = this.pitchShiftBuffer(this.originalBuffer, semitones);
                break;
            case 'granular':
                newBuffer = this.granularSynthesis(this.originalBuffer);
                break;
            default:
                newBuffer = this.originalBuffer;
        }
        this.audioBuffer = newBuffer;
        Utils.showStatus(`Applied ${mode} synthesis mode`, 'success');
    }

    reverseBuffer(buffer) {
        // ... (reverseBuffer function logic)
        const length = buffer.length;
        const channels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        
        const newBuffer = this.audioContext.createBuffer(channels, length, sampleRate);
        
        for (let channel = 0; channel < channels; channel++) {
            const data = buffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                newData[i] = data[length - 1 - i];
            }
        }
        return newBuffer;
    }

    pitchShiftBuffer(buffer, semitones) {
        // ... (pitchShiftBuffer function logic)
        const pitchRatio = Math.pow(2, semitones / 12);
        const length = Math.floor(buffer.length / pitchRatio);
        const channels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        
        const newBuffer = this.audioContext.createBuffer(channels, length, sampleRate);
        
        for (let channel = 0; channel < channels; channel++) {
            const data = buffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const sourceIndex = Math.floor(i * pitchRatio);
                if (sourceIndex < data.length) {
                    newData[i] = data[sourceIndex];
                }
            }
        }
        return newBuffer;
    }

    granularSynthesis(buffer) {
        // ... (granularSynthesis function logic)
        const grainSize = 0.05;
        const overlap = 0.5;
        const channels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        
        const newBuffer = this.audioContext.createBuffer(channels, length, sampleRate);
        const grainSamples = Math.floor(grainSize * sampleRate);
        
        for (let channel = 0; channel < channels; channel++) {
            const data = buffer.getChannelData(channel);
            const newData = newBuffer.getChannelData(channel);
            
            for (let i = 0; i < length; i += Math.floor(grainSamples * (1 - overlap))) {
                const grainStart = Math.floor(Math.random() * (length - grainSamples));
                
                for (let j = 0; j < grainSamples && i + j < length; j++) {
                    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / grainSamples);
                    if (grainStart + j < data.length) {
                        newData[i + j] += data[grainStart + j] * window * 0.5;
                    }
                }
            }
        }
        return newBuffer;
    }

    separateComponent(component) {
        if (!this.audioBuffer) return;
        
        Utils.showStatus(`Separating ${component}...`, 'info');
        
        const data = this.audioBuffer.getChannelData(0);
        const sampleRate = this.audioBuffer.sampleRate;
        const newBuffer = this.audioContext.createBuffer(1, data.length, sampleRate);
        const newData = newBuffer.getChannelData(0);
        
        const ranges = {
            vocals: { low: 200, high: 4000 },
            drums: { low: 20, high: 200 },
            bass: { low: 20, high: 250 },
            other: { low: 4000, high: 20000 }
        };
        const range = ranges[component];
        
        for (let i = 1; i < data.length - 1; i++) {
            const highpass = data[i] - data[i-1];
            const lowpass = (data[i-1] + data[i] + data[i+1]) / 3;
            
            if (component === 'drums') {
                newData[i] = highpass * 0.8;
            } else if (component === 'bass') {
                newData[i] = lowpass * 1.5;
            } else if (component === 'vocals') {
                newData[i] = data[i] - lowpass * 0.5;
            } else {
                newData[i] = highpass * 0.5;
            }
        }
        
        this.separatedTracks[component] = newBuffer;
        this.updateTrackList();
        Utils.showStatus(`${component} separated successfully`, 'success');
    }

    updateTrackList() {
        const trackList = document.getElementById('trackList');
        trackList.innerHTML = '';
        
        for (const [name, buffer] of Object.entries(this.separatedTracks)) {
            const li = document.createElement('li');
            li.className = 'track-item';
            li.innerHTML = `
                <span>${name.charAt(0).toUpperCase() + name.slice(1)}</span>
                <button onclick="musicSystem.playSeparatedTrack('${name}')">Play</button>
            `;
            trackList.appendChild(li);
        }
    }

    playSeparatedTrack(trackName) {
        if (!this.separatedTracks[trackName]) return;
        this.stop();
        this.audioBuffer = this.separatedTracks[trackName];
        this.play();
    }

    playOriginalMix() {
        if (this.originalBuffer) {
            this.audioBuffer = this.originalBuffer;
            this.play();
        }
    }

    async exportAudio() {
        if (!this.audioBuffer) {
            Utils.showStatus('No audio to export', 'error');
            return;
        }
        
        const format = document.getElementById('outputFormat').value;
        const sampleRate = parseInt(document.getElementById('sampleRate').value);
        
        Utils.showStatus('Exporting audio...', 'info');
        
        const offlineContext = new OfflineAudioContext(
            this.audioBuffer.numberOfChannels,
            this.audioBuffer.length,
            sampleRate
        );
        
        const source = offlineContext.createBufferSource();
        source.buffer = this.audioBuffer;
        source.connect(offlineContext.destination);
        source.start();
        
        try {
            const renderedBuffer = await offlineContext.startRendering();
            const wav = Utils.audioBufferToWav(renderedBuffer);
            const blob = new Blob([wav], { type: 'audio/wav' });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `processed_audio.${format}`;
            a.click();
            
            URL.revokeObjectURL(url);
            Utils.showStatus('Audio exported successfully!', 'success');
        } catch (error) {
            Utils.showStatus('Export failed: ' + error.message, 'error');
        }
    }

    startVisualization() {
        const waveformCanvas = document.getElementById('waveformCanvas');
        const spectrumCanvas = document.getElementById('spectrumCanvas');
        const waveCtx = waveformCanvas.getContext('2d');
        const specCtx = spectrumCanvas.getContext('2d');
        
        const drawWaveform = () => {
            if (!this.analyser) return;
            const bufferLength = this.analyser.fftSize;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteTimeDomainData(dataArray);
            
            waveCtx.fillStyle = '#1a1a2e';
            waveCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            
            waveCtx.lineWidth = 2;
            waveCtx.strokeStyle = '#00ff88';
            waveCtx.beginPath();
            
            const sliceWidth = waveformCanvas.width / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * waveformCanvas.height / 2;
                if (i === 0) {
                    waveCtx.moveTo(x, y);
                } else {
                    waveCtx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            
            waveCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
            waveCtx.stroke();
        };
        
        const drawSpectrum = () => {
            if (!this.analyser) return;
            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.analyser.getByteFrequencyData(dataArray);
            
            specCtx.fillStyle = '#1a1a2e';
            specCtx.fillRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
            
            const barWidth = (spectrumCanvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * spectrumCanvas.height;
                const r = barHeight + 25 * (i / bufferLength);
                const g = 250 * (i / bufferLength);
                const b = 50;
                
                specCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                specCtx.fillRect(x, spectrumCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        };
        
        const draw = () => {
            this.animationId = requestAnimationFrame(draw);
            drawWaveform();
            drawSpectrum();
        };
        
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        draw();
    }
}