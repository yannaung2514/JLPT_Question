import { useState } from 'react';
import axios from 'axios';
import QuestionFrame from './components/QuestionFrame/QuestionFrame';
import type { N2Question } from '../../shared/types';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [n2Questions, setN2Questions] = useState<N2Question[]>([]);
  const [pdfUploaded, setPdfUploaded] = useState(false);

  // Convert raw questions to N2 format
  const convertToN2Questions = (rawQuestions: any[]): N2Question[] => {
    const sections: Array<'vocabulary' | 'grammar' | 'reading' | 'listening'> = ['vocabulary', 'grammar', 'reading', 'listening'];
    const difficulties: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];
    
    return rawQuestions.map((q, index) => ({
      id: String(q.id ?? index + 1),
      section: (q.section && sections.includes(q.section)) ? q.section : sections[index % sections.length],
      questionText: q.question,
      options: q.options,
      correctAnswer: q.answer,
      explanation: q.explanation,
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
      console.log('Questions array:', questions);
      console.log('Questions length:', questions?.length);
      
      if (questions && questions.length > 0) {
        console.log('Setting questions to state...');
        setN2Questions(questions);
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
      alert(`Failed to load questions from database: ${err.message}`);
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
            onReset={handleReset}
            onUpdateQuestion={(index, field, value) => {
              setN2Questions(prev => {
                if (field === 'add') {
                  // Add new question
                  const newQ = JSON.parse(value);
                  const newQuestion: N2Question = {
                    id: `local_${Date.now()}_${prev.length + 1}`,
                    section: 'vocabulary', // Default section, can be customized
                    questionText: newQ.text,
                    options: newQ.options,
                    correctAnswer: newQ.answer || '',
                    explanation: '',
                    difficulty: 'medium'
                  };
                  return [...prev, newQuestion];
                }
                
                const updated = [...prev];
                if (field === 'questionText') {
                  updated[index] = { ...updated[index], questionText: value };
                } else if (field.startsWith('option-')) {
                  const optIdx = parseInt(field.split('-')[1]);
                  const newOptions = [...updated[index].options];
                  newOptions[optIdx] = value;
                  updated[index] = { ...updated[index], options: newOptions };
                }
                return updated;
              });
            }}
          />
        )}
      </div>
    </div>
  );
}

export default App;