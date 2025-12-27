# Demucs Server

AI-powered vocal removal server using Meta's Demucs model for high-quality stem separation.

## Quick Start

1. **Install dependencies:**
```bash
pip install -r requirements.txt
```

2. **Start the server:**
```bash
python server.py
```

The server will start on `http://localhost:8765` by default.

## Endpoints

### Health Check
```
GET /health
```
Returns server status and device info.

### Separate Vocals (URL)
```
POST /separate/url
Content-Type: application/json

{
  "url": "https://example.com/audio.mp3"
}
```
Returns instrumental audio (MP3) with vocals removed.

### Separate Vocals (Upload)
```
POST /separate
Content-Type: multipart/form-data

audio: <audio file>
```
Returns instrumental audio (MP3) with vocals removed.

### Clear Cache
```
POST /clear-cache
```
Clears cached processed stems.

## Configuration

- `PORT` environment variable sets the server port (default: 8765)
- Uses GPU (CUDA) if available, falls back to CPU

## How It Works

1. Audio is received via URL or file upload
2. Demucs v4 (htdemucs) separates audio into 4 stems: drums, bass, other, vocals
3. Instrumental = drums + bass + other (everything except vocals)
4. Result is cached and returned as MP3

## Model Info

- Model: HTDemucs v4 (hybrid transformer)
- Size: ~80MB
- Output: 4 stems (drums, bass, other, vocals)
- Sample rate: 44.1kHz
