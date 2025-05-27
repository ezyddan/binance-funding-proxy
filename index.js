// ✅ Railway Proxy (full version with symbol validation & fallback logs)
import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 🔹 Fetch valid symbols for filtering
let validSymbols = [];
(async () => {
  try {
    const res = await fetch("https://fapi.binance.com/fapi/v1/exchangeInfo");
    const data = await res.json();
    validSymbols = data.symbols.map(s => s.symbol);
    console.log("✅ Loaded valid symbols", validSymbols.length);
  } catch (err) {
    console.error("❌ Failed to load symbol list", err);
  }
})();

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
      headers: { "X-MBX-APIKEY": apiKey }
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
      headers: { "X-MBX-APIKEY": apiKey }
    });

    const data = await response.json();
    if (!data || !data.positions) return res.status(400).json({ error: "Unexpected response", raw: data });

    const activePositions = data.positions.filter(p => parseFloat(p.positionAmt) !== 0);
    res.json(activePositions);
  } catch (err) {
    console.error("Position Error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

app.post("/account-income", async (req, res) => {
  const { apiKey, apiSecret, incomeType = "REALIZED_PNL", startTime } = req.body;
  if (!apiKey || !apiSecret) return res.status(400).json({ error: "Missing API credentials" });

  try {
    const timestamp = Date.now();
    let query = `incomeType=${incomeType}&timestamp=${timestamp}`;
    if (startTime) query += `&startTime=${startTime}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(query).digest("hex");
    const url = `https://fapi.binance.com/fapi/v1/income?${query}&signature=${signature}`;

    const response = await fetch(url, {
      method: "GET",
      headers: { "X-MBX-APIKEY": apiKey }
    });

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Income Error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/account-position-summary", async (req, res) => {
  const { apiKey, apiSecret, startTime } = req.body;
  if (!apiKey || !apiSecret) return res.status(400).json({ error: 'Missing credentials' });

  try {
    const timestamp = Date.now();
    const base = 'https://fapi.binance.com';

    let incomeQS = `incomeType=REALIZED_PNL&limit=1000&timestamp=${timestamp}`;
    if (startTime) incomeQS += `&startTime=${startTime}`;
    const incomeSig = crypto.createHmac('sha256', apiSecret).update(incomeQS).digest('hex');
    const incomeURL = `${base}/fapi/v1/income?${incomeQS}&signature=${incomeSig}`;

    console.log("🔹 Fetching income...");
    const incomeRes = await fetch(incomeURL, { headers: { 'X-MBX-APIKEY': apiKey } });
    const incomes = await incomeRes.json();
    console.log("✅ Got income", incomes.length);

    const result = [];

    for (const p of incomes) {
      const symbol = p.symbol;
      if (!validSymbols.includes(symbol)) {
        console.warn(`⚠️ Skipping invalid symbol: ${symbol}`);
        continue;
      }
const MAX_BACK = 90 * 24 * 60 * 60 * 1000;
const now = Date.now();
const closeTs = p.time;
const startTime = Math.max(closeTs - (3 * 24 * 60 * 60 * 1000), now - MAX_BACK);


const orderQS = `symbol=${symbol}&startTime=${startTime}&endTime=${closeTs}&timestamp=${timestamp}&recvWindow=60000`;
const orderSig = crypto.createHmac('sha256', apiSecret).update(orderQS).digest('hex');
const orderURL = `${base}/fapi/v1/allOrders?${orderQS}&signature=${orderSig}`;


      await sleep(150);

      try {
        const ordersRes = await fetch(orderURL, { headers: { 'X-MBX-APIKEY': apiKey } });
        const orders = await ordersRes.json();

        if (!Array.isArray(orders)) {
          console.error(`🚨 Binance response for ${symbol}:`, orders);
          throw new Error(`Invalid orders for ${symbol}`);
        }

        const symbolOrders = orders.filter(o => o.status === 'FILLED');
        const openOrder = symbolOrders.find(o => o.positionSide === 'BOTH' && o.type !== 'MARKET');
        const closeOrder = [...symbolOrders].reverse().find(o => o.status === 'FILLED');

        result.push({
          symbol: p.symbol,
          pnl: parseFloat(p.income),
          closeTime: new Date(p.time).toISOString(),
          openTime: openOrder ? new Date(openOrder.updateTime).toISOString() : null,
          entryPrice: openOrder?.avgPrice || openOrder?.price || null,
          closePrice: closeOrder?.avgPrice || closeOrder?.price || null,
          volume: closeOrder?.executedQty || null
        });
      } catch (orderErr) {
        console.error(`⚠️ Failed to fetch orders for ${symbol}`, orderErr);
        result.push({
          symbol: p.symbol,
          pnl: parseFloat(p.income),
          closeTime: new Date(p.time).toISOString(),
          openTime: null,
          entryPrice: null,
          closePrice: null,
          volume: null
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error("❌ Position summary error:", err);
    res.status(500).json({ error: "Failed to fetch position summary" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
