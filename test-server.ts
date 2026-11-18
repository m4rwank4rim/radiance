import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/test", (req, res) => {
    console.log("[TEST] Received POST /test");
    res.json({ success: true, body: req.body });
});

app.listen(3001, () => {
    console.log("[TEST] Server running on http://localhost:3001");
});
