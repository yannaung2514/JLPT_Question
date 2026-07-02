import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
const PDFParser = require('pdf2json');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load .env from root directory
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// File Upload Setup
const upload = multer({ storage: multer.memoryStorage() });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Upload Route
app.post('/upload', upload.single('pdfFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('File not found');
  }

  try {
    // Extract text from PDF using pdf2json
    const extractedText = await extractPDFText(req.file.buffer);
    
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ error: 'No text could be extracted from the PDF' });
    }

    // Generate questions using Google Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
    
    const prompt = `
      Based on the following JLPT text, generate 5 Multiple Choice Questions (MCQ).
      Return in JSON format only, no markdown formatting.
      Format: { "questions": [{ "question": "...", "options": ["...", "..."], "answer": "...", "explanation": "..." }] }
      
      Text: ${extractedText.substring(0, 3000)}
    `;

    const result = await model.generateContent(prompt);
    const response = result.response;
    let content = response.text();
    
    // Clean up the response - remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Validate JSON before parsing
    try {
      const parsedResult = JSON.parse(content);
      
      // Validate response structure
      if (!parsedResult.questions || !Array.isArray(parsedResult.questions)) {
        return res.status(500).json({ error: 'Invalid response format from AI' });
      }
      
      // Send response to frontend
      res.json(parsedResult);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Content received:', content);
      res.status(500).json({ error: 'Failed to parse AI response as JSON' });
    }

  } catch (error) {
    console.error('Detailed error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: errorMessage });
  }
});

// Helper function to extract text from PDF using pdf2json
function extractPDFText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (err: any) => {
      reject(new Error('Failed to parse PDF: ' + (err.parserError || err.message || 'Unknown error')));
    });

    pdfParser.on('pdfParser_dataReady', (data: any) => {
      try {
        let extractedText = '';
        if (data && data.Pages) {
          for (const page of data.Pages) {
            if (page.Texts) {
              for (const textItem of page.Texts) {
                if (textItem.R) {
                  for (const r of textItem.R) {
                    if (r.T) {
                      extractedText += decodeURIComponent(r.T) + ' ';
                    }
                  }
                }
              }
            }
          }
        }
        resolve(extractedText.trim());
      } catch (error) {
        reject(error);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});