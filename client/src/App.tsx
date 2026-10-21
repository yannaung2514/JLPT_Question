import { useState } from 'react';
import axios from 'axios';
import QuestionFrame from './components/QuestionFrame/QuestionFrame';
import type { N2Question } from '../../shared/types';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [n2Questions, setN2Questions] = useState<N2Question[]>([]);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [pdfUploaded, setPdfUploaded] = useState(false);

  // Convert raw questions to N2 format
  const convertToN2Questions = (rawQuestions: any[]): N2Question[] => {
    const sections: Array<'vocabulary' | 'grammar' | 'reading' | 'listening'> = ['vocabulary', 'grammar', 'reading', 'listening'];
    const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];
    
    return rawQuestions.map((q, index) => ({
      id: String(q.id ?? index + 1),
      sub_id: typeof q.sub_id === 'number' ? q.sub_id : undefined,
      number: typeof q.number === 'number' ? q.number : undefined,
      section: (q.section && sections.includes(q.section)) ? q.section : sections[index % sections.length],
      questionText: q.question,
      options: (q.options || []).filter((o: any) => o !== null && o !== undefined && String(o).trim() !== ''),
      correctAnswer: q.answer,
      explanation: q.explanation,
      script: q.script,
      photoUrl: q.photoUrl,
      difficulty: (q.difficulty && difficulties.includes(q.difficulty)) ? q.difficulty : difficulties[index % difficulties.length],
    }));
  };

  const handleUpload = async () => {
    console.log('handleUpload called, file:', file);
    if (!file) {
      console.log('No file selected');
      return;
    }
    setLoading(true);
    setPdfUploaded(true);
    console.log('Loading state set to true');

    const formData = new FormData();
    formData.append('pdfFile', file);
    console.log('FormData created, sending to server...');

    try {
      const res = await axios.post('http://localhost:5000/upload', formData);
      console.log('Response received:', res.data);
      console.log('Debug info:', res.data.debug);
      const rawQuestions = res.data.questions;
      console.log('Questions count:', rawQuestions?.length);
      
      if (rawQuestions && rawQuestions.length > 0) {
        setN2Questions(convertToN2Questions(rawQuestions));
      } else {
        console.log('No questions from API, creating empty JLPT format');
        const emptyQuestions = createEmptyJLPTFormat();
        setN2Questions(convertToN2Questions(emptyQuestions));
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      console.log('Creating empty JLPT format due to error');
      const emptyQuestions = createEmptyJLPTFormat();
      setN2Questions(convertToN2Questions(emptyQuestions));
    } finally {
      setLoading(false);
      console.log('Loading state set to false');
    }
  };

  // Load questions from Supabase
  const handleLoadFromDatabase = async () => {
    console.log('Loading questions from Supabase...');
    setLoading(true);
    setPdfUploaded(true);
    
    try {
      console.log('Making request to: http://localhost:5000/api/questions');
      const res = await axios.get('http://localhost:5000/api/questions');
      console.log('Full response:', res);
      console.log('Response data:', res.data);
      console.log('Response status:', res.status);
      
      const questions = res.data.questions;
      const audioUrls = res.data.audioUrls || {};
      console.log('Questions array:', questions);
      console.log('Questions length:', questions?.length);
      
      if (questions && questions.length > 0) {
        console.log('Setting questions to state...');
        setN2Questions(questions);
        setAudioUrls(audioUrls);
        console.log(`Loaded ${questions.length} questions from Supabase`);
        console.log('First question:', questions[0]);
      } else {
        console.log('No questions found in Supabase or questions array is empty');
        console.log('Questions value:', questions);
        const emptyQuestions = createEmptyJLPTFormat();
        setN2Questions(convertToN2Questions(emptyQuestions));
      }
    } catch (err: any) {
      console.error('Error loading from Supabase:', err);
      console.error('Error response:', err.response);
      console.error('Error message:', err.message);
      // Prefer the server's explanation (e.g. "Supabase is not configured...")
      // over axios's generic "Request failed with status code 500".
      const serverDetail = err?.response?.data?.details || err?.response?.data?.error;
      let message: string;
      if (serverDetail) {
        message = `Failed to load questions from database: ${serverDetail}`;
      } else if (!err?.response) {
        // No response at all means the server was never reached
        // (not started, wrong port, or blocked by the network).
        message =
          'Failed to load questions from database: the server is not reachable at ' +
          'http://localhost:5000. Start it with "npm run server" (or "npm run dev" ' +
          'from the project root) and try again.';
      } else {
        message = `Failed to load questions from database: ${err.message}`;
      }
      alert(message);
      const emptyQuestions = createEmptyJLPTFormat();
      setN2Questions(convertToN2Questions(emptyQuestions));
    } finally {
      setLoading(false);
      console.log('Loading finished');
    }
  };

  const handleReset = () => {
    setN2Questions([]);
    setFile(null);
    setPdfUploaded(false);
  };

  // Create empty JLPT N2 format - returns empty array so user can add questions manually
  const createEmptyJLPTFormat = (): any[] => {
    return [];
  };
  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <h1 className="header-title">JLPT N2 Question Generator</h1>
        </div>
      </div>

      <div className="main-content">
        {/* Upload Section */}
        <div className="upload-section">
          <div className="upload-card">
            <div className="upload-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <p className="upload-text">Upload a JLPT PDF to generate N2 practice questions</p>
            <div className="upload-controls">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => e.target.files && setFile(e.target.files[0])}
                id="file-upload"
                className="file-input"
              />
              <label htmlFor="file-upload" className="file-label">
                {file ? file.name : 'Choose PDF File'}
              </label>
              <button
                onClick={handleUpload}
                disabled={loading || !file}
                className="generate-btn"
              >
                {loading ? (
                  <span className="loading-spinner">
                    <span className="spinner"></span>
                    Generating...
                  </span>
                ) : (
                  'Generate N2 Questions'
                )}
              </button>
              <button
                onClick={handleLoadFromDatabase}
                disabled={loading}
                className="load-db-btn"
              >
                {loading ? 'Loading...' : ' Load from Database'}
              </button>
            </div>
          </div>
        </div>

        {/* N2 Question Frame */}
        {pdfUploaded && (
          <QuestionFrame
            questions={n2Questions}
            audioUrls={audioUrls}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  );
}

export default App;