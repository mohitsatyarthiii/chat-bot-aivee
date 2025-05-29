import express from "express"
import AWS from "aws-sdk"
import cors from "cors"
import bodyParser from "body-parser"
import dotenv from "dotenv"
dotenv.config();

const app = express();
app.use(cors(
{   origin:"http://localhost:5173",
    credentials:true
}
));

app.use(bodyParser.json());

// AWS S3 Configuration
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_KEY,
  secretAccessKey: process.env.AWS_SECRET,
  region: process.env.AWS_REGION,

});

// utility: check if a line is a heading 
function isHeading(line) {
  const trimmed = line.trim();
  return (
    trimmed.length < 5 || 
    /^[A-Z\s]+$/.test(trimmed) ||
    /\b(terms|conditions|privacy|ploicy|agreement|index)\b/i.test(trimmed)
  );
}

// Utility to trim relevant content from each document
function getTrimmedResponse(documentText, question) {
  const keywords = question
    .replace(/[^\w\s]/gi, "")
    .split(/\s+/)
    .filter(word => word.length > 3);

  const lines = documentText.split("\n");
  const matchedLines = new Set();

  lines.forEach((line, index) => {
    keywords.forEach(keyword => {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        const start = Math.max(0, index - 1);
        const end = Math.min(lines.length, index + 2);
        for (let i = start; i < end; i++) {
          matchedLines.add(lines[i].trim());
        }
      }
    });
  });

  const result = [...matchedLines].join("\n");
  return result;
}

// Main endpoint
app.post("/api/query", async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Question is required" });

  try {
    // List all objects inside the documents folder
    const listParams = {
      Bucket: process.env.S3_BUCKET,
      Prefix: process.env.S3_DOC_PREFIX,
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    // Filter out only .txt or .pdf (depending on your format)
    const fileKeys = listedObjects.Contents
      .map(item => item.Key)
      .filter(key => key.endsWith(".txt") || key.endsWith(".pdf")); // Adjust if needed

    // Fetch and trim all files in parallel
    const results = await Promise.all(
      fileKeys.map(async (fileKey) => {
        const file = await s3.getObject({ Bucket: process.env.S3_BUCKET, Key: fileKey }).promise();
        const text = file.Body.toString("utf-8");
        const trimmed = getTrimmedResponse(text, question);
        return trimmed;
      })
    );

    const finalAnswer = results.filter(Boolean).join("\n\n");

    return res.json({
      answer: finalAnswer || "Sorry, I couldn't find anything useful related to your question.",
    });
  } catch (err) {
    console.error(" Error processing request:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Server start
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log( `Server running on http://localhost:${PORT}`);
});

// Express backend me:
app.use(express.static(path.join(__dirname, '../frontend/build')));