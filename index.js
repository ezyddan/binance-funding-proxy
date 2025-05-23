import express from "express";
import fetch from "node-fetch";

const app = express();
const port = process.env.PORT || 3000;

app.get("/funding", async (req, res) => {
  const symbol = req.query.symbol || "BTCUSDT";
  try {
    const binanceRes = await fetch(`https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}&limit=1`);
    const data = await binanceRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy fetch failed" });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
