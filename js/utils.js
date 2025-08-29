/**
 * A module for utility functions.
 */


class Utils {
    /**
     * Displays a status message to the user.
     * @param {string} message - The message to display.
     * @param {string} type - The type of message ('success', 'error', 'info').
     */
    static showStatus(message, type) {
        const statusElement = document.getElementById('statusMessage');
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;
        statusElement.style.display = 'block';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }

    /**
     * Creates a distortion curve for the WaveShaperNode.
     * @param {number} amount - The amount of distortion.
     * @returns {Float32Array} The distortion curve.
     */
    static makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;
        
        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }
        
        return curve;
    }

    /**
     * Converts a feature name from camelCase to a readable format.
     * @param {string} name - The camelCase feature name.
     * @returns {string} The formatted name.
     */
    static formatFeatureName(name) {
        return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    /**
     * Converts an AudioBuffer to a WAV file ArrayBuffer.
     * @param {AudioBuffer} buffer - The audio buffer to convert.
     * @returns {ArrayBuffer} The WAV file data.
     */
    static audioBufferToWav(buffer) {
        // ... (The audioBufferToWav function code from the original file)
        const length = buffer.length * buffer.numberOfChannels * 2 + 44;
        const arrayBuffer = new ArrayBuffer(length);
        const view = new DataView(arrayBuffer);
        const channels = [];
        let offset = 0;
        let pos = 0;
        
        const setUint16 = (data) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        
        const setUint32 = (data) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };
        
        // RIFF identifier
        view.setUint32(pos, 0x46464952, false); pos += 4;
        view.setUint32(pos, length - 8, true); pos += 4;
        view.setUint32(pos, 0x45564157, false); pos += 4;
        view.setUint32(pos, 0x20746d66, false); pos += 4;
        view.setUint32(pos, 16, true); pos += 4;
        view.setUint16(pos, 1, true); pos += 2;
        view.setUint16(pos, buffer.numberOfChannels, true); pos += 2;
        view.setUint32(pos, buffer.sampleRate, true); pos += 4;
        view.setUint32(pos, buffer.sampleRate * buffer.numberOfChannels * 2, true); pos += 4;
        view.setUint16(pos, buffer.numberOfChannels * 2, true); pos += 2;
        view.setUint16(pos, 16, true); pos += 2;
        view.setUint32(pos, 0x61746164, false); pos += 4;
        view.setUint32(pos, length - pos - 4, true); pos += 4;
        
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }
        
        while (pos < length) {
            for (let i = 0; i < buffer.numberOfChannels; i++) {
                const sample = Math.max(-1, Math.min(1, channels[i][offset]));
                view.setInt16(pos, sample * 0x7FFF, true);
                pos += 2;
            }
            offset++;
        }
        
        return arrayBuffer;
    }
}