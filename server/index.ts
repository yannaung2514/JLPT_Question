import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import Groq from 'groq-sdk';
import pdfParse from 'pdf-parse';

// Load env files.
// - server/.env holds the actual server secrets (GROQ_API_KEY, OpenAI, ...)
// - the repo-root .env is only a legacy fallback (PORT, GEMINI_API_KEY)
// Paths are resolved from __dirname so the server starts correctly regardless
// of the working directory it is launched from.
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// File Upload Setup
const upload = multer({ storage: multer.memoryStorage() });

// Groq client is created lazily: instantiating it with a missing API key
// throws, which previously crashed the whole server on startup and took the
// Supabase endpoints down with it.
let groqClient: Groq | null = null;
function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = (process.env.GROQ_API_KEY || '').trim();
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not configured. Add it to server/.env');
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// Supabase REST API Setup
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
// The anon key is preferred, but this project is also deployed with a service
// role key (the anon key is not available for this Supabase project).
// Both are server-side only - they are never sent to the browser.
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || ''
).trim();

/**
 * Returns the Supabase REST config, or throws a message that explains exactly
 * which environment variables are missing.
 */
function getSupabaseConfig(): { url: string; key: string } {
  // Accept the anon key or a service role key, whichever is configured.
  const key = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) {
    const missing = [
      !SUPABASE_URL ? 'SUPABASE_URL' : null,
      !key ? 'SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)' : null,
    ].filter(Boolean);
    throw new Error(
      `Supabase is not configured. Missing: ${missing.join(', ')}. Add them to server/.env`
    );
  }
  // Strip trailing slashes so the REST path is never doubled up
  return { url: SUPABASE_URL.replace(/\/+$/, ''), key: key };
}

// Health check - lets the client tell "server is down" apart from
// "server is up but Supabase is misconfigured".
app.get('/api/health', (_req, res) => {
  const configured = !!(SUPABASE_URL && (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY));
  res.json({
    status: 'ok',
    supabaseConfigured: configured,
    message: configured
      ? 'Server is running and Supabase is configured.'
      : 'Server is running, but SUPABASE_URL / SUPABASE_ANON_KEY are missing from server/.env.',
  });
});

// Fetch Questions from Supabase
app.get('/api/questions', async (req, res) => {
  try {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();

    console.log('Fetching questions from Supabase...');
    console.log('SUPABASE_URL:', supabaseUrl);
    console.log('SUPABASE_ANON_KEY exists:', !!supabaseKey);

    // Order by exam, then sub_id, then question number. Ordering by `number`
    // alone interleaves the different exam sessions, which breaks the client's
    // grouping of consecutive questions that share the same sub_id.
    const url = `${supabaseUrl}/rest/v1/JLPTQuestions?order=id.asc,sub_id.asc,number.asc`;
    console.log('Request URL:', url);

    const response = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
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
      
      // Some questions (e.g. 聴解 image questions) store the picture inside the
      // `question` JSONB column under a `photoId` key. The picture IS the
      // question in that case, so it is exposed separately from the text.
      const photoId =
        row.question && typeof row.question === 'object' && typeof row.question.photoId === 'string'
          ? row.question.photoId.trim()
          : '';

      // `photoId` may be a full public URL or just the object name in the
      // `JLPTQuestions` bucket. Normalize both to a directly loadable URL.
      let photoUrl = '';
      if (photoId) {
        photoUrl = /^https?:\/\//i.test(photoId)
          ? photoId
          : `${supabaseUrl}/storage/v1/object/public/JLPTQuestions/${photoId.replace(/^\/+/, '')}`;
      }

      // Extract script text for 聴解 (listening) questions.
      // Supports either a separate `script` column or a `script` key inside
      // the `question` JSONB object.
      const scriptText =
        row.script != null
          ? String(row.script)
          : row.question && typeof row.question === 'object' && row.question.script != null
            ? String(row.question.script)
            : '';
      let questionText = '';
      if (row.question === null || row.question === undefined) {
        questionText = '';
      } else if (typeof row.question === 'string') {
        questionText = row.question;
      } else if (typeof row.question === 'object') {
        if (photoId) {
          // Keep every other key (text, target, info, passage, ...) so the
          // existing parsers still work, but drop the photo reference and script
          // since those are rendered separately.
          const { photoId: _ignored, script: _scriptIgnored, ...rest } = row.question;
          questionText = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
        } else {
          // Drop the script key from questionText since it's rendered in a popup.
          const { script: _scriptIgnored, ...rest } = row.question;
          questionText = Object.keys(rest).length > 0 ? JSON.stringify(rest) : '';
        }
      }
      
      // Build the option list first, dropping any empty trailing slots.
      const options = [row.option1, row.option2, row.option3, row.option4]
        .filter(opt => opt !== null && opt !== undefined && String(opt).trim() !== '');

      // `answer` in the database is the 1-based index of the correct option.
      // The client compares the selected option's TEXT against `correctAnswer`,
      // so the answer has to be resolved to that text, not to a letter.
      const answerIndex = Number(row.answer);
      const correctAnswer =
        Number.isInteger(answerIndex) && answerIndex >= 1 && answerIndex <= options.length
          ? String(options[answerIndex - 1] ?? '')
          : '';

      return {
        id: row.id,
        questionText: questionText,
        script: scriptText,
        photoUrl: photoUrl,
        options: options,
        correctAnswer: correctAnswer,
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
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to fetch questions', details: message });
  }
});

// Save Question to Supabase
app.post('/api/questions', async (req, res) => {
  try {
    const { url: supabaseUrl, key: supabaseKey } = getSupabaseConfig();
    const { number, sub_id, type, question, option1, option2, option3, option4, answer } = req.body;

    const questionData = typeof question === 'object' ? question : { text: question };

    const response = await fetch(`${supabaseUrl}/rest/v1/JLPTQuestions`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
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
      completion = await getGroqClient().chat.completions.create({
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