import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import Groq from 'groq-sdk';
import pdfParse from 'pdf-parse';

// Load .env from root directory
dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// File Upload Setup
const upload = multer({ storage: multer.memoryStorage() });
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Supabase REST API Setup
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Fetch Questions from Supabase
app.get('/api/questions', async (req, res) => {
  try {
    console.log('Fetching questions from Supabase...');
    console.log('SUPABASE_URL:', SUPABASE_URL);
    console.log('SUPABASE_ANON_KEY exists:', !!SUPABASE_ANON_KEY);
    
    const url = `${SUPABASE_URL}/rest/v1/JLPTQuestions?order=number.asc`;
    console.log('Request URL:', url);
    
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error text:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Raw data from Supabase:', data);
    console.log(`Fetched ${data?.length || 0} questions from Supabase`);

    // Transform Supabase data to N2Question format
    const questions = (data || []).map((row: any) => {
      console.log('Processing row:', row);
      
      // Map section values to expected format
      const rawType = String(row.type ?? '').trim().toLowerCase();
      let section = 'vocabulary';
      if (rawType.includes('文法') || rawType.includes('grammar')) section = 'grammar';
      else if (rawType.includes('読解') || rawType.includes('reading')) section = 'reading';
      else if (rawType.includes('聴解') || rawType.includes('listening') || rawType.includes('听力')) section = 'listening';
      else if (rawType.includes('言葉') || rawType.includes('vocabulary') || rawType.includes('語彙')) section = 'vocabulary';
      
      // Handle NULL question column
      let questionText = '';
      if (row.question === null || row.question === undefined) {
        questionText = '';
      } else if (typeof row.question === 'string') {
        questionText = row.question;
      } else if (typeof row.question === 'object') {
        questionText = JSON.stringify(row.question);
      }
      
      return {
        id: row.id,
        questionText: questionText,
        options: [row.option1, row.option2, row.option3, row.option4].filter(opt => opt !== null && opt !== undefined),
        correctAnswer: row.answer ? String.fromCharCode(64 + row.answer) : '',
        explanation: (typeof row.question === 'object' && row.question !== null) ? (row.question.explanation || '') : '',
        section: section,
        difficulty: 'medium',
        number: row.number,
        sub_id: row.sub_id
      };
    });

    console.log('Transformed questions:', questions);
    res.json({ questions });
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({ error: 'Failed to fetch questions', details: err.message });
  }
});

// Save Question to Supabase
app.post('/api/questions', async (req, res) => {
  try {
    const { number, sub_id, type, question, option1, option2, option3, option4, answer } = req.body;

    const questionData = typeof question === 'object' ? question : { text: question };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/JLPTQuestions`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        number,
        sub_id,
        type,
        question: questionData,
        option1,
        option2,
        option3,
        option4,
        answer
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Question saved to Supabase:', data);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Error saving question:', err);
    res.status(500).json({ error: 'Failed to save question' });
  }
});

// Upload Route
app.post('/upload', upload.single('pdfFile'), async (req, res) => {
  console.log('Upload request received');
  
  if (!req.file) {
    console.log('No file found in request');
    return res.status(400).send('File not found');
  }

  console.log('File received:', req.file.originalname, 'Size:', req.file.size);

  try {
    // Extract text from PDF using pdf2json
    console.log('Extracting PDF text...');
    const extractedText = await extractPDFText(req.file.buffer);
    console.log('Extracted text length:', extractedText.length);
    console.log('Extracted text preview:', extractedText.substring(0, 200));
    
    if (!extractedText || extractedText.trim().length < 100) {
      console.log('Insufficient text extracted from PDF, returning empty questions');
      // Return empty questions array so frontend can show empty JLPT format
      return res.json({ 
        questions: [],
        debug: {
          extractedTextLength: extractedText.length,
          extractedTextPreview: extractedText.substring(0, 200),
          message: 'PDF text extraction failed. You can manually add questions.'
        }
      });
    }

    console.log('Calling Groq API...');
    // Generate questions using Groq API
    const prompt = `
      Extract ALL questions from the following JLPT PDF text and convert them into Multiple Choice Questions (MCQ).
      Do NOT limit the number of questions - include every single question found in the text.
      Each question should be JLPT N2 level appropriate.
      Categorize each question into one of these sections: vocabulary (文字・語彙), grammar (文法), or reading (読解).
      Assign difficulty as easy, medium, or hard based on the question content.
      Return in JSON format only, no markdown formatting.
      Format: { "questions": [{ "question": "...", "options": ["...", "...", "...", "..."], "answer": "...", "explanation": "...", "section": "vocabulary|grammar|reading", "difficulty": "easy|medium|hard" }] }
      
      Text: ${extractedText.substring(0, 8000)}
    `;

    let completion;
    try {
      completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a JLPT N2 exam question generator. Always respond with valid JSON only, no markdown formatting.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'openai/gpt-oss-120b',
        temperature: 0.7,
        max_tokens: 16000,
      });
    } catch (apiError: any) {
      console.error('Groq API error:', apiError);
      return res.status(500).json({ 
        error: 'AI API error: ' + (apiError.message || 'Unknown error'),
        debug: {
          apiError: apiError.error || apiError.message,
          statusCode: apiError.status || apiError.statusCode
        }
      });
    }

    console.log('Groq API response received');
    let content = completion.choices[0]?.message?.content || '';
    console.log('Response content length:', content.length);
    console.log('Raw AI response:', content.substring(0, 500));
    
    // Clean up the response - remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // Try to extract JSON if it's wrapped in other text
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    // Validate JSON before parsing
    try {
      const parsedResult = JSON.parse(content);
      
      // Validate response structure
      if (!parsedResult.questions || !Array.isArray(parsedResult.questions)) {
        console.error('Invalid structure:', parsedResult);
        return res.status(500).json({ 
          error: 'Invalid response format from AI',
          debug: {
            extractedTextLength: extractedText.length,
            extractedTextPreview: extractedText.substring(0, 200),
            aiResponse: content.substring(0, 500)
          }
        });
      }
      
      // Send response to frontend with debug info
      res.json({
        ...parsedResult,
        debug: {
          extractedTextLength: extractedText.length,
          extractedTextPreview: extractedText.substring(0, 200),
          questionCount: parsedResult.questions.length
        }
      });
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

// Helper function to extract text from PDF using pdf-parse
async function extractPDFText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});