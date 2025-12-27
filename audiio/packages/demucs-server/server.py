#!/usr/bin/env python3
"""
Demucs Server - Streaming REST API for vocal removal
Runs the real Demucs AI model for high-quality stem separation.

Features:
- Streaming mode: Returns first segment quickly for immediate playback
- Full processing continues in background
- Seamless chunk-based processing for near real-time karaoke
"""

import os
import io
import tempfile
import hashlib
import subprocess
import threading
import time
from pathlib import Path
from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
import torch
import torchaudio
import numpy as np
import soundfile as sf

# Import demucs
from demucs.pretrained import get_model
from demucs.apply import apply_model

app = Flask(__name__)
CORS(app)

# Cache directory for processed stems
CACHE_DIR = Path(tempfile.gettempdir()) / "demucs-cache"
CACHE_DIR.mkdir(exist_ok=True)

# Temp directory for audio conversion
TEMP_DIR = Path(tempfile.gettempdir()) / "demucs-temp"
TEMP_DIR.mkdir(exist_ok=True)

# Model configuration
MODEL_NAME = os.environ.get("DEMUCS_MODEL", "htdemucs")
MODEL = None
DEVICE = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"

print(f"[Demucs] Using device: {DEVICE}")
print(f"[Demucs] Model: {MODEL_NAME}")

# Streaming configuration
QUICK_SEGMENT_SECONDS = 15  # Process first N seconds for quick start
SAMPLE_RATE = 44100

# Background processing jobs
processing_jobs = {}  # track_id -> {"status": "processing"|"complete", "result": bytes}


def get_demucs_model():
    global MODEL
    if MODEL is None:
        print(f"[Demucs] Loading {MODEL_NAME} model...")
        MODEL = get_model(MODEL_NAME)
        MODEL.to(DEVICE)
        MODEL.eval()

        # Enable torch optimizations
        if DEVICE == "cuda":
            torch.backends.cudnn.benchmark = True

        print(f"[Demucs] Model loaded successfully on {DEVICE}")
    return MODEL


def get_cache_key(audio_bytes: bytes) -> str:
    """Generate cache key from audio content."""
    return hashlib.md5(audio_bytes).hexdigest()


def convert_to_wav(audio_bytes: bytes, content_type: str = None) -> str:
    """Convert any audio format to WAV using ffmpeg. Returns path to wav file."""
    # Determine input extension from content type
    ext_map = {
        "audio/webm": ".webm",
        "audio/mp4": ".m4a",
        "audio/mpeg": ".mp3",
        "audio/ogg": ".ogg",
        "video/webm": ".webm",
        "video/mp4": ".mp4",
    }
    ext = ext_map.get(content_type, ".audio")

    # Create temp files
    input_path = TEMP_DIR / f"input_{hashlib.md5(audio_bytes).hexdigest()[:8]}{ext}"
    output_path = TEMP_DIR / f"output_{hashlib.md5(audio_bytes).hexdigest()[:8]}.wav"

    # Write input
    input_path.write_bytes(audio_bytes)

    # Convert with ffmpeg
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", str(input_path),
            "-ar", "44100",  # Resample to 44.1kHz
            "-ac", "2",      # Stereo
            "-f", "wav",
            str(output_path)
        ], capture_output=True, check=True)

        # Clean up input
        input_path.unlink(missing_ok=True)

        return str(output_path)
    except subprocess.CalledProcessError as e:
        print(f"[Demucs] FFmpeg error: {e.stderr.decode()}")
        input_path.unlink(missing_ok=True)
        raise RuntimeError(f"Failed to convert audio: {e.stderr.decode()}")


def load_wav(wav_path: str) -> tuple:
    """Load WAV file using soundfile (more reliable than torchaudio)."""
    data, sample_rate = sf.read(wav_path)
    # soundfile returns (samples, channels), we need (channels, samples)
    if len(data.shape) == 1:
        data = data.reshape(1, -1)
    else:
        data = data.T
    return torch.from_numpy(data.astype(np.float32)), sample_rate


def save_as_mp3(waveform: torch.Tensor, sample_rate: int, output_path: str):
    """Save waveform as MP3 using ffmpeg (more reliable than torchaudio)."""
    # Save as temporary WAV first
    temp_wav = output_path.replace('.mp3', '_temp.wav')

    # Convert to numpy and save WAV using soundfile
    data = waveform.numpy()
    # soundfile expects (samples, channels)
    sf.write(temp_wav, data.T, sample_rate)

    # Convert to MP3 with ffmpeg
    subprocess.run([
        "ffmpeg", "-y", "-i", temp_wav,
        "-codec:a", "libmp3lame", "-b:a", "192k",
        output_path
    ], capture_output=True, check=True)

    # Cleanup
    Path(temp_wav).unlink(missing_ok=True)


