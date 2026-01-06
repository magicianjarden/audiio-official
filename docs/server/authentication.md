# Authentication

Audiio uses public-key cryptography (NaCl/TweetNaCl) for secure device authentication.

## How It Works

1. **Server Identity**: Server generates an ED25519 keypair on first run
2. **Device Pairing**: Client scans QR code containing server's public key
3. **Key Exchange**: Client sends its public key to server
4. **Session Token**: Server issues a session token for API access
5. **Challenge-Response**: Token can be refreshed via cryptographic challenge

## Pairing Flow

### Step 1: Get Pairing Token

```bash
curl -X POST http://localhost:8484/api/auth/pairing-token
```

Response:
```json
{
  "token": "SWIFT-EAGLE-42",
  "qrCode": "data:image/png;base64,...",
  "expiresAt": "2024-01-15T12:00:00Z"
}
```

### Step 2: Client Submits Pairing Request

```bash
curl -X POST http://localhost:8484/api/auth/pair \
  -H "Content-Type: application/json" \
  -d '{
    "pairingToken": "SWIFT-EAGLE-42",
    "deviceId": "unique-device-id",
    "deviceName": "My Phone",
    "publicKey": "base64-encoded-public-key"
  }'
```

Response:
```json
{
  "sessionToken": "eyJ...",
  "expiresAt": "2024-01-16T12:00:00Z",
  "serverPublicKey": "base64-encoded-server-public-key"
}
```

### Step 3: Use Session Token

Include in all API requests:

```bash
curl http://localhost:8484/api/library/likes \
  -H "Authorization: Bearer eyJ..."
```

## Challenge-Response (Token Refresh)

When session expires, refresh via challenge:

```bash
# Get challenge
curl -X POST http://localhost:8484/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "unique-device-id"}'

# Response: {"challenge": "random-bytes-base64"}

# Sign challenge with device private key and verify
curl -X POST http://localhost:8484/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "unique-device-id",
    "signature": "signed-challenge-base64"
  }'

# Response: {"sessionToken": "new-token", "expiresAt": "..."}
```

## Device Management

### List Trusted Devices

```bash
curl http://localhost:8484/api/auth/devices \
  -H "Authorization: Bearer eyJ..."
```

### Revoke Device

```bash
curl -X DELETE http://localhost:8484/api/auth/devices/device-id \
  -H "Authorization: Bearer eyJ..."
```

## Disabling Authentication

For local/trusted networks, device pairing can be disabled:

```yaml
# config.yml
auth:
  requirePairing: false
```

Or:
```bash
AUDIIO_REQUIRE_PAIRING=false
```

When disabled, all API endpoints are publicly accessible.

## Security Considerations

- **Session tokens** are JWTs signed with the server's private key
- **Device public keys** are stored in the database for verification
- **Pairing tokens** expire after 5 minutes
- **All traffic** should use HTTPS in production (use a reverse proxy)

## Reverse Proxy Setup (HTTPS)

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name audiio.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8484;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Caddy

```
audiio.yourdomain.com {
    reverse_proxy localhost:8484
}
```

## Next Steps

- [API Reference](./api-reference.md) - All available endpoints
