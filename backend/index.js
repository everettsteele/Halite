const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "8mb" }));

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const SALT_SYSTEM_PROMPT = `You are a senior State and Local Tax (SALT) analyst with deep expertise across all 50 US states and Canadian provinces. You assist SALT consulting professionals with research, analysis, and document review.

CORE RULES:
1. CITE EVERYTHING. Every factual claim must reference its source: [Source: Georgia Code 48-8-2] or [Source: uploaded filing, p.4, Schedule K]. Never state a tax position without a citation.
2. THREE CONFIDENCE LEVELS:
   - \u2705 High confidence: directly supported by statute, regulation, or uploaded document
   - \u26a0\ufe0f Review recommended: rule exists but interpretation is ambiguous or jurisdiction has recent enforcement activity
   - \u274c Insufficient data: the uploaded documents do not contain enough information to answer reliably
3. NEVER INVENT. If the documents don't support an answer, say so and explain what additional information is needed.
4. JURISDICTION PRECISION. State tax law varies enormously. Never apply a general rule to a specific jurisdiction without verifying it against uploaded materials.
5. PROFESSIONAL CONTEXT. Your audience is experienced SALT professionals. Surface the non-obvious. Flag the traps.

REPORT FORMAT:

## Summary
2-3 sentences: what was analyzed, key finding, recommended action.

## Findings
Organized by jurisdiction or issue. Each finding:
- Issue identified
- Statutory or regulatory basis [Source: ...]
- Confidence level (\u2705 / \u26a0\ufe0f / \u274c)
- Recommended action or verification step

## Flagged for Review
Items requiring professional judgment, additional documents, or verification against current enforcement posture.

## Insufficient Data
Specific questions this analysis could not answer, and exactly what documents or information would be needed.`;

app.get("/health", (req, res) => res.json({ status: "ok", service: "halite-api" }));

app.post("/api/analyze", async (req, res) => {
  const { firmName, problemDescription, documents, analysisType } = req.body;
  if (!documents || !documents.trim()) return res.status(400).json({ error: "No documents provided." });
  if (!problemDescription || !problemDescription.trim()) return res.status(400).json({ error: "No problem description provided." });

  console.log(`[SESSION] ${firmName || "unknown"} | ${analysisType || "general"} | ${new Date().toISOString()}`);

  const userContent = `Firm: ${firmName || "Not provided"}
Analysis Type: ${analysisType || "General SALT Review"}

PROBLEM / QUESTION:
${problemDescription}

UPLOADED DOCUMENTS:
${documents}

Produce a complete SALT analysis following your structured format. Cite every finding. Flag every uncertainty.`;

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SALT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    const data = await response.json();
    if (data.error) {
      console.error("[ANTHROPIC ERROR]", data.error);
      return res.status(502).json({ error: "Analysis service error. Please try again." });
    }

    const text = data.content?.find((b) => b.type === "text")?.text || "Analysis failed.";
    res.json({ report: text });
  } catch (err) {
    console.error("[ANALYZE ERROR]", err);
    res.status(500).json({ error: "Internal error. Please try again." });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages, report, documents, problemDescription } = req.body;
  if (!messages || !report) return res.status(400).json({ error: "Missing required fields." });

  const systemPrompt = `${SALT_SYSTEM_PROMPT}

---

CONTEXT FOR THIS SESSION:

ORIGINAL PROBLEM:
${problemDescription || "Not provided"}

UPLOADED DOCUMENTS:
${documents || "Not provided"}

YOUR PREVIOUS ANALYSIS:
${report}

Answer follow-up questions directly from the uploaded documents and your previous analysis. Always cite sources. Never speculate without flagging it. If a question requires information not in the documents, specify exactly what's missing.`;

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(502).json({ error: "Analysis service error." });

    const text = data.content?.find((b) => b.type === "text")?.text || "Could not generate response.";
    res.json({ reply: text });
  } catch (err) {
    console.error("[CHAT ERROR]", err);
    res.status(500).json({ error: "Internal error." });
  }
});

app.listen(PORT, () => console.log(`Halite API running on port ${PORT}`));
