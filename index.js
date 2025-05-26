import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 1. Public: funding rate ล่าสุด
app.get("/funding-rate", async (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";

  try {
    const binanceRes = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
    const data = await binanceRes.json();

    if (!Array.isArray(data)) {
      console.error("Binance Error:", data);
      return res.status(400).json({ error: data.msg || "Unexpected response" });
    }

    res.json(data);
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// 🔹 2. Private: funding fee history
app.post("/account-funding", async (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) return res.status(400).json({ error: "Missing API credentials" });

  try {
    const timestamp = Date.now();
    const query = `incomeType=FUNDING_FEE&limit=1000&timestamp=${timestamp}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(query).digest("hex");

    const url = `https://fapi.binance.com/fapi/v1/income?${query}&signature=${signature}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey
      }
    });

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.error("Binance Error:", data);
      return res.status(400).json({ error: data.msg || "Unexpected response" });
    }

    res.json(data);
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});


// ✅ ดึงตำแหน่งปัจจุบันจาก Futures Account
app.post("/account-positions", async (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) return res.status(400).json({ error: "Missing API credentials" });

  try {
    const timestamp = Date.now();
    const query = `timestamp=${timestamp}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(query).digest("hex");

    const url = `https://fapi.binance.com/fapi/v2/account?${query}&signature=${signature}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey
      }
    });

    const data = await response.json();
    if (!data || !data.positions) return res.status(400).json({ error: "Unexpected response", raw: data });

    // ส่งเฉพาะ positions ที่ size ≠ 0
    const activePositions = data.positions.filter(p => parseFloat(p.positionAmt) !== 0);
    res.json(activePositions);
  } catch (err) {
    console.error("Position Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});
// ✅ /account-income สำหรับดึง Realized PnL (Position History)
app.post("/account-income", async (req, res) => {
  const { apiKey, apiSecret, incomeType = "REALIZED_PNL", startTime } = req.body;

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: "Missing API credentials" });
  }

  try {
    const timestamp = Date.now();
    let query = `incomeType=${incomeType}&timestamp=${timestamp}`;
    if (startTime) {
      query += `&startTime=${startTime}`;
    }

    const signature = crypto.createHmac("sha256", apiSecret).update(query).digest("hex");
    const url = `https://fapi.binance.com/fapi/v1/income?${query}&signature=${signature}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": apiKey
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Income Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
