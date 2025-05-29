import express from "express";
import AWS from "aws-sdk";
import bodyParser from "body-parser";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static frontend files


app.use(bodyParser.json());

// AWS S3 config
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY,
  secretAccessKey: process.env.AWS_SECRET,
  region: process.env.AWS_REGION,
});

// Helper: check if a line is probably a heading or metadata line
function isProbableHeading(line) {
  const trimmed = line.trim();
  const isShort = trimmed.split(" ").length <= 4;
  const isUpperCase = trimmed === trimmed.toUpperCase();
  const hasMetaKeywords = /\b(index|page|title|created|copyright|confidential|revision|producer|author)\b/i.test(trimmed);
  return isShort || isUpperCase || hasMetaKeywords;
}

// Extract relevant paragraph lines that match the question keywords and filter out headings
function getTrimmedResponse(documentText, question) {
  const keywords = question
    .replace(/[^\w\s]/gi, "")
    .split(/\s+/)
    .filter((word) => word.length > 3);

  const lines = documentText.split("\n");
  const matchedParagraphs = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    const isMatch = keywords.some((keyword) =>
      lowerLine.includes(keyword.toLowerCase())
    );
    const isGoodLine = !isProbableHeading(line) && line.trim().length > 30;

    if (isMatch && isGoodLine) {
      matchedParagraphs.add(line.trim());
    }
  }

  return [...matchedParagraphs].join("\n\n");
}

// Predefined chatbot replies for greetings or fallback
const presetReplies = {
  hello:
    "Hey! 👋 How can I assist you today? Feel free to ask me anything about our Tridiagonal Groups.",
  hi: "Hello! 😊 What can I help you with today?",
  hey: "Hey there! Ask me anything you want to know.",
  greetings: "Greetings! How may I assist you?",
  fallback:
    "I didn't find exact info from documents, but I'm here to help! Could you please rephrase your question or ask something else?",
};

// Check if input is a greeting and respond accordingly
function checkForGreeting(text) {
  const normalized = text.toLowerCase().trim();
  if (presetReplies[normalized]) {
    return presetReplies[normalized];
  }
  // check if text contains any greeting keywords
  const greetingKeywords = ["hello", "hi", "hey", "greetings"];
  if (greetingKeywords.some((word) => normalized.includes(word))) {
    return presetReplies["hello"];
  }
  return null;
}

// Main API endpoint
app.post("/api/query", async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  // First check for greetings or simple predefined replies
  const greetingReply = checkForGreeting(question);
  if (greetingReply) {
    return res.json({ answer: greetingReply });
  }

  try {
    // List all documents inside the bucket with prefix
    const listParams = {
      Bucket: process.env.S3_BUCKET,
      Prefix: process.env.S3_DOC_PREFIX,
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    // Filter text or pdf files
    const fileKeys = listedObjects.Contents.filter((item) =>
      item.Key.endsWith(".txt") || item.Key.endsWith(".pdf")
    ).map((item) => item.Key);

    // Fetch and process all files
    const results = await Promise.all(
      fileKeys.map(async (fileKey) => {
        const file = await s3
          .getObject({ Bucket: process.env.S3_BUCKET, Key: fileKey })
          .promise();
        const text = file.Body.toString("utf-8");
        const trimmed = getTrimmedResponse(text, question);
        return trimmed;
      })
    );

    // Filter out empty results and join
const finalAnswer = results.filter(Boolean).join("\n\n");

    if (finalAnswer) {
      // Add a chatbot style intro
      const chatbotPrefix =
        "Here's what I found related to your question:\n\n";

      return res.json({ answer:  finalAnswer });
    } else {
      // No relevant content found in documents, fallback reply
      return res.json({ answer: presetReplies.fallback });
    }
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});