def process_waveform(waveform: torch.Tensor) -> torch.Tensor:
    """Process a waveform through Demucs and return instrumental."""
    # Add batch dimension if needed
    if waveform.dim() == 2:
        waveform = waveform.unsqueeze(0)

    waveform = waveform.to(DEVICE)
    model = get_demucs_model()

    with torch.no_grad():
        sources = apply_model(model, waveform, device=DEVICE)

    # sources shape: [batch, sources, channels, samples]
    # htdemucs sources: drums, bass, other, vocals
    drums = sources[0, 0]
    bass = sources[0, 1]
    other = sources[0, 2]

    instrumental = drums + bass + other
    return instrumental.cpu()


def process_audio(audio_bytes: bytes, content_type: str = None) -> bytes:
    """Process audio through Demucs and return instrumental."""

    wav_path = None
    output_path = None
    try:
        # Convert to WAV first (handles any format via ffmpeg)
        print("[Demucs] Converting to WAV...")
        wav_path = convert_to_wav(audio_bytes, content_type)

        # Load the WAV file using soundfile/scipy (more reliable)
        print("[Demucs] Loading audio...")
        waveform, sample_rate = load_wav(wav_path)

        # Clean up wav file
        Path(wav_path).unlink(missing_ok=True)
        wav_path = None

        # Resample to 44100 if needed (Demucs expects 44.1kHz)
        if sample_rate != 44100:
            resampler = torchaudio.transforms.Resample(sample_rate, 44100)
            waveform = resampler(waveform)
            sample_rate = 44100

        # Ensure stereo
        if waveform.shape[0] == 1:
            waveform = waveform.repeat(2, 1)
        elif waveform.shape[0] > 2:
            waveform = waveform[:2]

        print("[Demucs] Running AI separation...")
        instrumental = process_waveform(waveform)

        # Save as MP3 using ffmpeg (more reliable than torchaudio)
        print("[Demucs] Encoding output...")
        output_path = str(TEMP_DIR / f"output_{hashlib.md5(audio_bytes).hexdigest()[:8]}.mp3")
        save_as_mp3(instrumental, sample_rate, output_path)

        # Read and return
        result = Path(output_path).read_bytes()
        Path(output_path).unlink(missing_ok=True)

        return result

    finally:
        # Ensure cleanup
        if wav_path:
            Path(wav_path).unlink(missing_ok=True)
        if output_path and Path(output_path).exists():
            Path(output_path).unlink(missing_ok=True)


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "device": DEVICE,
        "model": MODEL_NAME,
        "model_loaded": MODEL is not None,
        "gpu_available": torch.cuda.is_available() or torch.backends.mps.is_available()
    })


@app.route("/separate", methods=["POST"])
def separate():
    """
    Separate vocals from audio.

    Accepts:
    - Audio file in request body (multipart/form-data with 'audio' field)
    - Or raw audio bytes with Content-Type header

    Returns:
    - Instrumental audio (MP3)
    """

    # Get audio data
    content_type = None
    if "audio" in request.files:
        audio_file = request.files["audio"]
        audio_bytes = audio_file.read()
        content_type = audio_file.content_type
    else:
        audio_bytes = request.get_data()
        content_type = request.content_type

    if not audio_bytes:
        return jsonify({"error": "No audio provided"}), 400

    # Check cache
    cache_key = get_cache_key(audio_bytes)
    cache_path = CACHE_DIR / f"{cache_key}.mp3"

    if cache_path.exists():
        print(f"[Demucs] Cache hit: {cache_key}")
        return send_file(cache_path, mimetype="audio/mpeg")

    print(f"[Demucs] Processing audio ({len(audio_bytes)} bytes, {content_type})...")

    try:
        instrumental_bytes = process_audio(audio_bytes, content_type)

        # Cache result
        cache_path.write_bytes(instrumental_bytes)
        print(f"[Demucs] Cached: {cache_key}")

        return send_file(
            io.BytesIO(instrumental_bytes),
            mimetype="audio/mpeg"
        )
    except Exception as e:
        print(f"[Demucs] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/separate/url", methods=["POST"])
