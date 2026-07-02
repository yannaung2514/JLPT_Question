import { useState } from 'react';
import axios from 'axios';

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<{ [key: number]: boolean }>({});

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setSelectedAnswers({});
    setSubmittedQuestions({});

    const formData = new FormData();
    formData.append('pdfFile', file);

    try {
      const res = await axios.post('http://localhost:5000/upload', formData);
      setQuestions(res.data.questions);
      console.log(res.data);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Unknown error';
      alert('Error: ' + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (questionIndex: number, optionIndex: number) => {
    if (submittedQuestions[questionIndex]) return; // Prevent changing after submission
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const handleSubmitAnswer = (questionIndex: number) => {
    if (selectedAnswers[questionIndex] === undefined) return; // No answer selected
    setSubmittedQuestions(prev => ({
      ...prev,
      [questionIndex]: true
    }));
  };

  const isCorrect = (questionIndex: number) => {
    if (!submittedQuestions[questionIndex]) return false;
    const q = questions[questionIndex];
    const selectedOptionText = q.options[selectedAnswers[questionIndex]];
    return selectedOptionText === q.answer;
  };

  const getOptionLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D, ...
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <h1 className="header-title">JLPT Question Generator</h1>
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
            <p className="upload-text">Upload a JLPT PDF to generate practice questions</p>
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
                  'Generate Questions'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Questions Section */}
        {questions.length > 0 && (
          <div className="questions-section">
            <div className="questions-header">
              <h2>Practice Questions</h2>
              <span className="question-count">Total: {questions.length} questions</span>
            </div>

            <div className="paper-container">
              {questions.map((q, qIndex) => (
                <div key={qIndex} className={`question-card ${submittedQuestions[qIndex] ? (isCorrect(qIndex) ? 'correct' : 'incorrect') : ''}`}>
                  <div className="question-number">{qIndex + 1}</div>
                  <div className="question-body">
                    <p className="question-text">{q.question}</p>

                    <div className="options-row">
                      {q.options.map((opt, oIndex) => {
                        const optionLabel = getOptionLabel(oIndex);
                        let optionClass = 'option-item';
                        
                        if (submittedQuestions[qIndex]) {
                          const isSelectedOption = selectedAnswers[qIndex] === oIndex;
                          const isAnswerOption = opt === q.answer;
                          
                          if (isAnswerOption) {
                            optionClass += ' correct-option';
                          } else if (isSelectedOption && !isAnswerOption) {
                            optionClass += ' wrong-option';
                          }
                        } else if (selectedAnswers[qIndex] === oIndex) {
                          optionClass += ' selected';
                        }

                        return (
                          <label
                            key={oIndex}
                            className={optionClass}
                          >
                            <input
                              type="radio"
                              name={`question-${qIndex}`}
                              checked={selectedAnswers[qIndex] === oIndex}
                              onChange={() => handleOptionSelect(qIndex, oIndex)}
                              className="radio-input"
                              disabled={submittedQuestions[qIndex]}
                            />
                            <span className="radio-custom"></span>
                            <span className="option-label">{optionLabel}.</span>
                            <span className="option-text">{opt}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* Submit Button */}
                    {!submittedQuestions[qIndex] && (
                      <button
                        className="submit-btn"
                        onClick={() => handleSubmitAnswer(qIndex)}
                        disabled={selectedAnswers[qIndex] === undefined}
                      >
                        Submit Answer
                      </button>
                    )}

                    {/* Result & Explanation */}
                    {submittedQuestions[qIndex] && (
                      <div className={`result-section ${isCorrect(qIndex) ? 'correct-result' : 'incorrect-result'}`}>
                        <div className="result-icon">
                          {isCorrect(qIndex) ? '✅' : '❌'}
                        </div>
                        <div className="result-details">
                          <p className="result-text">
                            {isCorrect(qIndex) ? 'Correct!' : 'Incorrect'}
                          </p>
                          <p className="correct-answer-text">
                            <strong>Answer:</strong> {q.answer}
                          </p>
                          <div className="explanation-box">
                            <strong>Explanation:</strong>
                            <p className="explanation-text">{q.explanation}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;