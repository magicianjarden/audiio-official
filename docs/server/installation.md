# Server Installation

## Docker (Recommended)

```bash
# Pull and run
docker run -d \
  --name audiio \
  -p 8484:8484 \
  -v audiio-data:/app/data \
  -v /path/to/music:/music:ro \
  ghcr.io/magicianjarden/audiio-server:latest

# Or use docker-compose
cd packages/server
docker-compose up -d
```

### Docker Compose

```yaml
version: '3.8'
services:
  audiio:
    image: ghcr.io/magicianjarden/audiio-server:latest
    ports:
      - "8484:8484"
    volumes:
      - audiio-data:/app/data
      - /path/to/music:/music:ro
    environment:
      - AUDIIO_PORT=8484
      - AUDIIO_LOG_LEVEL=info
    restart: unless-stopped

volumes:
  audiio-data:
```

## Standalone (From Source)

```bash
# Clone repository
git clone https://github.com/magicianjarden/audiio-official.git
cd audiio-official

# Install dependencies
npm install

# Build server
npm run build -w @audiio/server

# Run
npm run start -w @audiio/server
```

## NAS / Home Server

### Synology DSM

1. Install Docker from Package Center
2. Create a `docker-compose.yml` in a shared folder
3. SSH into NAS and run `docker-compose up -d`

### Unraid

1. Go to Apps > Search "audiio" (or add manually)
2. Configure port and volume mappings
3. Start container

### TrueNAS Scale

1. Apps > Launch Docker Image
2. Image: `ghcr.io/magicianjarden/audiio-server:latest`
3. Add port mapping 8484:8484
4. Add host path for music library

## Raspberry Pi

```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and build
git clone https://github.com/magicianjarden/audiio-official.git
cd audiio-official
npm install
npm run build -w @audiio/server

# Run (consider using PM2 or systemd for persistence)
npm run start -w @audiio/server
```

### Systemd Service

```ini
# /etc/systemd/system/audiio.service
[Unit]
Description=Audiio Music Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/audiio-official
ExecStart=/usr/bin/npm run start -w @audiio/server
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable audiio
sudo systemctl start audiio
```

## Cloud Deployment

### Fly.io

```bash
cd packages/server
fly launch
fly deploy
```

### Railway / Render

1. Connect GitHub repository
2. Set build command: `npm install && npm run build -w @audiio/server`
3. Set start command: `npm run start -w @audiio/server`
4. Add environment variables as needed

## Verifying Installation

```bash
# Check server is running
curl http://localhost:8484/api/health

# Should return:
# {"status":"ok","version":"1.0.0"}
```

## Next Steps

- [Configuration](./configuration.md) - Customize server settings
- [Authentication](./authentication.md) - Set up device pairing