def separate_url():
    """
    Separate vocals from audio at URL.

    Body: {"url": "https://..."}

    Returns:
    - Instrumental audio (MP3)
    """
    import requests as http_requests

    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"error": "No URL provided"}), 400

    url = data["url"]

    # Check cache by URL hash
    cache_key = hashlib.md5(url.encode()).hexdigest()
    cache_path = CACHE_DIR / f"{cache_key}.mp3"

    if cache_path.exists():
        print(f"[Demucs] Cache hit for URL: {cache_key}")
        return send_file(cache_path, mimetype="audio/mpeg")

    print(f"[Demucs] Fetching: {url[:50]}...")

    try:
        # Fetch audio
        response = http_requests.get(url, timeout=60)
        response.raise_for_status()
        audio_bytes = response.content
        content_type = response.headers.get("Content-Type", "audio/mp4")

        print(f"[Demucs] Processing ({len(audio_bytes)} bytes, {content_type})...")
        instrumental_bytes = process_audio(audio_bytes, content_type)

        # Cache result
        cache_path.write_bytes(instrumental_bytes)

        return send_file(
            io.BytesIO(instrumental_bytes),
            mimetype="audio/mpeg"
        )
    except Exception as e:
        print(f"[Demucs] Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/clear-cache", methods=["POST"])
def clear_cache():
    """Clear the cache."""
    import shutil
    shutil.rmtree(CACHE_DIR)
    CACHE_DIR.mkdir(exist_ok=True)
    return jsonify({"status": "cache cleared"})


# =============================================
# Streaming Endpoints for Quick Start Karaoke
# =============================================

def stream_first_segment_from_url(url: str, seconds: int = 20) -> tuple:
    """
    Use ffmpeg to stream just the first N seconds from a URL.
    This is MUCH faster than downloading the entire file first.

    Returns: (wav_path, success)
    """
    output_path = TEMP_DIR / f"stream_segment_{hashlib.md5(url.encode()).hexdigest()[:8]}.wav"

    try:
        # Use ffmpeg to stream and extract just the first N seconds
        # -t limits duration, -y overwrites output
        result = subprocess.run([
            "ffmpeg", "-y",
            "-i", url,              # Stream from URL directly
            "-t", str(seconds),     # Only get first N seconds
            "-ar", "44100",         # Resample
            "-ac", "2",             # Stereo
            "-f", "wav",
            str(output_path)
        ], capture_output=True, timeout=30)  # 30 second timeout for segment

        if result.returncode != 0:
            print(f"[Demucs Stream] FFmpeg segment error: {result.stderr.decode()[:200]}")
            return None, False

        return str(output_path), True
    except subprocess.TimeoutExpired:
        print("[Demucs Stream] FFmpeg segment timeout")
        return None, False
    except Exception as e:
        print(f"[Demucs Stream] FFmpeg segment error: {e}")
        return None, False


def download_and_process_full_track(url: str, track_id: str):
    """Background task to download and process full track."""
    try:
        import requests as http_requests

        print(f"[Demucs Stream] Background: Downloading full track {track_id}...")
        processing_jobs[track_id] = {"status": "processing", "result": None}

        # Download full audio
        response = http_requests.get(url, timeout=120)
        response.raise_for_status()
        audio_bytes = response.content
        content_type = response.headers.get("Content-Type", "audio/mp4")

        print(f"[Demucs Stream] Background: Downloaded ({len(audio_bytes)} bytes)")

        # Process full track
        instrumental_bytes = process_audio(audio_bytes, content_type)

        # Cache result
        cache_path = CACHE_DIR / f"{track_id}.mp3"
        cache_path.write_bytes(instrumental_bytes)

        processing_jobs[track_id] = {"status": "complete", "result": instrumental_bytes}
        print(f"[Demucs Stream] Background: Full track ready ({len(instrumental_bytes)} bytes)")

    except Exception as e:
        print(f"[Demucs Stream] Background error: {e}")
        processing_jobs[track_id] = {"status": "error", "error": str(e)}


