#!/usr/bin/env python3
"""
Demucs Server v3 - Premium Streaming Vocal Removal

Features:
1. STREAMING CHUNKS - Audio plays within 3-4 seconds, chunks append seamlessly
2. HARDWARE ADAPTIVE - Auto-detects GPU/CPU and tunes settings accordingly
3. PREDICTIVE PROCESSING - Pre-processes next tracks in queue
4. SMART CACHING - LRU cache with persistence across restarts
5. REAL-TIME PROGRESS - ETA based on hardware benchmarks
"""

import os
import io
import json
import time
import queue
import tempfile
import hashlib
import subprocess
import threading
import base64
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Callable, Generator
from collections import OrderedDict
import struct

from flask import Flask, request, jsonify, send_file, Response, stream_with_context
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import torch
import torchaudio
import numpy as np
import soundfile as sf
import re

from demucs.pretrained import get_model
from demucs.apply import apply_model

# =============================================
# Force unbuffered output (critical for subprocess logging)
# =============================================
import sys
# Force line-buffered stdout/stderr for real-time logging
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(line_buffering=True)

def log(msg: str):
    """Print with immediate flush for subprocess visibility."""
    print(msg)
    sys.stdout.flush()

# =============================================
# Filename Sanitization (Windows compatibility)
# =============================================

def sanitize_filename(name: str) -> str:
    """
    Sanitize a string for use as a filename on Windows/Mac/Linux.
    Replaces invalid characters with underscores.
    """
    # Characters invalid on Windows: \ / : * ? " < > |
    # Also replace spaces and other problematic chars
    sanitized = re.sub(r'[\\/:*?"<>|]', '_', name)
    return sanitized

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# =============================================
# Directory Configuration
# =============================================

CACHE_DIR = Path(tempfile.gettempdir()) / "demucs-cache"
CACHE_DIR.mkdir(exist_ok=True)

TEMP_DIR = Path(tempfile.gettempdir()) / "demucs-temp"
TEMP_DIR.mkdir(exist_ok=True)

SERVE_DIR = Path(tempfile.gettempdir()) / "demucs-serve"
SERVE_DIR.mkdir(exist_ok=True)

CHUNKS_DIR = Path(tempfile.gettempdir()) / "demucs-chunks"
CHUNKS_DIR.mkdir(exist_ok=True)

# Persistent cache index
CACHE_INDEX_PATH = CACHE_DIR / "cache_index.json"

# =============================================
# Hardware Detection & Adaptive Configuration
# =============================================

@dataclass
class HardwareProfile:
    device: str
    device_name: str
    vram_gb: float
    cuda_cores: int
    is_apple_silicon: bool
    cpu_cores: int
    ram_gb: float

    # Derived optimal settings
    optimal_chunk_seconds: float = 10.0
    optimal_model_instances: int = 1
    optimal_batch_size: int = 1
    estimated_rtf: float = 1.0  # Real-time factor (1.0 = processes in real-time)

def detect_hardware() -> HardwareProfile:
    """Detect hardware and return optimal configuration."""
    import platform
    import psutil

    device = "cpu"
    device_name = "CPU"
    vram_gb = 0.0
    cuda_cores = 0
    is_apple_silicon = False

    # Check for CUDA
    if torch.cuda.is_available():
        device = "cuda"
        device_name = torch.cuda.get_device_name(0)
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        cuda_cores = torch.cuda.get_device_properties(0).multi_processor_count

    # Check for Apple Silicon (MPS)
    elif torch.backends.mps.is_available():
        device = "mps"
        device_name = "Apple Silicon"
        is_apple_silicon = True
        # Estimate based on chip
        if "M1" in platform.processor() or platform.processor() == "arm":
            vram_gb = 8.0  # Unified memory, estimate
        if "M2" in platform.processor():
            vram_gb = 12.0
        if "M3" in platform.processor():
            vram_gb = 16.0

    cpu_cores = psutil.cpu_count(logical=False) or 4
    ram_gb = psutil.virtual_memory().total / (1024**3)

    profile = HardwareProfile(
        device=device,
        device_name=device_name,
        vram_gb=vram_gb,
        cuda_cores=cuda_cores,
        is_apple_silicon=is_apple_silicon,
        cpu_cores=cpu_cores,
        ram_gb=ram_gb
    )

    # Calculate optimal settings based on hardware
    if device == "cuda":
        if vram_gb >= 8:
            profile.optimal_chunk_seconds = 15.0
            profile.optimal_model_instances = min(2, int(vram_gb / 4))
            profile.optimal_batch_size = 1
            profile.estimated_rtf = 0.3  # 3x faster than real-time
        elif vram_gb >= 4:
            profile.optimal_chunk_seconds = 10.0
            profile.optimal_model_instances = 1
            profile.estimated_rtf = 0.5
        else:
            profile.optimal_chunk_seconds = 8.0
            profile.optimal_model_instances = 1
            profile.estimated_rtf = 0.8

    elif device == "mps":
        profile.optimal_chunk_seconds = 10.0
        profile.optimal_model_instances = 1
        profile.estimated_rtf = 0.4 if is_apple_silicon else 0.6

    else:  # CPU
        # CPU is much slower - use TINY chunks for faster first playback
        # With RTF of 4-5x, a 3-second chunk takes ~12-15 seconds to process
        # This is still slow but much better than 34+ seconds for 8-second chunks
        profile.optimal_chunk_seconds = 3.0  # Small chunks for faster streaming
        profile.optimal_model_instances = 1
        profile.optimal_batch_size = 1
        # CPU is much slower
        profile.estimated_rtf = 3.0 + (10.0 / cpu_cores)  # Slower with fewer cores

    return profile

