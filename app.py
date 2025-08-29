# app.py
# Import necessary libraries
import os
import subprocess
import zipfile
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
import uuid
import shutil
import threading
import time

# Initialize the Flask application
app = Flask(__name__)
# Enable Cross-Origin Resource Sharing (CORS) to allow requests from the frontend
CORS(app)

# Define the folder for uploads and where Spleeter will output the separated files
UPLOAD_FOLDER = 'uploads'
OUTPUT_FOLDER = 'output'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def cleanup_files(paths_to_delete, delay=5):
    """
    This function runs in a separate thread to delete files after a delay.
    This avoids file locking issues on Windows.
    """
    # Wait for a few seconds to ensure the file handle is released
    time.sleep(delay)
    
    print(f"Background cleanup started for: {paths_to_delete}")
    for path in paths_to_delete:
        try:
            if os.path.isfile(path):
                os.remove(path)
                print(f"Deleted file: {path}")
            elif os.path.isdir(path):
                shutil.rmtree(path)
                print(f"Deleted directory: {path}")
        except OSError as e:
            print(f"Error during background cleanup for path {path}: {e}")

@app.route('/process', methods=['POST'])
def process_audio():
    """
    This function handles the audio processing.
    It receives an audio file, saves it, runs Spleeter, zips the output,
    and sends the zip file back.
    """
    # --- 1. File Handling ---
    if 'audioFile' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    file = request.files['audioFile']

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        unique_id = str(uuid.uuid4())
        original_filename = file.filename
        
        safe_basename = "".join(c if c.isalnum() else '_' for c in os.path.splitext(original_filename)[0])
        extension = os.path.splitext(original_filename)[1]
        safe_original_filename = f"{safe_basename}{extension}"
        
        input_filename = f"{unique_id}_{safe_original_filename}"
        input_path = os.path.join(UPLOAD_FOLDER, input_filename)
        
        file.save(input_path)
        print(f"File saved to {input_path}")

        # --- 2. Spleeter Processing ---
        spleeter_output_path = os.path.join(OUTPUT_FOLDER, unique_id)
        
        try:
            command = [
                'spleeter', 'separate',
                '-p', 'spleeter:4stems',
                '-o', spleeter_output_path,
                input_path
            ]
            print(f"Running Spleeter command: {' '.join(command)}")
            
            result = subprocess.run(command, capture_output=True, text=True, check=True)
            
            print("--- Spleeter STDOUT ---")
            print(result.stdout)
            print("--- Spleeter STDERR ---")
            print(result.stderr)
            print("-----------------------")
            
            print("Spleeter processing complete.")
        except subprocess.CalledProcessError as e:
            print(f"Error: Spleeter process failed with exit code {e.returncode}")
            print("--- Spleeter STDOUT ---")
            print(e.stdout)
            print("--- Spleeter STDERR ---")
            print(e.stderr)
            print("-----------------------")
            cleanup_thread = threading.Thread(target=cleanup_files, args=([input_path],))
            cleanup_thread.start()
            return jsonify({"error": "Spleeter process failed.", "details": e.stderr}), 500
        
        # --- 3. Zipping the Results ---
        actual_contents = []
        try:
            actual_contents = os.listdir(spleeter_output_path)
            print(f"Actual contents of {spleeter_output_path}: {actual_contents}")
        except FileNotFoundError:
            print(f"Error: The base output directory {spleeter_output_path} was not created by Spleeter.")
        
        if not actual_contents:
             print(f"Error: Spleeter ran but the output directory is empty.")
             cleanup_thread = threading.Thread(target=cleanup_files, args=([input_path, spleeter_output_path],))
             cleanup_thread.start()
             return jsonify({"error": "Spleeter did not produce any output files. The audio format might be unsupported or the file is corrupt."}), 500

        result_path = os.path.join(spleeter_output_path, actual_contents[0])
        
        print(f"Found Spleeter output at: {result_path}")
        
        zip_filename = f"{unique_id}_stems.zip"
        zip_path = os.path.join(UPLOAD_FOLDER, zip_filename)

        with zipfile.ZipFile(zip_path, 'w') as zipf:
            for root, dirs, files in os.walk(result_path):
                for file_to_zip in files:
                    arcname = file_to_zip
                    zipf.write(os.path.join(root, file_to_zip), arcname=arcname)
        
        print(f"Results zipped to {zip_path}")

        # --- 4. Start Background Cleanup (MODIFIED) ---
        # We will now ONLY delete the original uploaded file.
        # The spleeter output folder and the final zip file will NOT be deleted.
        paths_to_clean = [input_path]
        cleanup_thread = threading.Thread(target=cleanup_files, args=(paths_to_clean,))
        cleanup_thread.start()

        # --- 5. Sending the Response ---
        return send_file(
            zip_path,
            as_attachment=True,
            download_name=f"{os.path.splitext(original_filename)[0]}_stems.zip"
        )

# This allows you to run the app directly with 'python app.py'
if __name__ == '__main__':
    app.run(debug=True, port=5000)
