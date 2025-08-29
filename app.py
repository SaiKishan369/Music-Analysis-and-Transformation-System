import streamlit as st
import torch
import torchaudio
import os
import numpy as np
from demucs.pretrained import get_model
from demucs.apply import apply_model
import soundfile as sf
import tempfile
from pathlib import Path
import shutil
import traceback

# --- Core Logic: StemSplitter Class ---

class StemSplitter:
    """
    A class to handle loading the Demucs model and splitting audio tracks.
    """
    def __init__(self):
        """Initializes the StemSplitter with a device (GPU if available)."""
        self.model = None
        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        st.write(f"Using device: `{self.device.upper()}`")

    def load_model(self, model_name="htdemucs"):
        """
        Loads a pre-trained Demucs model.
        Args:
            model_name (str): The name of the Demucs model to load.
        """
        print(f"Loading model: {model_name}")
        self.model = get_model(model_name)
        self.model.to(self.device)
        print("Model loaded successfully.")

    def split_tracks(self, audio_path, stem_config="4stem"):
        """
        Splits the audio file at the given path into its constituent stems.
        Args:
            audio_path (str): The path to the input audio file.
            stem_config (str): "2stem" (vocals/accompaniment) or "4stem" (vocals/drums/bass/other).
        Returns:
            A tuple containing a dictionary of separated stems and the audio's sample rate.
        """
        # Load the audio file
        wav, sr = torchaudio.load(audio_path)
        wav = wav.to(self.device)
        
        # --- ROBUST CHANNEL HANDLING ---
        # Demucs expects mono or stereo audio. This block converts any input to stereo.
        if wav.shape[0] > 2:
            wav = wav[:2]
        elif wav.shape[0] == 1:
            wav = torch.cat([wav, wav])
        
        # --- BATCH DIMENSION FIX ---
        # The model expects a batch dimension. We add one here.
        # Shape changes from [channels, samples] to [1, channels, samples]
        wav = wav.unsqueeze(0)

        # Apply the model to separate stems
        with torch.no_grad():
            stems = apply_model(self.model, wav, device=self.device, progress=True)

        # --- REMOVE BATCH DIMENSION ---
        # The output is also batched, so we remove the batch dimension.
        # Shape changes from [1, sources, channels, samples] to [sources, channels, samples]
        stems = stems.squeeze(0)
        
        # Organize the stems into a dictionary
        stems_dict = {}
        source_names = self.model.sources
        
        if stem_config == "2stem" and "vocals" in source_names:
            # Combine all non-vocal stems into a single "accompaniment" track
            vocals_idx = source_names.index("vocals")
            stems_dict["vocals"] = stems[vocals_idx].cpu().numpy()
            
            accompaniment_stems = [
                stems[i].cpu().numpy() 
                for i in range(len(source_names)) 
                if i != vocals_idx
            ]
            stems_dict["accompaniment"] = np.sum(accompaniment_stems, axis=0)
        else:
            # Default to 4-stem separation
            for i, name in enumerate(source_names):
                stems_dict[name] = stems[i].cpu().numpy()
                
        return stems_dict, sr

def save_stem(stem_data, sr, output_path):
    """
    Saves a single audio stem to a file.
    Args:
        stem_data (np.array): The audio data of the stem.
        sr (int): The sample rate of the audio.
        output_path (str): The path where the file will be saved.
    """
    # Transpose data to match soundfile's expected shape (channels, samples) -> (samples, channels)
    sf.write(output_path, stem_data.T, sr)

# --- Streamlit UI ---

st.set_page_config(layout="wide")
st.title("🎶 Music Stem Splitter")
st.write("""
Upload an audio file (`.mp3`, `.wav`) to separate it into individual instrumental and vocal tracks. 
This tool uses **Demucs**, a state-of-the-art music source separation model.
""")

# --- Model Caching ---
@st.cache_resource
def load_model_cached(model_name="htdemucs"):
    """
    Loads the Demucs model and caches it to avoid reloading on every run.
    """
    splitter = StemSplitter()
    splitter.load_model(model_name)
    return splitter

# --- UI Components ---

# Model and Stem Configuration
with st.sidebar:
    st.header("Configuration")
    model_name = st.selectbox(
        "Select Separation Model",
        ("htdemucs", "htdemucs_ft", "mdx_extra", "mdx"),
        index=0,
        help="Different models offer trade-offs between speed and quality. `htdemucs` is a good default."
    )
    stem_config = st.radio(
        "Select Stem Configuration",
        ("4stem", "2stem"),
        index=0,
        help="**4-stem**: Vocals, Drums, Bass, Other. **2-stem**: Vocals, Accompaniment."
    )
    st.markdown("---")
    st.write("Built with [Streamlit](https://streamlit.io) and [Demucs](https://github.com/facebookresearch/demucs).")


# File Uploader
uploaded_file = st.file_uploader("Choose an audio file", type=['mp3', 'wav', 'flac'])

if uploaded_file is not None:
    # Create a temporary file to store the upload
    with tempfile.NamedTemporaryFile(delete=False, suffix=Path(uploaded_file.name).suffix) as tmp_file:
        tmp_file.write(uploaded_file.getvalue())
        tmp_path = tmp_file.name

    st.audio(tmp_path, format=uploaded_file.type, start_time=0)

    # Button to start processing
    if st.button("Split Audio into Stems"):
        try:
            # Load model (will be cached)
            with st.spinner("Loading separation model... (This may take a moment on first run)"):
                splitter = load_model_cached(model_name)
            
            # Process audio
            with st.spinner("Separating stems... This can take some time depending on the song length."):
                stems, sr = splitter.split_tracks(tmp_path, stem_config)
            
            st.success("Separation complete!")
            
            # Create a temporary directory for the output stems
            temp_dir = tempfile.mkdtemp()
            
            # Display stems with audio players and download buttons
            st.write("### Separated Audio Stems")
            for stem_name, stem_data in stems.items():
                col1, col2 = st.columns([0.7, 0.3])
                
                with col1:
                    st.markdown(f"**{stem_name.title()}**")
                    output_path = os.path.join(temp_dir, f"{stem_name}.wav")
                    save_stem(stem_data, sr, output_path)
                    st.audio(output_path, format="audio/wav")
                
                with col2:
                    # Add a download button for each stem
                    with open(output_path, 'rb') as f:
                        st.download_button(
                            label=f"Download {stem_name.title()}",
                            data=f,
                            file_name=f"{Path(uploaded_file.name).stem}_{stem_name}.wav",
                            mime="audio/wav"
                        )

        except Exception as e:
            st.error(f"An error occurred during processing: {e}")
            # --- IMPROVED ERROR LOGGING ---
            # This will display the full technical traceback in the app for better debugging.
            st.code(traceback.format_exc())
            # Clean up in case of error
            if 'temp_dir' in locals() and os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
        finally:
            # General cleanup of temporary files
            os.unlink(tmp_path)
            if 'temp_dir' in locals() and os.path.exists(temp_dir):
                st.info("Cleaning up temporary files...")
                shutil.rmtree(temp_dir)

else:
    st.info("Please upload an audio file to get started.")