# Detect hardware at startup
HARDWARE = detect_hardware()
DEVICE = HARDWARE.device
SAMPLE_RATE = 44100

log(f"[Demucs] Hardware Profile:")
log(f"  Device: {HARDWARE.device_name} ({HARDWARE.device})")
log(f"  CUDA Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    log(f"  CUDA Device: {torch.cuda.get_device_name(0)}")
log(f"  MPS Available: {torch.backends.mps.is_available() if hasattr(torch.backends, 'mps') else False}")
log(f"  VRAM: {HARDWARE.vram_gb:.1f} GB" if HARDWARE.vram_gb > 0 else f"  RAM: {HARDWARE.ram_gb:.1f} GB")
log(f"  CPU Cores: {HARDWARE.cpu_cores}")
log(f"  Optimal Chunk: {HARDWARE.optimal_chunk_seconds}s")
log(f"  Model Instances: {HARDWARE.optimal_model_instances}")
log(f"  Estimated RTF: {HARDWARE.estimated_rtf:.2f}x (lower is faster)")

# =============================================
# Quality Modes - Auto-selected based on hardware
# =============================================

# Quality modes with their settings
QUALITY_MODES = {
    "auto": {
        "description": "Auto-detect best settings for your hardware",
        "model": None,  # Determined at runtime
        "chunk_seconds": None,  # Determined at runtime
    },
    "quality": {
        "description": "Best quality, requires GPU for good performance",
        "model": "htdemucs",
        "chunk_seconds": 10.0,
    },
    "balanced": {
        "description": "Good quality with reasonable speed",
        "model": "htdemucs",
        "chunk_seconds": 6.0,
    },
    "fast": {
        "description": "Faster processing, optimized for CPU",
        "model": "htdemucs",  # Same model but smaller chunks
        "chunk_seconds": 2.5,  # Smaller chunks = faster first audio
    },
}

# Current quality mode (can be changed via API)
current_quality_mode = os.environ.get("DEMUCS_QUALITY", "auto")

def get_effective_settings():
    """Get the effective model and chunk settings based on hardware and quality mode."""
    mode = QUALITY_MODES.get(current_quality_mode, QUALITY_MODES["auto"])

    if current_quality_mode == "auto":
        # Auto-select based on hardware
        if DEVICE == "cuda":
            # GPU: use quality settings
            return "htdemucs", 10.0, "quality (GPU detected)"
        elif DEVICE == "mps":
            # Apple Silicon: balanced
            return "htdemucs", 6.0, "balanced (Apple Silicon)"
        else:
            # CPU: use fast settings for responsive streaming
            return "htdemucs", 2.5, "fast (CPU mode)"
    else:
        return mode["model"], mode["chunk_seconds"], current_quality_mode

EFFECTIVE_MODEL, EFFECTIVE_CHUNK_SECONDS, EFFECTIVE_MODE_NAME = get_effective_settings()
log(f"[Demucs] Quality Mode: {EFFECTIVE_MODE_NAME}")
log(f"[Demucs] Using model: {EFFECTIVE_MODEL}, chunk: {EFFECTIVE_CHUNK_SECONDS}s")

# =============================================
# GPU Fallback - Auto-switch to CPU on CUDA errors
# =============================================

# Track if GPU failed and we should use CPU instead
GPU_FAILED = False
GPU_FAILED_LOCK = threading.Lock()

def trigger_gpu_fallback(error_msg: str):
    """Called when GPU processing fails - switches to CPU mode."""
    global GPU_FAILED, DEVICE, EFFECTIVE_MODE_NAME, EFFECTIVE_CHUNK_SECONDS
    with GPU_FAILED_LOCK:
        if GPU_FAILED:
            return  # Already failed
        GPU_FAILED = True
        log(f"[Demucs] GPU FALLBACK: {error_msg}")
        log(f"[Demucs] Switching to CPU mode...")
        DEVICE = "cpu"
        EFFECTIVE_MODE_NAME = "fast (CPU fallback)"
        EFFECTIVE_CHUNK_SECONDS = 2.5  # Use fast settings for CPU

# =============================================
# Model Pool with Hardware-Optimized Settings
# =============================================

MODEL_NAME = EFFECTIVE_MODEL

class ModelPool:
    """Thread-safe pool of pre-loaded models."""

    def __init__(self, model_name: str, device: str, num_instances: int):
        self.model_name = model_name
        self.device = device
        self.num_instances = num_instances
        self.models: List[torch.nn.Module] = []
        self.locks: List[threading.Lock] = []
        self.available = queue.Queue()
        self._initialized = False
        self._benchmark_rtf = None

    def initialize(self):
        if self._initialized:
            return

        print(f"[ModelPool] Loading {self.num_instances} x {self.model_name}...")

        for i in range(self.num_instances):
            print(f"[ModelPool] Loading instance {i+1}/{self.num_instances}...")
            model = get_model(self.model_name)
            model.to(self.device)
            model.eval()

            self.models.append(model)
            self.locks.append(threading.Lock())
            self.available.put(i)

        if self.device == "cuda":
            torch.backends.cudnn.benchmark = True

        self._initialized = True
        print(f"[ModelPool] Ready on {self.device}")

        # Run benchmark
        self._run_benchmark()

    def _run_benchmark(self):
        """Run a quick benchmark to measure actual RTF."""
        global GPU_FAILED
        try:
            print("[ModelPool] Running benchmark...")
            # Create 5 seconds of audio
            test_audio = torch.randn(1, 2, 5 * SAMPLE_RATE).to(self.device)

            start = time.time()
            with torch.no_grad():
                _ = apply_model(self.models[0], test_audio, device=self.device)
            elapsed = time.time() - start

            self._benchmark_rtf = elapsed / 5.0
            print(f"[ModelPool] Benchmark RTF: {self._benchmark_rtf:.2f}x (5s audio in {elapsed:.1f}s)")
        except RuntimeError as e:
            error_str = str(e)
            if "CUDA" in error_str or "cuda" in error_str or "no kernel image" in error_str:
                trigger_gpu_fallback(error_str.split('\n')[0])
                self.move_to_cpu()
                self._benchmark_rtf = 8.0  # Estimate for CPU
                print(f"[ModelPool] GPU failed, moved to CPU. Estimated RTF: {self._benchmark_rtf:.2f}x")
            else:
                print(f"[ModelPool] Benchmark failed: {e}")
                self._benchmark_rtf = HARDWARE.estimated_rtf
        except Exception as e:
            print(f"[ModelPool] Benchmark failed: {e}")
            self._benchmark_rtf = HARDWARE.estimated_rtf

    def move_to_cpu(self):
        """Move all models to CPU (called after GPU failure)."""
        print("[ModelPool] Moving all models to CPU...")
        self.device = "cpu"
        for model in self.models:
            model.to("cpu")

    def acquire(self) -> tuple:
        idx = self.available.get()
        self.locks[idx].acquire()
        return idx, self.models[idx]

    def release(self, idx: int):
        self.locks[idx].release()
        self.available.put(idx)

    @property
    def is_initialized(self) -> bool:
        return self._initialized

    @property
    def rtf(self) -> float:
        """Real-time factor from benchmark."""
        return self._benchmark_rtf or HARDWARE.estimated_rtf

model_pool = ModelPool(MODEL_NAME, DEVICE, HARDWARE.optimal_model_instances)

# =============================================
# Smart LRU Cache with Persistence
# =============================================

class PersistentLRUCache:
    """LRU cache with disk persistence."""

    def __init__(self, max_size_gb: float = 10.0):
        self.max_size_bytes = int(max_size_gb * 1024**3)
        self.index: OrderedDict[str, dict] = OrderedDict()
        self.lock = threading.Lock()
        self._load_index()

    def _load_index(self):
        """Load cache index from disk."""
        if CACHE_INDEX_PATH.exists():
            try:
                with open(CACHE_INDEX_PATH, 'r') as f:
                    data = json.load(f)
                    self.index = OrderedDict(data.get('entries', []))
                print(f"[Cache] Loaded {len(self.index)} cached tracks")
            except:
                self.index = OrderedDict()

    def _save_index(self):
        """Save cache index to disk."""
        try:
            with open(CACHE_INDEX_PATH, 'w') as f:
                json.dump({'entries': list(self.index.items())}, f)
        except Exception as e:
            print(f"[Cache] Failed to save index: {e}")

    def _get_total_size(self) -> int:
        """Calculate total cache size."""
        total = 0
        for info in self.index.values():
            total += info.get('size', 0)
        return total

    def _evict_if_needed(self, new_size: int):
        """Evict oldest entries if cache is too large."""
        while self._get_total_size() + new_size > self.max_size_bytes and self.index:
            oldest_key = next(iter(self.index))
            oldest_info = self.index.pop(oldest_key)
            # Delete file
            try:
                Path(oldest_info['path']).unlink(missing_ok=True)
                print(f"[Cache] Evicted: {oldest_key}")
            except:
                pass

    def get(self, track_id: str) -> Optional[Path]:
        """Get cached file path, updating LRU order."""
        with self.lock:
            if track_id in self.index:
                # Move to end (most recently used)
                self.index.move_to_end(track_id)
                path = Path(self.index[track_id]['path'])
                if path.exists():
                    return path
                else:
                    # File missing, remove from index
                    del self.index[track_id]
            return None

    def put(self, track_id: str, file_path: Path):
        """Add file to cache."""
        with self.lock:
            size = file_path.stat().st_size
            self._evict_if_needed(size)

            self.index[track_id] = {
                'path': str(file_path),
                'size': size,
                'created': time.time()
            }
            self.index.move_to_end(track_id)
            self._save_index()

    def has(self, track_id: str) -> bool:
        return track_id in self.index and Path(self.index[track_id]['path']).exists()

cache = PersistentLRUCache(max_size_gb=10.0)

# =============================================
# Predictive Processing Queue
# =============================================

class PredictiveProcessor:
    """Background processor for upcoming tracks."""

    def __init__(self):
        self.queue: queue.Queue = queue.Queue()
        self.processing: set = set()
        self.worker_thread: Optional[threading.Thread] = None
        self._stop = False

    def start(self):
        if self.worker_thread and self.worker_thread.is_alive():
            return
        self._stop = False
        self.worker_thread = threading.Thread(target=self._worker, daemon=True)
        self.worker_thread.start()
        print("[Predictive] Background processor started")

    def stop(self):
        self._stop = True
        self.queue.put(None)  # Unblock worker

    def enqueue(self, track_id: str, url: str, priority: int = 5):
        """Add track to prediction queue. Lower priority = process first."""
        if track_id in self.processing or cache.has(track_id):
            return
        self.queue.put((priority, track_id, url))

    def _worker(self):
        while not self._stop:
            try:
                item = self.queue.get(timeout=1)
                if item is None:
                    continue

                priority, track_id, url = item

                if track_id in self.processing or cache.has(track_id):
                    continue

                self.processing.add(track_id)
                print(f"[Predictive] Processing: {track_id}")

                try:
                    # Process full track in background
                    process_full_track_sync(track_id, url, emit_progress=False)
                except Exception as e:
                    print(f"[Predictive] Error: {e}")
                finally:
                    self.processing.discard(track_id)

            except queue.Empty:
                continue
            except Exception as e:
                print(f"[Predictive] Worker error: {e}")

predictive_processor = PredictiveProcessor()

# =============================================
# Audio Processing Functions
# =============================================

def load_audio_from_url(url: str, max_seconds: Optional[float] = None) -> tuple:
    """Load audio from URL using FFmpeg streaming."""
    output_path = TEMP_DIR / f"dl_{hashlib.md5(url.encode()).hexdigest()[:8]}.wav"

    args = [
        "ffmpeg", "-y",
        "-user_agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "-i", url,
    ]

    if max_seconds:
        args.extend(["-t", str(max_seconds)])

    args.extend([
        "-ar", "44100", "-ac", "2", "-f", "wav",
        str(output_path)
    ])

    result = subprocess.run(args, capture_output=True, timeout=120)

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg failed: {result.stderr.decode()[:200]}")

    # Load the WAV
    data, sr = sf.read(str(output_path))
    output_path.unlink(missing_ok=True)

    if len(data.shape) == 1:
        data = data.reshape(1, -1)
    else:
        data = data.T

    waveform = torch.from_numpy(data.astype(np.float32))

    # Ensure stereo
    if waveform.shape[0] == 1:
        waveform = waveform.repeat(2, 1)
    elif waveform.shape[0] > 2:
        waveform = waveform[:2]

    return waveform, sr

def process_chunk(waveform: torch.Tensor, model_idx: int, model: torch.nn.Module) -> torch.Tensor:
    """Process a single chunk through Demucs with GPU fallback."""
    global DEVICE

    if waveform.dim() == 2:
        waveform = waveform.unsqueeze(0)

    # Try GPU first, fallback to CPU on CUDA errors
    device_to_use = DEVICE

    try:
        waveform = waveform.to(device_to_use)
        with torch.no_grad():
            sources = apply_model(model, waveform, device=device_to_use)
    except RuntimeError as e:
        error_str = str(e)
        # Check for CUDA-specific errors
        if "CUDA" in error_str or "cuda" in error_str or "no kernel image" in error_str:
            trigger_gpu_fallback(error_str.split('\n')[0])  # Log first line only

            # Move model to CPU and retry
            model.to("cpu")
            waveform = waveform.to("cpu")
            device_to_use = "cpu"

            log(f"[Demucs] Retrying chunk on CPU...")
            with torch.no_grad():
                sources = apply_model(model, waveform, device="cpu")
        else:
            raise  # Re-raise non-CUDA errors

    # htdemucs: drums, bass, other, vocals
    instrumental = sources[0, 0] + sources[0, 1] + sources[0, 2]
    return instrumental.cpu()

def encode_chunk_to_mp3(waveform: torch.Tensor, sample_rate: int) -> bytes:
    """Encode waveform chunk to MP3 bytes."""
    timestamp = time.time_ns()
    temp_wav = TEMP_DIR / f"chunk_{timestamp}.wav"
    temp_mp3 = TEMP_DIR / f"chunk_{timestamp}.mp3"

    try:
        # Log waveform info
        duration = waveform.shape[-1] / sample_rate
        print(f"[Encode] Waveform shape: {waveform.shape}, duration: {duration:.2f}s")

        sf.write(str(temp_wav), waveform.numpy().T, sample_rate)
        wav_size = temp_wav.stat().st_size
        print(f"[Encode] WAV size: {wav_size} bytes")

        result = subprocess.run([
            "ffmpeg", "-y", "-i", str(temp_wav),
            "-codec:a", "libmp3lame", "-b:a", "192k",
            str(temp_mp3)
        ], capture_output=True, check=True)

        mp3_size = temp_mp3.stat().st_size
        print(f"[Encode] MP3 size: {mp3_size} bytes")

        if mp3_size < 1000:
            print(f"[Encode] WARNING: MP3 file is very small! FFmpeg stderr: {result.stderr.decode()}")

        return temp_mp3.read_bytes()
    except Exception as e:
        print(f"[Encode] ERROR: {e}")
        raise
    finally:
        temp_wav.unlink(missing_ok=True)
        temp_mp3.unlink(missing_ok=True)

# =============================================
# Streaming Chunk Generator
# =============================================

def generate_streaming_chunks(
    track_id: str,
    waveform: torch.Tensor,
    chunk_seconds: float = None,
    overlap_seconds: float = 0.5,
    on_progress: Optional[Callable[[float, str], None]] = None
) -> Generator[bytes, None, bytes]:
    """
    Generator that yields MP3 chunks as they're processed.
    Returns the full combined audio at the end.
    """
    if chunk_seconds is None:
        # Use effective chunk seconds based on quality mode (may change if GPU failed)
        chunk_seconds = 2.5 if GPU_FAILED else EFFECTIVE_CHUNK_SECONDS

    chunk_samples = int(chunk_seconds * SAMPLE_RATE)
    overlap_samples = int(overlap_seconds * SAMPLE_RATE)
    hop_samples = chunk_samples - overlap_samples

    total_samples = waveform.shape[-1]
    total_duration = total_samples / SAMPLE_RATE

    # Calculate number of chunks
    num_chunks = max(1, (total_samples - overlap_samples) // hop_samples)
    if (total_samples - overlap_samples) % hop_samples > 0:
        num_chunks += 1

    log(f"[Stream] Processing {num_chunks} chunks ({chunk_seconds}s each, overlap: {overlap_seconds}s)")

    # Crossfade windows
    fade_in = torch.linspace(0, 1, overlap_samples)
    fade_out = torch.linspace(1, 0, overlap_samples)

    # Output accumulator for full track
    output = torch.zeros(2, total_samples)
    weight = torch.zeros(1, total_samples)

    safe_track_id = sanitize_filename(track_id)
    chunks_dir = CHUNKS_DIR / safe_track_id
    chunks_dir.mkdir(exist_ok=True)

    for chunk_idx in range(num_chunks):
        start_idx = chunk_idx * hop_samples
        end_idx = min(start_idx + chunk_samples, total_samples)
        chunk_len = end_idx - start_idx

        # Extract chunk
        chunk = waveform[:, start_idx:end_idx]

        # Pad if needed
        if chunk.shape[-1] < chunk_samples:
            chunk = torch.nn.functional.pad(chunk, (0, chunk_samples - chunk.shape[-1]))

        # Process
        model_idx, model = model_pool.acquire()
        try:
            processed = process_chunk(chunk, model_idx, model)
            # Trim to actual length
            processed = processed[:, :chunk_len]
        finally:
            model_pool.release(model_idx)

        # Apply crossfade weights
        chunk_weight = torch.ones(1, chunk_len)

        if start_idx > 0 and chunk_len > overlap_samples:
            chunk_weight[0, :overlap_samples] = fade_in[:min(overlap_samples, chunk_len)]

        if end_idx < total_samples and chunk_len > overlap_samples:
            fade_start = max(0, chunk_len - overlap_samples)
            chunk_weight[0, fade_start:] = fade_out[:chunk_len - fade_start]

        # Accumulate
        output[:, start_idx:end_idx] += processed * chunk_weight
        weight[:, start_idx:end_idx] += chunk_weight

        # After each chunk, yield the accumulated audio so far (progressive streaming)
        # This gives the client progressively longer audio as processing continues
        current_end = end_idx

        # Normalize the accumulated output up to current position
        current_weight = weight[:, :current_end].clamp(min=1e-8)
        current_output = output[:, :current_end] / current_weight

        # Encode current accumulated audio
        mp3_bytes = encode_chunk_to_mp3(current_output, SAMPLE_RATE)

        # Calculate progress and ETA
        progress_pct = (chunk_idx + 1) / num_chunks * 100
        remaining = num_chunks - chunk_idx - 1
        eta = remaining * chunk_seconds * model_pool.rtf

        if chunk_idx == 0:
            stage = f"Chunk 1/{num_chunks} - ETA: {eta:.0f}s"
        else:
            stage = f"Chunk {chunk_idx+1}/{num_chunks} - ETA: {eta:.0f}s"

        if on_progress:
            on_progress(progress_pct, stage)

        # Yield progressive audio (first chunk, then accumulated chunks)
        yield mp3_bytes
        log(f"[Stream] Yielded chunk {chunk_idx+1}/{num_chunks} - duration: {current_end/SAMPLE_RATE:.1f}s, size: {len(mp3_bytes)/1024:.1f} KB")

    # Normalize and return full track
    weight = weight.clamp(min=1e-8)
    output = output / weight

    # Encode full track
    full_mp3 = encode_chunk_to_mp3(output, SAMPLE_RATE)

    # Cache it (use sanitized filename for paths)
    safe_track_id = sanitize_filename(track_id)
    cache_path = CACHE_DIR / f"{safe_track_id}.mp3"
    cache_path.write_bytes(full_mp3)
    cache.put(track_id, cache_path)  # Keep original track_id as cache key

    # Also save to serve directory
    serve_path = SERVE_DIR / f"{safe_track_id}.mp3"
    serve_path.write_bytes(full_mp3)

    return full_mp3

# =============================================
# Synchronous Full Track Processing
# =============================================

def process_full_track_sync(track_id: str, url: str, emit_progress: bool = True) -> bytes:
    """Process full track synchronously. Used by predictive processor."""
    try:
        if emit_progress:
            socketio.emit('progress', {'track_id': track_id, 'progress': 5, 'stage': 'Downloading...'})

        waveform, sr = load_audio_from_url(url)

        if emit_progress:
            socketio.emit('progress', {'track_id': track_id, 'progress': 15, 'stage': 'Processing...'})

        def progress_cb(progress: float, stage: str):
            if emit_progress:
                scaled = 15 + (progress / 100) * 80
                socketio.emit('progress', {'track_id': track_id, 'progress': scaled, 'stage': stage})

        # Process all chunks
        full_audio = None
        for chunk_data in generate_streaming_chunks(track_id, waveform, on_progress=progress_cb):
            full_audio = chunk_data  # Last yield is full audio

        if emit_progress:
            socketio.emit('progress', {'track_id': track_id, 'progress': 100, 'stage': 'Complete'})
            socketio.emit('complete', {'track_id': track_id, 'url': f'/serve/{track_id}'})

        return full_audio

    except Exception as e:
        if emit_progress:
            socketio.emit('error', {'track_id': track_id, 'error': str(e)})
        raise

# =============================================
# Active Streaming Sessions
# =============================================

# Active processing sessions - tracks being processed right now
active_sessions: Dict[str, dict] = {}
active_sessions_lock = threading.Lock()

# =============================================
# HTTP Endpoints
# =============================================

@app.route("/health", methods=["GET"])
def health():
    """Health check with hardware info."""
    return jsonify({
        "status": "ok",
        "device": DEVICE,
        "device_name": HARDWARE.device_name,
        "model": MODEL_NAME,
        "model_loaded": model_pool.is_initialized,
        "model_instances": HARDWARE.optimal_model_instances,
        "chunk_seconds": 2.5 if GPU_FAILED else EFFECTIVE_CHUNK_SECONDS,
        "estimated_rtf": model_pool.rtf,
        "vram_gb": HARDWARE.vram_gb,
        "gpu_available": DEVICE in ("cuda", "mps") and not GPU_FAILED,
        "cuda_available": torch.cuda.is_available() and not GPU_FAILED,
        "gpu_failed": GPU_FAILED,
        "quality_mode": current_quality_mode,
        "effective_mode": "fast (CPU fallback)" if GPU_FAILED else EFFECTIVE_MODE_NAME,
        "streaming_enabled": True,
        "predictive_enabled": True,
        "cache_entries": len(cache.index),
        "available_modes": list(QUALITY_MODES.keys())
    })

@app.route("/settings", methods=["GET"])
def get_settings():
    """Get current server settings."""
    return jsonify({
        "quality_mode": current_quality_mode,
        "effective_mode": "fast (CPU fallback)" if GPU_FAILED else EFFECTIVE_MODE_NAME,
        "model": MODEL_NAME,
        "chunk_seconds": 2.5 if GPU_FAILED else EFFECTIVE_CHUNK_SECONDS,
        "device": DEVICE,
        "cuda_available": torch.cuda.is_available() and not GPU_FAILED,
        "gpu_failed": GPU_FAILED,
        "available_modes": {
            name: {
                "description": mode["description"],
                "chunk_seconds": mode["chunk_seconds"] or EFFECTIVE_CHUNK_SECONDS
            }
            for name, mode in QUALITY_MODES.items()
        }
    })

@app.route("/serve/<track_id>", methods=["GET"])
def serve_audio(track_id: str):
    """Serve cached audio file."""
    print(f"[Serve] Request for: {track_id}")

    # Sanitize for filesystem access
    safe_track_id = sanitize_filename(track_id)

    # Check cache (uses original track_id as key)
    cached_path = cache.get(track_id)
    if cached_path:
        print(f"[Serve] Found in cache: {cached_path} ({cached_path.stat().st_size} bytes)")
        return send_file(cached_path, mimetype="audio/mpeg")

    # Check serve directory (uses sanitized filename)
    serve_path = SERVE_DIR / f"{safe_track_id}.mp3"
    if serve_path.exists():
        size = serve_path.stat().st_size
        print(f"[Serve] Found in serve dir: {serve_path} ({size} bytes)")
        return send_file(serve_path, mimetype="audio/mpeg")

    # Check for streaming/progressive chunk (uses sanitized filename)
    stream_chunk = SERVE_DIR / f"{safe_track_id}_stream.mp3"
    if stream_chunk.exists():
        size = stream_chunk.stat().st_size
        print(f"[Serve] Found stream chunk: {stream_chunk} ({size} bytes)")
        return send_file(stream_chunk, mimetype="audio/mpeg")

    # Check for legacy first chunk (uses sanitized filename)
    first_chunk = SERVE_DIR / f"{safe_track_id}_first.mp3"
    if first_chunk.exists():
        size = first_chunk.stat().st_size
        print(f"[Serve] Found first chunk: {first_chunk} ({size} bytes)")
        return send_file(first_chunk, mimetype="audio/mpeg")

    print(f"[Serve] Not found: {track_id} (checked: {serve_path}, {first_chunk})")
    return jsonify({"error": "Not found"}), 404

@app.route("/stream/start", methods=["POST"])
def stream_start():
    """
    Start streaming processing. Returns first chunk ASAP for instant playback.

    Body: {"url": "...", "track_id": "...", "predict_next": ["track2", "track3"]}

    Returns:
    {
        "success": true,
        "first_chunk_url": "/serve/<track_id>_first",
        "full_track_url": "/serve/<track_id>",
        "is_cached": false,
        "estimated_total_seconds": 45,
        "hardware": {...}
    }
    """
    data = request.get_json()
    if not data or "url" not in data or "track_id" not in data:
        return jsonify({"success": False, "error": "Missing url or track_id"}), 400

    url = data["url"]
    track_id = data["track_id"]
    predict_next = data.get("predict_next", [])

    # Sanitize track_id for filesystem paths (Windows doesn't allow : in filenames)
    safe_track_id = sanitize_filename(track_id)

    # Check cache first
    cached_path = cache.get(track_id)
    if cached_path:
        print(f"[Stream] Cache hit: {track_id}")

        # Copy to serve if needed (use sanitized filename)
        serve_path = SERVE_DIR / f"{safe_track_id}.mp3"
        if not serve_path.exists():
            serve_path.write_bytes(cached_path.read_bytes())

        # Queue predictive processing for next tracks
        for i, (next_id, next_url) in enumerate(predict_next[:3]):
            predictive_processor.enqueue(next_id, next_url, priority=i)

        return jsonify({
            "success": True,
            "first_chunk_url": f"/serve/{track_id}",
            "full_track_url": f"/serve/{track_id}",
            "is_cached": True,
            "is_complete": True,
            "estimated_total_seconds": 0,
            "hardware": {
                "device": HARDWARE.device_name,
                "rtf": model_pool.rtf
            }
        })

    # Start streaming processing in background
    def process_async():
        log(f"[Stream] Thread started for: {track_id}, url: {url[:80]}...")

        try:
            # Update session status (session already created before thread started)
            with active_sessions_lock:
                if track_id in active_sessions:
                    active_sessions[track_id]['status'] = 'downloading'
                    active_sessions[track_id]['progress'] = 5
                    active_sessions[track_id]['stage'] = 'Downloading...'

            log(f"[Stream] Starting download: {track_id}")
            socketio.emit('progress', {'track_id': track_id, 'progress': 5, 'stage': 'Downloading...'})

            waveform, sr = load_audio_from_url(url)
            total_duration = waveform.shape[-1] / SAMPLE_RATE

            with active_sessions_lock:
                if track_id in active_sessions:
                    active_sessions[track_id]['status'] = 'processing'
                    active_sessions[track_id]['progress'] = 10
                    active_sessions[track_id]['stage'] = 'Processing first chunk...'

            socketio.emit('progress', {'track_id': track_id, 'progress': 10, 'stage': 'Processing first chunk...'})

            # Generate chunks - each iteration yields progressively longer audio
            chunk_count = 0
            full_audio = None

            def progress_cb(progress: float, stage: str):
                scaled = 10 + (progress / 100) * 85
                with active_sessions_lock:
                    if track_id in active_sessions:
                        active_sessions[track_id]['progress'] = scaled
                        active_sessions[track_id]['stage'] = stage
                socketio.emit('progress', {'track_id': track_id, 'progress': scaled, 'stage': stage})

            # Sanitize track_id for filesystem paths
            safe_track_id = sanitize_filename(track_id)

            # Path for progressive audio (same file, gets longer each chunk)
            progressive_path = SERVE_DIR / f"{safe_track_id}_stream.mp3"

            # CRITICAL: Delete any stale stream file before processing
            # This prevents the client from loading old/incomplete audio
            if progressive_path.exists():
                log(f"[Stream] Deleting stale stream file: {progressive_path}")
                progressive_path.unlink()

            for chunk_data in generate_streaming_chunks(track_id, waveform, on_progress=progress_cb):
                chunk_count += 1

                # Save progressive audio (overwrites with longer version each time)
                progressive_path.write_bytes(chunk_data)
                log(f"[Stream] Saved progressive chunk {chunk_count}: {len(chunk_data)} bytes ({len(chunk_data)/1024:.1f} KB)")

                if chunk_count == 1:
                    # First chunk - notify client for instant playback
                    with active_sessions_lock:
                        if track_id in active_sessions:
                            active_sessions[track_id]['first_chunk_ready'] = True
                            active_sessions[track_id]['first_chunk_url'] = f'/serve/{track_id}_stream'

                    # Notify client first chunk is ready via WebSocket
                    log(f"[Stream] === FIRST CHUNK READY === Emitting 'first_chunk' event for: {track_id}")
                    socketio.emit('first_chunk', {
                        'track_id': track_id,
                        'url': f'/serve/{track_id}_stream'
                    })
                    log(f"[Stream] first_chunk event emitted successfully")
                else:
                    # Subsequent chunks - notify client that more audio is available
                    log(f"[Stream] Emitting 'chunk_updated' event for chunk {chunk_count}")
                    socketio.emit('chunk_updated', {
                        'track_id': track_id,
                        'url': f'/serve/{track_id}_stream',
                        'chunk': chunk_count
                    })

                full_audio = chunk_data

            # Full track complete
            log(f"[Stream] === PROCESSING COMPLETE === for: {track_id}")
            socketio.emit('progress', {'track_id': track_id, 'progress': 100, 'stage': 'Complete'})
            socketio.emit('complete', {
                'track_id': track_id,
                'url': f'/serve/{track_id}',
                'is_complete': True
            })

        except Exception as e:
            import traceback
            log(f"[Stream] ERROR in processing: {e}")
            traceback.print_exc()
            sys.stdout.flush()
            sys.stderr.flush()
            socketio.emit('error', {'track_id': track_id, 'error': str(e)})
        finally:
            # Clean up session after a delay (allow client to fetch final status)
            def cleanup():
                time.sleep(5)
                with active_sessions_lock:
                    active_sessions.pop(track_id, None)
            threading.Thread(target=cleanup, daemon=True).start()

    # Add to active_sessions BEFORE starting thread (prevents 404 race condition)
    with active_sessions_lock:
        active_sessions[track_id] = {
            'status': 'starting',
            'progress': 0,
            'stage': 'Starting...',
            'started': time.time()
        }

    # Start processing thread
    print(f"[Stream] Creating thread for: {track_id}")
    thread = threading.Thread(target=process_async, daemon=True)
    thread.start()
    print(f"[Stream] Thread started, is_alive: {thread.is_alive()}")

    # Queue predictive processing
    for i, next_item in enumerate(predict_next[:3]):
        if isinstance(next_item, (list, tuple)) and len(next_item) >= 2:
            predictive_processor.enqueue(next_item[0], next_item[1], priority=i + 1)

    # Estimate time
    # We don't know duration yet, but estimate based on typical track (3 min)
    estimated_seconds = 180 * model_pool.rtf  # 3 min track

    return jsonify({
        "success": True,
        "first_chunk_url": f"/serve/{track_id}_first",  # Will be available soon
        "full_track_url": f"/serve/{track_id}",
        "is_cached": False,
        "is_complete": False,
        "estimated_total_seconds": estimated_seconds,
        "hardware": {
            "device": HARDWARE.device_name,
            "rtf": model_pool.rtf
        }
    })

@app.route("/stream/sse/<track_id>", methods=["GET"])
def stream_sse(track_id: str):
    """
    Server-Sent Events endpoint for real-time chunk streaming.
    Client connects here to receive chunks as they're processed.
    """
    def generate():
        # Check if we have a session for this track
        session = streaming_sessions.get(track_id)
        if not session:
            yield f"data: {json.dumps({'error': 'No active session'})}\n\n"
            return

        chunk_queue = session.get('chunks', queue.Queue())

        while True:
            try:
                chunk_event = chunk_queue.get(timeout=60)
                if chunk_event is None:
                    break
                yield f"data: {json.dumps(chunk_event)}\n\n"
            except queue.Empty:
                yield f"data: {json.dumps({'keepalive': True})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )

@app.route("/stream/status/<track_id>", methods=["GET"])
def stream_status(track_id: str):
    """Check processing status."""
    # Sanitize for filesystem checks
    safe_track_id = sanitize_filename(track_id)

    # Check if complete (cache)
    cached = cache.get(track_id)
    if cached:
        return jsonify({
            "status": "complete",
            "progress": 100,
            "url": f"/serve/{track_id}"
        })

    # Check serve directory (full track) - use sanitized filename
    if (SERVE_DIR / f"{safe_track_id}.mp3").exists():
        return jsonify({
            "status": "complete",
            "progress": 100,
            "url": f"/serve/{track_id}"
        })

    # Check if streaming chunk file exists - use sanitized filename
    stream_chunk_path = SERVE_DIR / f"{safe_track_id}_stream.mp3"
    if stream_chunk_path.exists():
        return jsonify({
            "status": "processing",
            "progress": 20,
            "first_chunk_url": f"/serve/{track_id}_stream"
        })

    # Check for legacy first chunk file - use sanitized filename
    first_chunk_path = SERVE_DIR / f"{safe_track_id}_first.mp3"
    if first_chunk_path.exists():
        return jsonify({
            "status": "processing",
            "progress": 20,
            "first_chunk_url": f"/serve/{track_id}_first"
        })

    # Check active sessions (currently processing)
    with active_sessions_lock:
        if track_id in active_sessions:
            session = active_sessions[track_id]
            response = {
                "status": "processing",
                "progress": session.get('progress', 10),
                "stage": session.get('stage', 'Processing...')
            }
            # Include first chunk URL if ready
            if session.get('first_chunk_ready'):
                response['first_chunk_url'] = session.get('first_chunk_url')
            return jsonify(response)

    # Check if in predictive queue
    if track_id in predictive_processor.processing:
        return jsonify({
            "status": "processing",
            "progress": 10,
            "stage": "In queue"
        })

    return jsonify({"status": "not_found"}), 404

@app.route("/predict", methods=["POST"])
def predict():
    """
    Add tracks to predictive processing queue.

    Body: {"tracks": [{"id": "...", "url": "..."}, ...]}
    """
    data = request.get_json()
    tracks = data.get("tracks", [])

    for i, track in enumerate(tracks[:5]):  # Max 5 predictive
        track_id = track.get("id")
        url = track.get("url")
        if track_id and url:
            predictive_processor.enqueue(track_id, url, priority=i)

    return jsonify({"success": True, "queued": len(tracks[:5])})

@app.route("/clear-cache", methods=["POST"])
def clear_cache():
    """Clear all caches."""
    import shutil

    with cache.lock:
        cache.index.clear()
        cache._save_index()

    shutil.rmtree(CACHE_DIR, ignore_errors=True)
    shutil.rmtree(SERVE_DIR, ignore_errors=True)
    shutil.rmtree(CHUNKS_DIR, ignore_errors=True)

    CACHE_DIR.mkdir(exist_ok=True)
    SERVE_DIR.mkdir(exist_ok=True)
    CHUNKS_DIR.mkdir(exist_ok=True)

    return jsonify({"status": "cleared"})

# Legacy endpoints for backwards compatibility
@app.route("/separate", methods=["POST"])
def separate():
    """Legacy endpoint."""
    content_type = request.content_type
    if "audio" in request.files:
        audio_bytes = request.files["audio"].read()
        content_type = request.files["audio"].content_type
    else:
        audio_bytes = request.get_data()

    if not audio_bytes:
        return jsonify({"error": "No audio"}), 400

    cache_key = hashlib.md5(audio_bytes).hexdigest()
    cache_path = CACHE_DIR / f"{cache_key}.mp3"

    if cache_path.exists():
        return send_file(cache_path, mimetype="audio/mpeg")

    # Save to temp, process
    temp_path = TEMP_DIR / f"input_{cache_key}.audio"
    temp_path.write_bytes(audio_bytes)

    try:
        waveform, sr = load_audio_from_url(f"file://{temp_path}")

        full_audio = None
        for chunk in generate_streaming_chunks(cache_key, waveform):
            full_audio = chunk

        return send_file(io.BytesIO(full_audio), mimetype="audio/mpeg")
    finally:
        temp_path.unlink(missing_ok=True)

@app.route("/separate/url", methods=["POST"])
def separate_url():
    """Legacy endpoint."""
    data = request.get_json()
    if not data or "url" not in data:
        return jsonify({"error": "No URL"}), 400

    url = data["url"]
    cache_key = hashlib.md5(url.encode()).hexdigest()

    cached = cache.get(cache_key)
    if cached:
        return send_file(cached, mimetype="audio/mpeg")

    waveform, sr = load_audio_from_url(url)

    full_audio = None
    for chunk in generate_streaming_chunks(cache_key, waveform):
        full_audio = chunk

    return send_file(io.BytesIO(full_audio), mimetype="audio/mpeg")

# =============================================
# WebSocket Events
# =============================================

@socketio.on('connect')
def handle_connect():
    print(f"[WS] Client connected: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    print(f"[WS] Client disconnected: {request.sid}")

@socketio.on('subscribe')
def handle_subscribe(data):
    track_id = data.get('track_id')
    if track_id:
        print(f"[WS] Subscribed to: {track_id}")

# =============================================
# Main
# =============================================

if __name__ == "__main__":
    # Initialize model pool
    model_pool.initialize()

    # Start predictive processor
    predictive_processor.start()

    port = int(os.environ.get("PORT", 8765))
    print(f"\n[Demucs] Server ready on port {port}")
    print(f"[Demucs] First chunk latency: ~{HARDWARE.optimal_chunk_seconds * model_pool.rtf:.1f}s")
    print(f"[Demucs] Streaming: Enabled")
    print(f"[Demucs] Predictive: Enabled")
    print(f"[Demucs] Cache: {len(cache.index)} tracks\n")

    socketio.run(app, host="0.0.0.0", port=port, debug=False, allow_unsafe_werkzeug=True)