@app.route("/stream/start", methods=["POST"])
def stream_start():
    """
    Start streaming karaoke processing.

    FAST PATH: Uses ffmpeg to stream just the first 20 seconds from URL,
    processes that immediately (~3-8 seconds total), then downloads and
    processes full track in background.

    Body: {"url": "https://...", "track_id": "..."}

    Returns JSON:
    {
        "success": true,
        "first_segment": "<base64 encoded mp3>",
        "duration": 180.5,
        "is_complete": false
    }
    """
    import base64

    data = request.get_json()
    if not data or "url" not in data or "track_id" not in data:
        return jsonify({"success": False, "error": "Missing url or track_id"}), 400

    url = data["url"]
    track_id = data["track_id"]

    # Check if full track is already cached
    cache_path = CACHE_DIR / f"{track_id}.mp3"
    if cache_path.exists():
        print(f"[Demucs Stream] Cache hit for: {track_id}")
        audio_bytes = cache_path.read_bytes()
        return jsonify({
            "success": True,
            "first_segment": base64.b64encode(audio_bytes).decode('utf-8'),
            "duration": 0,
            "is_complete": True
        })

    print(f"[Demucs Stream] Starting: {track_id}")

    try:
        # FAST PATH: Stream just the first 20 seconds using ffmpeg
        segment_seconds = QUICK_SEGMENT_SECONDS + 5  # Extra buffer
        print(f"[Demucs Stream] Streaming first {segment_seconds}s from URL...")

        wav_path, success = stream_first_segment_from_url(url, segment_seconds)

        if not success or not wav_path:
            return jsonify({"success": False, "error": "Failed to stream audio segment"}), 500

        # Load the segment
        print("[Demucs Stream] Loading segment...")
        waveform, sample_rate = load_wav(wav_path)
        Path(wav_path).unlink(missing_ok=True)

        # Ensure stereo
        if waveform.shape[0] == 1:
            waveform = waveform.repeat(2, 1)
        elif waveform.shape[0] > 2:
            waveform = waveform[:2]

        # Process the segment
        print("[Demucs Stream] Processing segment through Demucs...")
        instrumental = process_waveform(waveform)

        # Encode as MP3
        output_path = str(TEMP_DIR / f"stream_first_{track_id}.mp3")
        save_as_mp3(instrumental, sample_rate, output_path)
        first_bytes = Path(output_path).read_bytes()
        Path(output_path).unlink(missing_ok=True)

        print(f"[Demucs Stream] First segment ready ({len(first_bytes)} bytes)")

        # Start background processing for full track
        thread = threading.Thread(
            target=download_and_process_full_track,
            args=(url, track_id),
            daemon=True
        )
        thread.start()

        return jsonify({
            "success": True,
            "first_segment": base64.b64encode(first_bytes).decode('utf-8'),
            "duration": 0,  # Unknown until full track processed
            "is_complete": False
        })

    except Exception as e:
        print(f"[Demucs Stream] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/stream/status/<track_id>", methods=["GET"])
def stream_status(track_id: str):
    """
    Check status of streaming processing.

    Returns:
    {
        "status": "processing" | "complete" | "error",
        "full_track": "<base64 encoded mp3>" (only when complete)
    }
    """
    import base64

    job = processing_jobs.get(track_id)

    if not job:
        # Check cache
        cache_path = CACHE_DIR / f"{track_id}.mp3"
        if cache_path.exists():
            audio_bytes = cache_path.read_bytes()
            return jsonify({
                "status": "complete",
                "full_track": base64.b64encode(audio_bytes).decode('utf-8')
            })
        return jsonify({"status": "not_found"}), 404

    if job["status"] == "complete":
        return jsonify({
            "status": "complete",
            "full_track": base64.b64encode(job["result"]).decode('utf-8')
        })
    elif job["status"] == "error":
        return jsonify({
            "status": "error",
            "error": job.get("error", "Unknown error")
        })
    else:
        return jsonify({"status": "processing"})


@app.route("/stream/full/<track_id>", methods=["GET"])
def stream_full(track_id: str):
    """
    Get full processed track as audio file (for direct audio element src).
    Blocks until processing is complete or times out.
    """
    # Check cache first
    cache_path = CACHE_DIR / f"{track_id}.mp3"
    if cache_path.exists():
        return send_file(cache_path, mimetype="audio/mpeg")

    # Wait for background processing (with timeout)
    timeout = 120  # 2 minutes max wait
    start_time = time.time()

    while time.time() - start_time < timeout:
        job = processing_jobs.get(track_id)
        if job:
            if job["status"] == "complete":
                return send_file(
                    io.BytesIO(job["result"]),
                    mimetype="audio/mpeg"
                )
            elif job["status"] == "error":
                return jsonify({"error": job.get("error", "Processing failed")}), 500

        time.sleep(0.5)

    return jsonify({"error": "Processing timeout"}), 504


if __name__ == "__main__":
    # Pre-load model
    get_demucs_model()

    port = int(os.environ.get("PORT", 8765))
    print(f"[Demucs] Server starting on port {port}")
    app.run(host="0.0.0.0", port=port, threaded=True)
