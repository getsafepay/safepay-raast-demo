# Safepay RAAST RTP / QR / Payout Demo

A local demo UI with a Node.js (Express) backend to test **RAAST RTP**,
**RAAST QR**, and **RAAST Payout** flows using Safepay's RAAST APIs.

This project supports:

-   **RTP**: `RTP_NOW`, `RTP_LATER`
-   **QR**: `DYNAMIC`, `STATIC`
-   **PAYOUT**
-   **Bulk Attempts** via CSV / TSV uploads
-   **QR preview** rendering + downloadable full-size QR (bulk)

------------------------------------------------------------------------

## Prerequisites

    Node.js 18+
    npm
    Valid Safepay RAAST Aggregator ID and Secret Key

------------------------------------------------------------------------

## Setup

### 1) Install dependencies

``` bash
npm install
```

### 2) Environment variables

``` bash
cp .env.example .env
```

Edit `.env` and set your credentials:

``` bash
RAAST_AGGREGATOR_ID=agg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RAAST_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
```

### 3) Run the server

``` bash
npm start
```

Open in browser:

    http://localhost:3003/raast

Health check:

    http://localhost:3003/health

------------------------------------------------------------------------

# API Endpoints

------------------------------------------------------------------------

## Create RTP

``` http
POST /api/rtp
```

``` json
{
  "aggregator_merchant_identifier": "am_xxx",
  "amount": 2000,
  "type": "RTP_NOW",
  "order_id": "order-001",
  "request_id": "uuid-v4",
  "debitor_type": "IBAN",
  "debitor_value": "PK10000000000000"
}
```

Supported `debitor_type` values:

    IBAN
    RAAST_ID
    VAULT_TOKEN

------------------------------------------------------------------------

## Create QR

``` http
POST /api/qr
```

### DYNAMIC QR

``` json
{
  "aggregator_merchant_identifier": "am_xxx",
  "amount": 2000,
  "order_id": "order-qr-001",
  "request_id": "uuid-v4",
  "qr_type": "DYNAMIC"
}
```

### STATIC QR

``` json
{
  "aggregator_merchant_identifier": "am_xxx",
  "order_id": "order-qr-002",
  "request_id": "uuid-v4",
  "qr_type": "STATIC"
}
```

-   `amount` is required only for `DYNAMIC`
-   Response includes QR payload (`code`)
-   UI renders the QR visually

------------------------------------------------------------------------

## Create PAYOUT

``` http
POST /api/payout
```

``` json
{
  "request_id": "uuid-v4",
  "amount": "200",
  "creditor_iban": "PK39HABB0007867916713101",
  "type": "PAYOUT"
}
```

------------------------------------------------------------------------

# UI Overview

## RTP Tab

-   Form on the right
-   JSON response shown on the left
-   Status indicator

## QR Tab

-   Form on the right
-   QR preview rendered on the left
-   Supports both `DYNAMIC` and `STATIC`
-   Press **Generate** to regenerate

## Payout Tab

-   Simple payout form
-   JSON response displayed on the left

## Bulk Attempts Tab

-   Upload + run controls on the right
-   Results table rendered on the left
-   Each row shows:
    -   Mode/Type
    -   HTTP status
    -   Success / failure indicator (✅ / ❌)
    -   QR preview (if QR row)
    -   Downloadable full-size QR (bulk only)

------------------------------------------------------------------------

# Bulk Attempts (CSV / TSV)

The first row is treated as header and skipped.

------------------------------------------------------------------------

## Bulk RTP Format

    merchant, amount, type, debitor_type, debitor_value, order_id, request_id(optional)

Example:

    am_xxx,2000,RTP_NOW,IBAN,PK63HABB0011557948316103,rtp-test-1
    am_xxx,1500,RTP_LATER,RAAST_ID,03001234567,rtp-test-2

------------------------------------------------------------------------

## Bulk QR Format

    merchant, amount, type, order_id, request_id(optional)

Where:

    type = DYNAMIC | STATIC

Example:

    merchant,amount,type,order_id
    am_xxx,2000,DYNAMIC,qr-test-1
    am_xxx,ignored,STATIC,qr-test-2

Rules:

-   If `type = DYNAMIC` → `amount` must be valid
-   If `type = STATIC` → `amount` is ignored
-   Successful rows render preview + downloadable QR

------------------------------------------------------------------------

## Bulk PAYOUT Format

    amount, creditor_iban

Example:

    200,PK39HABB0007867916713101
    500,PK63HABB0011557948316103

-   `request_id` auto-generated per row (UUID v4)

------------------------------------------------------------------------

# Security Notes

-   `.env` excluded via `.gitignore`
-   Secrets never reach frontend
-   Intended for local/demo use only
