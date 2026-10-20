import { useState, useEffect, useCallback, useRef } from 'react';
import './QuestionFrame.css';

type N2Section = 'vocabulary' | 'grammar' | 'reading' | 'listening';

interface N2Question {
  id?: string;
  sub_id?: number;
  section: N2Section;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

const SECTION_LABELS: Record<N2Section, string> = {
  vocabulary: '語彙',
  grammar: '文法',
  reading: '読解',
  listening: '聴解',
};

interface QuestionFrameProps {
  questions: N2Question[];
  onReset?: () => void;
  onUpdateQuestion?: (index: number, field: string, value: string) => void;
}

function QuestionFrame({ questions, onReset, onUpdateQuestion }: QuestionFrameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [selectedSection, setSelectedSection] = useState<N2Section | 'all'>('all');
  const [selectedExam, setSelectedExam] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ text: '', options: ['', '', '', ''], answer: '' });
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const optionRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  const sections: N2Section[] = ['vocabulary', 'grammar', 'reading', 'listening'];
  
  // Extract unique exam IDs from questions
  const uniqueExamIds = Array.from(new Set(questions.map(q => q.id).filter(Boolean))) as string[];
  
  // Format exam ID to display text (e.g., "202212" -> "2022年12月")
  const formatExamId = (examId: string): string => {
    if (examId.length === 6) {
      const year = examId.substring(0, 4);
      const month = examId.substring(4, 6);
      return `${year}年${month}月`;
    }
    return examId;
  };
  
  const questionsBySection = sections.map((section) => ({
    section,
    label: SECTION_LABELS[section],
    questions: questions.filter((q) => {
      const matchesSection = q.section === section;
      const matchesExam = selectedExam === 'all' || q.id === selectedExam;
      return matchesSection && matchesExam;
    }),
  }));

  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQuestions;

  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);

  // Auto-submit only when timer runs out AFTER quiz was started
  useEffect(() => {
    if (quizStarted && timeRemaining === 0 && timerActive === false && !submitted) {
      setSubmitted(true);
    }
  }, [timeRemaining, timerActive, submitted, quizStarted]);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleStartQuiz = () => {
    const totalTime = totalQuestions * 90;
    setTimeRemaining(totalTime);
    setTimerActive(true);
    setQuizStarted(true);
  };

  const handleOptionSelect = (optionIndex: number) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleNext = () => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex((prev) => prev + 1);
  };

  const handleJumpTo = (index: number) => {
    setCurrentIndex(index);
    setShowNav(false);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setTimerActive(false);
  };

  const handleRetry = () => {
    setCurrentIndex(0);
    setAnswers({});
    setSubmitted(false);
    setTimeRemaining(0);
    setTimerActive(false);
    setQuizStarted(false);
  };

  const handleAddQuestion = () => {
    if (onUpdateQuestion && newQuestion.text.trim()) {
      onUpdateQuestion(-1, 'add', JSON.stringify(newQuestion));
      setNewQuestion({ text: '', options: ['', '', '', ''], answer: '' });
      setShowAddModal(false);
    }
  };

  const handleCloseModal = () => {
    setNewQuestion({ text: '', options: ['', '', '', ''], answer: '' });
    setShowAddModal(false);
  };

  const applyFormatting = (field: string, format: 'bold' | 'underline' | 'target') => {
    let inputElement: HTMLTextAreaElement | HTMLInputElement | null = null;
    
    if (field === 'text') {
      inputElement = textAreaRef.current;
    } else if (field.startsWith('option-')) {
      const idx = parseInt(field.split('-')[1]);
      inputElement = optionRefs.current[idx];
    }

    if (!inputElement) return;

    const start = inputElement.selectionStart;
    const end = inputElement.selectionEnd;
    if (start === null || end === null) return;
    const text = inputElement.value;
    const selectedText = text.substring(start, end);

    if (!selectedText) return;

    let newText: string;
    
    if (format === 'target') {
      // Create JSON format with target
      const jsonFormat = JSON.stringify({ text: text, target: selectedText });
      newText = jsonFormat;
    } else {
      const wrapper = format === 'bold' ? '**' : '__';
      const formattedText = `${wrapper}${selectedText}${wrapper}`;
      newText = text.substring(0, start) + formattedText + text.substring(end);
    }

    if (field === 'text') {
      setNewQuestion({ ...newQuestion, text: newText });
    } else if (field.startsWith('option-')) {
      const idx = parseInt(field.split('-')[1]);
      const newOpts = [...newQuestion.options];
      newOpts[idx] = newText;
      setNewQuestion({ ...newQuestion, options: newOpts });
    }

    // Restore cursor position
    setTimeout(() => {
      if (inputElement) {
        inputElement.focus();
        if (format !== 'target') {
          const newCursorPos = start + selectedText.length + 4;
          inputElement.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
    }, 0);
  };

  const parseFormattedText = (text: string): string => {
    if (!text) return '';
    
    // Try to parse as JSON for question objects with target
    try {
      const parsed = JSON.parse(text);
      if (parsed.text && parsed.target) {
        // Replace target in text with bold+underline version
        const highlightedText = parsed.text.replace(
          new RegExp(parsed.target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          `<strong><u>${parsed.target}</u></strong>`
        );
        // Convert \n to <br> with left indentation (2 ideographic spaces for Japanese)
        return highlightedText.replace(/\n/g, '<br/>').replace(/\t/g, '\u3000\u3000');
      }
      // If it's just a text object
      if (parsed.text) return parsed.text.replace(/\n/g, '<br/>').replace(/\t/g, '\u3000\u3000');
    } catch {
      // Not JSON, continue with markdown parsing
    }
    
    // Convert **text** to <strong>text</strong>
    let parsed = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Convert __text__ to <u>text</u>
    parsed = parsed.replace(/__(.+?)__/g, '<u>$1</u>');
    // Convert \n to <br> with left indentation (2 ideographic spaces for Japanese)
    parsed = parsed.replace(/\n/g, '<br/>').replace(/\t/g, '\u3000\u3000');
    return parsed;
  };

  // Extract target word from question text (for sub_id=6)
  const extractTargetWord = (questionText: string): string => {
    if (!questionText) return '';
    
    // Try JSON format first
    try {
      const parsed = JSON.parse(questionText);
      if (parsed.target) return parsed.target;
      if (parsed.text) return parsed.text.trim();
    } catch {
      // Not JSON, continue with markdown parsing
    }
    
    // Try markdown format: **__word__** or __**word**__
    const boldUnderlineMatch = questionText.match(/\*\*__(.+?)__\*\*/);
    if (boldUnderlineMatch) return boldUnderlineMatch[1];
    
    const underlineBoldMatch = questionText.match(/__\*\*(.+?)\*\*__/);
    if (underlineBoldMatch) return underlineBoldMatch[1];
    
    // Try just bold or underline
    const boldMatch = questionText.match(/\*\*(.+?)\*\*/);
    if (boldMatch) return boldMatch[1];
    
    const underlineMatch = questionText.match(/__(.+?)__/);
    if (underlineMatch) return underlineMatch[1];
    
    // For sub_id=6, if no formatting found, the entire text is the target word
    // Remove any HTML tags and trim
    const plainText = questionText.replace(/<[^>]*>/g, '').trim();
    return plainText;
  };

  // Parse option text and underline target word if it matches (for sub_id=6)
  const parseOptionText = (optionText: string, targetWord: string): string => {
    if (!optionText) return '';
    
    // First, apply normal formatting (bold/underline)
    let parsed = parseFormattedText(optionText);
    
    // If there's a target word, underline it in the option
    if (targetWord) {
      const escapedTarget = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedTarget, 'g');
      parsed = parsed.replace(regex, `<u>${targetWord}</u>`);
    }
    
    return parsed;
  };

  // Parse sub_id=10/11/12 question text (format: "info:...\npassage:...\npassageA:...\npassageB:...\nwarning:...\nquestion:...")
  const parseSubId10Text = (questionText: string): { info: string; passage: string; passageA: string; passageB: string; warning: string; question: string } => {
    if (!questionText) return { info: '', passage: '', passageA: '', passageB: '', warning: '', question: '' };
    
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(questionText);
      if (parsed.info || parsed.passage || parsed.passageA || parsed.passageB || parsed.warning || parsed.question) {
        return { 
          info: parsed.info || '', 
          passage: parsed.passage || '', 
          passageA: parsed.passageA || '',
          passageB: parsed.passageB || '',
          warning: parsed.warning || '',
          question: parsed.question || '' 
        };
      }
    } catch {
      // Not JSON, continue with text parsing
    }
    
    // Parse format with optional passageA/passageB
    const infoMatch = questionText.match(/info:\s*([\s\S]*?)(?:\n(?:passage|passageA|passageB|warning|question):|\n|$)/i);
    const passageMatch = questionText.match(/passage:\s*([\s\S]*?)(?:\n(?:passageA|passageB|warning|question):|\n|$)/i);
    const passageAMatch = questionText.match(/passageA:\s*([\s\S]*?)(?:\n(?:passageB|warning|question):|\n|$)/i);
    const passageBMatch = questionText.match(/passageB:\s*([\s\S]*?)(?:\n(?:warning|question):|\n|$)/i);
    const warningMatch = questionText.match(/warning:\s*([\s\S]*?)(?:\nquestion:|\n|$)/i);
    const questionMatch = questionText.match(/question:\s*([\s\S]*)/i);
    
    return {
      info: infoMatch ? infoMatch[1].trim() : '',
      passage: passageMatch ? passageMatch[1].trim() : '',
      passageA: passageAMatch ? passageAMatch[1].trim() : '',
      passageB: passageBMatch ? passageBMatch[1].trim() : '',
      warning: warningMatch ? warningMatch[1].trim() : '',
      question: questionMatch ? questionMatch[1].trim() : questionText
    };
  };

  const isCorrect = (qIndex: number) => {
    if (!submitted) return false;
    const q = questions[qIndex];
    const selectedOptionText = q.options[answers[qIndex]];
    return selectedOptionText === q.correctAnswer;
  };

  const getOptionLabel = (index: number) => String(index + 1);
  const correctCount = submitted ? questions.filter((_, i) => isCorrect(i)).length : 0;

  const getDifficultyBadge = (difficulty: string) => {
    const labels: Record<string, string> = { easy: '易', medium: '中', hard: '難' };
    return labels[difficulty] || difficulty;
  };

  const getDifficultyClass = (difficulty: string) => `difficulty-${difficulty}`;
  const currentSection = currentQuestion?.section || 'vocabulary';
  const currentSectionLabel = SECTION_LABELS[currentSection];

  // Section header text mapping based on sub_id
  const getSectionHeaderText = (subId: number): string => {
    const sectionHeaders: Record<number, string> = {
      1: '問題１______の語彙の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。',
      2: '問題２______の語彙の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。',
      3: '問題３ ( )に人れるのに最もよいものを、1・2・3・4 から一つ選びなさい。',
      4: '問題４ ( )に人れるのに最もよいものを、1・2・3・4 から一つ選びなさい。',
      5: '問題５ の言葉に意味が最も近いものを、1・2・3・4から一つ選びなさい。',
      6: '問題６ 次の言葉の使い方として最もよいものを、1・2・3・4 から一 つ選びなさい 。',
      7: '問題７ 次の文の ( ) に人れるのに最もよいものを、 1・2・3・4 から一つ選びなさい 。',
      8: '問題８ 次の文のに☆人る最もよいものを、 1・2・3・4 から一つ選びなさ い 。',
      9: '問題９ 次の文章を読んで・、文章全体の内容を考えて、48から51の中に入る最もよいものを、1・2・3・4から一つ選びなさい。',
      10: '問題１０ 次のいからにらいの文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。',
      11: '問題１１ 次のいからにらいの文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。',
      12: '問題１２ 次のAとBの文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい',
      13: '問題１３次の文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4からーっ選びなさい。',
      14: '問題１４ 右のべーシは、あるテニススクールの人会案内てある。下の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。'
    };
    return sectionHeaders[subId] || '';
  };

  return (
    <div className="n2-frame">
      {/* N2 Header */}
      <div className="n2-header">
        <div className="n2-header-top">
          <div className="n2-level-badge">
            <span className="n2-level-text">JLPT</span>
            <span className="n2-level-number">N2</span>
          </div>
          <div className="n2-header-info">
            <h2 className="n2-title">日本語能力試験 N2 練習問題</h2>
            <p className="n2-subtitle">Japanese-Language Proficiency Test N2 Practice</p>
          </div>
          <div className="n2-timer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className={`timer-display ${timeRemaining <= 60 ? 'timer-warning' : ''}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
        </div>
        {/* Exam Selection Dropdown */}
        <div style={{ padding: '12px 24px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>試験回:</label>
          <select
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              background: 'white',
              color: '#1a237e'
            }}
          >
            <option value="all">全部</option>
            {uniqueExamIds.map((examId) => (
              <option key={examId} value={examId}>{formatExamId(examId)}</option>
            ))}
          </select>
        </div>
        <div className="n2-section-tabs">
          {questionsBySection.map(({ section, label, questions: sectionQuestions }) => {
            const isActive = currentSection === section;
            return (
              <button
                key={section}
                className={`n2-section-tab ${isActive ? 'active' : ''}`}
                onClick={() => {
                  const firstQ = questions.findIndex((q) => q.section === section);
                  if (firstQ >= 0) setCurrentIndex(firstQ);
                  setSelectedSection(section);
                }}
              >
                <span className="section-tab-label">{label}</span>
                <span className="section-tab-count">{sectionQuestions.length}問</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="n2-progress-bar">
        <div className="n2-progress-fill" style={{ width: `${(answeredCount / totalQuestions) * 100}%` }} />
        <span className="n2-progress-text">{answeredCount} / {totalQuestions} 回答済み</span>
      </div>

      {/* View Mode Toggle */}
      <div className="n2-view-toggle">
        <button
          className={`view-toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
          onClick={() => setViewMode('all')}
        >
          全問題表示
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'single' ? 'active' : ''}`}
          onClick={() => setViewMode('single')}
        >
          1問ずつ表示
        </button>
      </div>

      {/* Start Quiz Button */}
      {!quizStarted && !submitted && (
        <div className="n2-start-overlay">
          <div className="n2-start-card">
            <h3>問題を開始しますか？</h3>
            <p>全 {totalQuestions} 問 ・ 制限時間 {formatTime(totalQuestions * 90)}</p>
            <div className="n2-start-sections">
              {questionsBySection.map(({ section, label, questions: sq }) =>
                sq.length > 0 ? (
                  <div key={section} className="n2-start-section-item">
                    <span>{label}</span><span>{sq.length}問</span>
                  </div>
                ) : null
              )}
            </div>
            <button className="n2-start-btn" onClick={handleStartQuiz}>スタート</button>
          </div>
        </div>
      )}

      {/* Main Question Area - Single View */}
      {viewMode === 'single' && currentQuestion && (
        <div className="n2-question-area">
          <div className="n2-nav-header">
            <button className="n2-nav-toggle" onClick={() => setShowNav(!showNav)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              問題一覧
            </button>
            <span className="n2-question-counter">第 {currentIndex + 1} 問 / 全 {totalQuestions} 問</span>
            <span className={`n2-difficulty-badge ${getDifficultyClass(currentQuestion.difficulty)}`}>
              {getDifficultyBadge(currentQuestion.difficulty)}
            </span>
          </div>

          {/* Question Navigation Panel */}
          {showNav && (
            <div className="n2-nav-panel">
              <div className="n2-nav-grid">
                {questions.map((_, idx) => {
                  const isAnswered = answers[idx] !== undefined;
                  const isCurrent = idx === currentIndex;
                  const isCorrectAnswer = submitted && isCorrect(idx);
                  const isWrongAnswer = submitted && !isCorrect(idx) && answers[idx] !== undefined;
                  let navClass = 'n2-nav-item';
                  if (isCurrent) navClass += ' current';
                  if (isAnswered) navClass += ' answered';
                  if (isCorrectAnswer) navClass += ' correct';
                  if (isWrongAnswer) navClass += ' wrong';
                  return (
                    <button key={idx} className={navClass} onClick={() => handleJumpTo(idx)}>
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="n2-nav-legend">
                <span className="legend-item"><span className="legend-dot current"></span>現在</span>
                <span className="legend-item"><span className="legend-dot answered"></span>回答済み</span>
                <span className="legend-item"><span className="legend-dot correct"></span>正解</span>
                <span className="legend-item"><span className="legend-dot wrong"></span>不正解</span>
              </div>
            </div>
          )}

          {/* Question Card */}
          <div className="n2-question-card">
            <div className="n2-question-header">
              <span className="n2-question-section-badge">{currentSectionLabel}</span>
              <span className="n2-question-number">問題 {currentIndex + 1}</span>
            </div>
            <div className="n2-question-text">{currentQuestion.questionText}</div>
            <div className="n2-options">
              {currentQuestion.options.map((opt, optIdx) => {
                const isSelected = answers[currentIndex] === optIdx;
                const isCorrectOption = submitted && opt === currentQuestion.correctAnswer;
                const isWrongSelected = submitted && isSelected && opt !== currentQuestion.correctAnswer;
                let optionClass = 'n2-option';
                if (isSelected && !submitted) optionClass += ' selected';
                if (isCorrectOption) optionClass += ' correct';
                if (isWrongSelected) optionClass += ' wrong';
                const optionId = `question-${currentIndex}-option-${optIdx}`;
                return (
                  <label key={optIdx} className={optionClass} htmlFor={optionId}>
                    <input 
                      type="radio" 
                      id={optionId}
                      name={`question-${currentIndex}`} 
                      checked={isSelected}
                      onChange={() => handleOptionSelect(optIdx)} 
                      disabled={submitted} 
                      className="n2-radio-input"
                    />
                    <span className="n2-radio-custom"></span>
                    <span className="n2-option-label">{getOptionLabel(optIdx)}</span>
                    <span className="n2-option-text">{opt}</span>
                  </label>
                );
              })}
            </div>

            {/* Result & Explanation */}
            {submitted && (
              <div className={`n2-result ${isCorrect(currentIndex) ? 'correct-result' : 'incorrect-result'}`}>
                <div className="n2-result-header">
                  <span className="n2-result-icon">{isCorrect(currentIndex) ? '✅' : '❌'}</span>
                  <span className="n2-result-text">{isCorrect(currentIndex) ? '正解！' : '不正解'}</span>
                </div>
                <p className="n2-correct-answer"><strong>正解:</strong> {currentQuestion.correctAnswer}</p>
                <div className="n2-explanation">
                  <strong>解説:</strong>
                  <p>{currentQuestion.explanation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="n2-navigation">
            <button className="n2-nav-btn prev" onClick={handlePrev} disabled={currentIndex === 0}>
              ← 前の問題
            </button>
            {!submitted && (
              <button className="n2-nav-btn submit" onClick={handleSubmit} disabled={!allAnswered}>
                採点する ({answeredCount}/{totalQuestions})
              </button>
            )}
            <button className="n2-nav-btn next" onClick={handleNext} disabled={currentIndex === totalQuestions - 1}>
              次の問題 →
            </button>
          </div>
        </div>
      )}

      {/* All Questions View */}
      {viewMode === 'all' && (
        <div className="n2-all-questions-view">
          {/* Add Question Button */}
          <div className="n2-add-question-container">
            <button className="n2-add-btn" onClick={() => setShowAddModal(true)}>
              <span className="add-icon">Add Question</span>
            </button>
          </div>

          {questionsBySection
            .filter(({ section }) => selectedSection === 'all' || selectedSection === section)
            .map(({ section, label, questions: sectionQuestions }) => {
            return (
              <div key={section} className="n2-section-block">
                <div className="n2-section-header" style={{ textAlign: 'center', display: 'block' }}>
                  <h3 style={{ textAlign: 'center', display: 'block', width: '100%', margin: '0 auto' }}>{label}</h3>
                </div>
                <div className="n2-questions-compact">
                  {sectionQuestions.length === 0 ? (
                    <div className="n2-empty-section">
                      <p>このセクションにはまだ問題がありません</p>
                      <p className="n2-empty-hint">+ ボタンをクリックして問題を追加してください</p>
                    </div>
                  ) : (
                    (() => {
                      let lastSubId: number | null | undefined = null;
                      let readingPassageShown = false;
                      let readingPassageText = '';
                      let readingQuestions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId10Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId11PassageShown = false;
                      let subId11PassageText = '';
                      let subId11Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId12PassageAText = '';
                      let subId12PassageBText = '';
                      let subId12Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId13PassageShown = false;
                      let subId13PassageText = '';
                      let subId13Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId14GridText = '';
                      let subId14Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      
                      // First pass: collect reading comprehension data
                      sectionQuestions.forEach((q) => {
                        if (q.sub_id === 9 && q.questionText && !readingPassageShown) {
                          readingPassageText = q.questionText;
                          readingPassageShown = true;
                        }
                        if (q.sub_id === 9) {
                          readingQuestions.push({ q, globalIndex: questions.indexOf(q) });
                        }
                        if (q.sub_id === 10) {
                          subId10Questions.push({ q, globalIndex: questions.indexOf(q) });
                        }
                        if (q.sub_id === 11 && q.questionText && !subId11PassageShown) {
                          const { passage } = parseSubId10Text(q.questionText);
                          if (passage) {
                            subId11PassageText = passage;
                            subId11PassageShown = true;
                          }
                        }
                        if (q.sub_id === 11) {
                          subId11Questions.push({ q, globalIndex: questions.indexOf(q) });
                        }
                        if (q.sub_id === 12) {
                          const { passageA, passageB } = parseSubId10Text(q.questionText);
                          if (passageA && !subId12PassageAText) subId12PassageAText = passageA;
                          if (passageB && !subId12PassageBText) subId12PassageBText = passageB;
                          subId12Questions.push({ q, globalIndex: questions.indexOf(q) });
                        }
                        if (q.sub_id === 13 && q.questionText && !subId13PassageShown) {
                          const { passage } = parseSubId10Text(q.questionText);
                          if (passage) {
                            subId13PassageText = passage;
                            subId13PassageShown = true;
                          }
                        }
                        if (q.sub_id === 13) {
                          subId13Questions.push({ q, globalIndex: questions.indexOf(q) });
                        }
                        if (q.sub_id === 14) {
                          // Extract grid from question text (format: "grid:..." or JSON with grid field)
                          try {
                            const parsed = JSON.parse(q.questionText);
                            if (parsed.grid && !subId14GridText) {
                              subId14GridText = parsed.grid;
                            }
                          } catch {
                            const gridMatch = q.questionText.match(/grid:\s*([\s\S]*)/i);
                            if (gridMatch && !subId14GridText) {
                              subId14GridText = gridMatch[1].trim();
                            }
                          }
                          subId14Questions.push({ q, globalIndex: questions.indexOf(q) });
                        }
                      });
                      
                      return sectionQuestions.map((q) => {
                        const globalIndex = questions.indexOf(q);
                        const currentSubId = q.sub_id;
                        const showSectionHeader = currentSubId !== lastSubId;
                        lastSubId = currentSubId;
                        
                        // For sub_id=9, show passage once, then show all options together
                        if (currentSubId === 9) {
                          // Only render once for the entire sub_id=9 group
                          if (globalIndex !== questions.indexOf(readingQuestions[0]?.q || q)) {
                            return null;
                          }
                          
                          return (
                            <div key={globalIndex}>
                              {showSectionHeader && currentSubId && (
                                <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                  {getSectionHeaderText(currentSubId)}
                                </div>
                              )}
                              {/* Show passage */}
                              {readingPassageText && (
                                <div className="n2-reading-passage" style={{ marginTop: '20px', padding: '20px', border: '2px solid #333', background: '#fff' }}>
                                  <span 
                                    className="n2-q-text-label"
                                    dangerouslySetInnerHTML={{ __html: parseFormattedText(readingPassageText) }}
                                  />
                                </div>
                              )}
                              {/* Show all questions' options */}
                              {readingQuestions.map((rq, rqIdx) => (
                                <div key={rq.globalIndex} className="n2-question-compact" style={{ marginTop: rqIdx === 0 ? '20px' : '0' }}>
                                  <div className="n2-question-line">
                                    <div className="n2-q-text-wrapper">
                                      <span className="n2-q-number">{rq.globalIndex + 1}) </span>
                                    </div>
                                  </div>
                                  <div className="n2-options-with-radio">
                                    {rq.q.options.map((opt, optIdx) => (
                                      <label key={optIdx} className="n2-option-with-radio">
                                        <input
                                          type="radio"
                                          name={`question-${rq.globalIndex}`}
                                          checked={answers[rq.globalIndex] === optIdx}
                                          onChange={() => {
                                            if (!submitted) {
                                              setAnswers((prev) => ({ ...prev, [rq.globalIndex]: optIdx }));
                                            }
                                          }}
                                          disabled={submitted}
                                          className="n2-radio-input"
                                        />
                                        <span className="n2-radio-custom"></span>
                                        <span className="n2-opt-num">{optIdx + 1}</span>
                                        <span 
                                          className="n2-opt-label"
                                          dangerouslySetInnerHTML={{ __html: parseFormattedText(opt) }}
                                        />
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        
                        // For sub_id=10, show passage once, then show questions with (1), (2) labels
                        if (currentSubId === 10) {
                          // Only render once for the entire sub_id=10 group
                          if (globalIndex !== questions.indexOf(subId10Questions[0]?.q || q)) {
                            return null;
                          }
                          
                          return (
                            <div key={globalIndex}>
                              {showSectionHeader && currentSubId && (
                                <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                  {getSectionHeaderText(currentSubId)}
                                </div>
                              )}
                              {/* Show all questions with (1), (2) labels */}
                              {subId10Questions.map((rq, rqIdx) => {
                                const { info, passage, warning, question } = parseSubId10Text(rq.q.questionText);
                                return (
                                  <div key={rq.globalIndex}>
                                    {/* Show (1), (2) label centered */}
                                    <div style={{ textAlign: 'center', margin: rqIdx === 0 ? '20px 0 16px 0' : '32px 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                                      ({rqIdx + 1})
                                    </div>
                                    {/* Show info text before passage */}
                                    {info && (
                                      <div style={{ marginBottom: '12px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333', fontStyle: 'italic' }}>
                                        {parseFormattedText(info)}
                                      </div>
                                    )}
                                    {/* Show passage for this question */}
                                    {passage && (
                                      <div style={{ marginBottom: '12px', padding: '20px', border: '3px solid #000', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'inherit', fontSize: '15px', lineHeight: '1.8' }}
                                          dangerouslySetInnerHTML={{ __html: parseFormattedText(passage) }}
                                        />
                                      </div>
                                    )}
                                    {/* Show warning text after passage */}
                                    {warning && (
                                      <div style={{ marginBottom: '16px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333' }}
                                        dangerouslySetInnerHTML={{ __html: parseFormattedText(warning) }}
                                      />
                                    )}
                                    <div className="n2-question-compact" style={{ marginTop: '0' }}>
                                      <div className="n2-question-line">
                                        <div className="n2-q-text-wrapper">
                                          <span className="n2-q-number">{rq.globalIndex + 1}) </span>
                                          <span className="n2-q-text-label">
                                            {question ? parseFormattedText(question) : ''}
                                          </span>
                                        </div>
                                      </div>
                                      <div className={`n2-options-with-radio ${currentSubId === 10 ? 'n2-usage-options' : ''}`} style={currentSubId === 10 ? { flexDirection: 'column', alignItems: 'flex-start' } : {}}>
                                        {rq.q.options.map((opt, optIdx) => (
                                          <label key={optIdx} className={`n2-option-with-radio ${currentSubId === 10 ? 'n2-usage-option' : ''}`} style={currentSubId === 10 ? { width: '100%', minWidth: 'auto' } : {}}>
                                            <input
                                              type="radio"
                                              name={`question-${rq.globalIndex}`}
                                              checked={answers[rq.globalIndex] === optIdx}
                                              onChange={() => {
                                                if (!submitted) {
                                                  setAnswers((prev) => ({ ...prev, [rq.globalIndex]: optIdx }));
                                                }
                                              }}
                                              disabled={submitted}
                                              className="n2-radio-input"
                                            />
                                            <span className="n2-radio-custom"></span>
                                            <span className="n2-opt-num">{optIdx + 1}</span>
                                            <span 
                                              className="n2-opt-label"
                                              dangerouslySetInnerHTML={{ __html: parseFormattedText(opt) }}
                                            />
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        
                        // For sub_id=11, same as sub_id=10 but with 2 questions per part
                        if (currentSubId === 11) {
                          if (globalIndex !== questions.indexOf(subId11Questions[0]?.q || q)) {
                            return null;
                          }
                          return (
                            <div key={globalIndex}>
                              {showSectionHeader && currentSubId && (
                                <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                  {getSectionHeaderText(currentSubId)}
                                </div>
                              )}
                              {subId11Questions.map((rq, rqIdx) => {
                                const { passage, info, warning, question } = parseSubId10Text(rq.q.questionText);
                                const partNumber = Math.floor(rqIdx / 2) + 1;
                                const isPartStart = rqIdx % 2 === 0;
                                return (
                                  <div key={rq.globalIndex}>
                                    {isPartStart && (
                                      <div style={{ textAlign: 'center', margin: rqIdx === 0 ? '20px 0 16px 0' : '32px 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                                        ({partNumber})
                                      </div>
                                    )}
                                    {info && (
                                      <div style={{ marginBottom: '12px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333', fontStyle: 'italic' }}>
                                        {parseFormattedText(info)}
                                      </div>
                                    )}
                                    {isPartStart && passage && (
                                      <div style={{ marginBottom: '16px', padding: '20px', border: '3px solid #000', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'inherit', fontSize: '15px', lineHeight: '1.8' }}
                                          dangerouslySetInnerHTML={{ __html: parseFormattedText(passage) }}
                                        />
                                      </div>
                                    )}
                                    {warning && (
                                      <div style={{ marginBottom: '16px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333' }}
                                        dangerouslySetInnerHTML={{ __html: parseFormattedText(warning) }}
                                      />
                                    )}
                                    <div className="n2-question-compact" style={{ marginTop: '0' }}>
                                      <div className="n2-question-line">
                                        <div className="n2-q-text-wrapper">
                                          <span className="n2-q-number">{rq.globalIndex + 1}) </span>
                                          <span className="n2-q-text-label">{question ? parseFormattedText(question) : ''}</span>
                                        </div>
                                      </div>
                                      <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        {rq.q.options.map((opt, optIdx) => (
                                          <label key={optIdx} className="n2-option-with-radio" style={{ width: '100%', minWidth: 'auto' }}>
                                            <input type="radio" name={`question-${rq.globalIndex}`} checked={answers[rq.globalIndex] === optIdx} onChange={() => { if (!submitted) { setAnswers((prev) => ({ ...prev, [rq.globalIndex]: optIdx })); } }} disabled={submitted} className="n2-radio-input" />
                                            <span className="n2-radio-custom"></span>
                                            <span className="n2-opt-num">{optIdx + 1}</span>
                                            <span className="n2-opt-label" dangerouslySetInnerHTML={{ __html: parseFormattedText(opt) }} />
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        
                        // For sub_id=12, same as sub_id=11 but with passageA and passageB
                        if (currentSubId === 12) {
                          if (globalIndex !== questions.indexOf(subId12Questions[0]?.q || q)) {
                            return null;
                          }
                          return (
                            <div key={globalIndex}>
                              {showSectionHeader && currentSubId && (
                                <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                  {getSectionHeaderText(currentSubId)}
                                </div>
                              )}
                              {subId12PassageAText && (
                                <div style={{ marginBottom: '12px' }}>
                                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>【A】</div>
                                  <div style={{ padding: '20px', border: '3px solid #000', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'inherit', fontSize: '15px', lineHeight: '1.8' }}
                                      dangerouslySetInnerHTML={{ __html: parseFormattedText(subId12PassageAText) }}
                                    />
                                  </div>
                                </div>
                              )}
                              {subId12PassageBText && (
                                <div style={{ marginBottom: '16px' }}>
                                  <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#333' }}>【B】</div>
                                  <div style={{ padding: '20px', border: '3px solid #000', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'inherit', fontSize: '15px', lineHeight: '1.8' }}
                                      dangerouslySetInnerHTML={{ __html: parseFormattedText(subId12PassageBText) }}
                                    />
                                  </div>
                                </div>
                              )}
                              {subId12Questions.map((rq) => {
                                const { info, warning, question } = parseSubId10Text(rq.q.questionText);
                                return (
                                  <div key={rq.globalIndex}>
                                    {info && (
                                      <div style={{ marginBottom: '12px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333', fontStyle: 'italic' }}>
                                        {parseFormattedText(info)}
                                      </div>
                                    )}
                                    {warning && (
                                      <div style={{ marginBottom: '16px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333' }}
                                        dangerouslySetInnerHTML={{ __html: parseFormattedText(warning) }}
                                      />
                                    )}
                                    <div className="n2-question-compact" style={{ marginTop: '0' }}>
                                      <div className="n2-question-line">
                                        <div className="n2-q-text-wrapper">
                                          <span className="n2-q-number">{rq.globalIndex + 1}) </span>
                                          <span className="n2-q-text-label">{question ? parseFormattedText(question) : ''}</span>
                                        </div>
                                      </div>
                                      <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        {rq.q.options.map((opt, optIdx) => (
                                          <label key={optIdx} className="n2-option-with-radio" style={{ width: '100%', minWidth: 'auto' }}>
                                            <input type="radio" name={`question-${rq.globalIndex}`} checked={answers[rq.globalIndex] === optIdx} onChange={() => { if (!submitted) { setAnswers((prev) => ({ ...prev, [rq.globalIndex]: optIdx })); } }} disabled={submitted} className="n2-radio-input" />
                                            <span className="n2-radio-custom"></span>
                                            <span className="n2-opt-num">{optIdx + 1}</span>
                                            <span className="n2-opt-label" dangerouslySetInnerHTML={{ __html: parseFormattedText(opt) }} />
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        
                        // For sub_id=13, same as sub_id=11 but with 3 questions
                        if (currentSubId === 13) {
                          if (globalIndex !== questions.indexOf(subId13Questions[0]?.q || q)) {
                            return null;
                          }
                          const firstQuestionData = subId13Questions[0] ? parseSubId10Text(subId13Questions[0].q.questionText) : null;
                          return (
                            <div key={globalIndex}>
                              {showSectionHeader && currentSubId && (
                                <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                  {getSectionHeaderText(currentSubId)}
                                </div>
                              )}
                              {firstQuestionData?.info && (
                                <div style={{ marginTop: '20px', marginBottom: '12px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333', fontStyle: 'italic' }}>
                                  {parseFormattedText(firstQuestionData.info)}
                                </div>
                              )}
                              {subId13PassageText && (
                                <div style={{ marginBottom: '16px', padding: '20px', border: '3px solid #000', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontFamily: 'inherit', fontSize: '15px', lineHeight: '1.8' }}
                                    dangerouslySetInnerHTML={{ __html: parseFormattedText(subId13PassageText) }}
                                  />
                                </div>
                              )}
                              {subId13Questions.map((rq) => {
                                const { warning, question } = parseSubId10Text(rq.q.questionText);
                                return (
                                  <div key={rq.globalIndex}>
                                    {warning && (
                                      <div style={{ marginBottom: '16px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333' }}
                                        dangerouslySetInnerHTML={{ __html: parseFormattedText(warning) }}
                                      />
                                    )}
                                    <div className="n2-question-compact" style={{ marginTop: '0' }}>
                                      <div className="n2-question-line">
                                        <div className="n2-q-text-wrapper">
                                          <span className="n2-q-number">{rq.q.number}) </span>
                                          <span className="n2-q-text-label">{question ? parseFormattedText(question) : ''}</span>
                                        </div>
                                      </div>
                                      <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        {rq.q.options.map((opt, optIdx) => (
                                          <label key={optIdx} className="n2-option-with-radio" style={{ width: '100%', minWidth: 'auto' }}>
                                            <input type="radio" name={`question-${rq.globalIndex}`} checked={answers[rq.globalIndex] === optIdx} onChange={() => { if (!submitted) { setAnswers((prev) => ({ ...prev, [rq.globalIndex]: optIdx })); } }} disabled={submitted} className="n2-radio-input" />
                                            <span className="n2-radio-custom"></span>
                                            <span className="n2-opt-num">{optIdx + 1}</span>
                                            <span className="n2-opt-label" dangerouslySetInnerHTML={{ __html: parseFormattedText(opt) }} />
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }
                        
                        // For sub_id=14, questions first then grid
                        if (currentSubId === 14) {
                          if (globalIndex !== questions.indexOf(subId14Questions[0]?.q || q)) {
                            return null;
                          }
                          return (
                            <div key={globalIndex}>
                              {showSectionHeader && currentSubId && (
                                <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                  {getSectionHeaderText(currentSubId)}
                                </div>
                              )}
                              {subId14Questions.map((rq) => {
                                const { info, warning, question } = parseSubId10Text(rq.q.questionText);
                                return (
                                  <div key={rq.globalIndex}>
                                    {info && (
                                      <div style={{ marginBottom: '12px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333', fontStyle: 'italic' }}>
                                        {parseFormattedText(info)}
                                      </div>
                                    )}
                                    {warning && (
                                      <div style={{ marginBottom: '16px', padding: '12px 16px', fontSize: '15px', lineHeight: '1.8', color: '#333' }}
                                        dangerouslySetInnerHTML={{ __html: parseFormattedText(warning) }}
                                      />
                                    )}
                                    <div className="n2-question-compact" style={{ marginTop: '0' }}>
                                      <div className="n2-question-line">
                                        <div className="n2-q-text-wrapper">
                                          <span className="n2-q-number">{rq.q.number}) </span>
                                          <span className="n2-q-text-label">{question ? parseFormattedText(question) : ''}</span>
                                        </div>
                                      </div>
                                      <div style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        {rq.q.options.map((opt, optIdx) => (
                                          <label key={optIdx} className="n2-option-with-radio" style={{ width: '100%', minWidth: 'auto' }}>
                                            <input type="radio" name={`question-${rq.globalIndex}`} checked={answers[rq.globalIndex] === optIdx} onChange={() => { if (!submitted) { setAnswers((prev) => ({ ...prev, [rq.globalIndex]: optIdx })); } }} disabled={submitted} className="n2-radio-input" />
                                            <span className="n2-radio-custom"></span>
                                            <span className="n2-opt-num">{optIdx + 1}</span>
                                            <span className="n2-opt-label" dangerouslySetInnerHTML={{ __html: parseFormattedText(opt) }} />
                                          </label>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                              {
                                <div style={{ fontFamily: 'sans-serif', maxWidth: '750px', margin: '20px auto', padding: '24px', border: '2px solid #000', backgroundColor: '#fff', color: '#000' }}>

                                  {/* Title */}
                                  <h1 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 'bold', margin: '0 0 20px 0', paddingBottom: '10px', borderBottom: '1px solid #000' }}>
                                    秋原テニススクール入会案内
                                  </h1>

                                  {/* Course Info */}
                                  <div style={{ marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '15px', fontWeight: 'bold', borderLeft: '4px solid #000', paddingLeft: '8px', margin: '0 0 8px 0' }}>
                                      コース・クラスについて
                                    </h2>
                                    <p style={{ fontSize: '13px', lineHeight: '1.6', margin: '0 0 10px 0' }}>
                                      以下の四つのコースの中から、ご希望の曜日、時間のクラスをお選びいただけます。<br />
                                      曜日、時間については、別紙をご確認ください。中学生以上から受講が可能です。<br />
                                      各コースの 1 クラスの定員 : 10 名 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; レッスン時間 : 60 分
                                    </p>

                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }} border={1} cellPadding={8}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#f9f9f9' }}>
                                          <th style={{ textAlign: 'center', width: '50%' }}>コース</th>
                                          <th style={{ textAlign: 'center', width: '50%' }}>受講料 (週一回、一ヶ月分)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>A. 平日昼間 (初心者)</td>
                                          <td style={{ textAlign: 'center' }}>8,800 円</td>
                                        </tr>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>B. 平日昼間 (中・上級者)</td>
                                          <td style={{ textAlign: 'center' }}>12,000 円</td>
                                        </tr>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>C. 平日夜間・土日 (初心者)</td>
                                          <td style={{ textAlign: 'center' }}>9,300 円</td>
                                        </tr>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>D. 平日夜間・土日 (中・上級者)</td>
                                          <td style={{ textAlign: 'center' }}>12,500 円</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Payment Information */}
                                  <div style={{ marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '15px', fontWeight: 'bold', borderLeft: '4px solid #000', paddingLeft: '8px', margin: '0 0 8px 0' }}>
                                      入会時のお支払い
                                    </h2>
                                    <p style={{ fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                                      ご入会の際に、入会金 (6,600 円)、年会費 (2,200 円)、受講料 1 ヶ月分を現金でお支払いください。<br />
                                      受講料は、2 ヶ月目から口座引き落としになります。
                                    </p>
                                  </div>

                                  {/* Discount System */}
                                  <div style={{ marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '15px', fontWeight: 'bold', borderLeft: '4px solid #000', paddingLeft: '8px', margin: '0 0 8px 0' }}>
                                      割引制度
                                    </h2>
                                    <p style={{ fontSize: '13px', margin: '0 0 10px 0' }}>
                                      複数の割引は同時に適応できません。一番条件のいい割引が一つ適用されます。
                                    </p>

                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }} border={1} cellPadding={8}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#f9f9f9' }}>
                                          <th style={{ textAlign: 'center', width: '30%' }}>種類</th>
                                          <th style={{ textAlign: 'center', width: '35%' }}>適応対象</th>
                                          <th style={{ textAlign: 'center', width: '35%' }}>割引内容</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>学生割引</td>
                                          <td style={{ textAlign: 'center' }}>中学生、高校生</td>
                                          <td style={{ textAlign: 'center' }}>毎月の受講料を 10% 割引</td>
                                        </tr>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>複数のコース・クラス割引</td>
                                          <td style={{ textAlign: 'center' }}>複数コース・クラスを受講する方</td>
                                          <td style={{ textAlign: 'center' }}>二つ目以降のコース・クラス<br />毎月の受講料を 50% 割引</td>
                                        </tr>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>家族割引</td>
                                          <td style={{ textAlign: 'center' }}>ご家族に本スクールの受講生がいる方</td>
                                          <td style={{ textAlign: 'center' }}>入会金無料、毎月の受講料を 15% 割引</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>

                                  {/* Transfer Policy */}
                                  <div style={{ marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '15px', fontWeight: 'bold', borderLeft: '4px solid #000', paddingLeft: '8px', margin: '0 0 8px 0' }}>
                                      振り替え制度
                                    </h2>
                                    <p style={{ fontSize: '13px', margin: 0 }}>
                                      同じコースの他の曜日に振り替えて受講する場合フロントで事前にご予約ください。
                                    </p>
                                  </div>

                                  {/* Procedures */}
                                  <div style={{ marginBottom: '20px' }}>
                                    <h2 style={{ fontSize: '15px', fontWeight: 'bold', borderLeft: '4px solid #000', paddingLeft: '8px', margin: '0 0 8px 0' }}>
                                      各種手続き
                                    </h2>
                                    <p style={{ fontSize: '13px', margin: '0 0 10px 0' }}>
                                      以下の場合は、期日までにフロントでお手続きください。
                                    </p>

                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }} border={1} cellPadding={8}>
                                      <tbody>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>
                                            変更 (コースを変更したり、同じコース内で<br />曜日・時間を変更する場合)
                                          </td>
                                          <td style={{ textAlign: 'center' }}>変更したい月の前月 10 日まで</td>
                                        </tr>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>退会 (スクールをやめる場合)</td>
                                          <td style={{ textAlign: 'center' }}>最終受講の前月月末まで</td>
                                        </tr>
                                        <tr>
                                          <td style={{ textAlign: 'center' }}>休会 (スクールを 1 ヶ月以上休む場合)</td>
                                          <td style={{ textAlign: 'center' }}>休会したい月の前月 20 日まで</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                    <p style={{ fontSize: '12px', marginTop: '6px' }}>
                                      ※手数料 550 円がかかります (入会後 3 ヶ月以内に手続きをする場合は無料)。
                                    </p>
                                  </div>

                                  {/* Footer Contact Info */}
                                  <div style={{ borderTop: '1px solid #000', paddingTop: '12px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                    <div>
                                      電話 : 062-241-3998 (9 時〜22 時)
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                      〒433-0010 北高市朝中町 27<br />
                                      ホームページ : http://www.akiharayuukibui-tennis.jp
                                    </div>
                                  </div>

                                </div>
                              }
                            </div>
                          );
                        }
                        
                        return (
                          <div key={globalIndex}>
                            {showSectionHeader && currentSubId && (
                              <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                {getSectionHeaderText(currentSubId)}
                              </div>
                            )}
                            <div 
                              className={`n2-question-compact ${currentSubId === 6 ? 'n2-usage-question' : ''}`}
                              style={showSectionHeader ? { marginTop: '20px' } : undefined}
                            >
                              <div className="n2-question-line">
                                <div className="n2-q-text-wrapper">
                                <span className="n2-q-number">{globalIndex + 1}) </span>
                                  {currentSubId === 6 ? (
                                    <span 
                                      className="n2-target-word"
                                      dangerouslySetInnerHTML={{ __html: parseFormattedText(q.questionText) }}
                                    />
                                  ) : (
                                    <span 
                                      className="n2-q-text-label"
                                      dangerouslySetInnerHTML={{ __html: parseFormattedText(q.questionText) }}
                                    />
                                  )}
                                </div>
                              </div>
                              <div className={`n2-options-with-radio ${currentSubId === 6 ? 'n2-usage-options' : ''}`}>
                                {q.options.map((opt, optIdx) => {
                                  // For sub_id=6, extract target word and underline it in options
                                  const targetWord = currentSubId === 6 ? extractTargetWord(q.questionText) : '';
                                  const optionHtml = currentSubId === 6 
                                    ? parseOptionText(opt, targetWord)
                                    : parseFormattedText(opt);
                                  
                                  return (
                                    <label key={optIdx} className={`n2-option-with-radio ${currentSubId === 6 ? 'n2-usage-option' : ''}`}>
                                      <input
                                        type="radio"
                                        name={`question-${globalIndex}`}
                                        checked={answers[globalIndex] === optIdx}
                                        onChange={() => {
                                          if (!submitted) {
                                            setAnswers((prev) => ({ ...prev, [globalIndex]: optIdx }));
                                          }
                                        }}
                                        disabled={submitted}
                                        className="n2-radio-input"
                                      />
                                      <span className="n2-radio-custom"></span>
                                      <span className="n2-opt-num">{optIdx + 1}</span>
                                      <span 
                                        className="n2-opt-label"
                                        dangerouslySetInnerHTML={{ __html: optionHtml }}
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Question Modal */}
      {showAddModal && (
        <div className="n2-modal-overlay">
          <div className="n2-modal">
            <div className="n2-modal-header">
              <h3>新しい問題を追加</h3>
              <button className="n2-modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="n2-modal-body">
              <div className="n2-modal-field">
                <label>問題文:</label>
                <div className="n2-formatting-toolbar">
                  <button 
                    type="button"
                    className="n2-format-btn"
                    onClick={() => applyFormatting('text', 'bold')}
                    title="Bold (**text**)"
                  >
                    <strong>B</strong>
                  </button>
                  <button 
                    type="button"
                    className="n2-format-btn"
                    onClick={() => applyFormatting('text', 'underline')}
                    title="Underline (__text__)"
                  >
                    <u>U</u>
                  </button>
                  <button 
                    type="button"
                    className="n2-format-btn target-btn"
                    onClick={() => applyFormatting('text', 'target')}
                    title="Set as Target (bold + underline)"
                  >
                    <strong><u>T</u></strong>
                  </button>
                </div>
                <textarea
                  ref={textAreaRef}
                  value={newQuestion.text}
                  onChange={(e) => setNewQuestion({ ...newQuestion, text: e.target.value })}
                  placeholder="例: 建物の人口に警備の人がいます。"
                  rows={3}
                />
                <div className="n2-format-hint">
                  Tip: Select text and click B/U/T, or use **text** for bold, __text__ for underline. T button creates target format with bold+underline.
                </div>
              </div>
              <div className="n2-modal-field">
                <label>選択肢:</label>
                {newQuestion.options.map((opt, idx) => (
                  <div key={idx} className="n2-modal-option">
                    <span className="n2-modal-opt-num">{idx + 1}.</span>
                    <div className="n2-option-input-wrapper">
                      <div className="n2-formatting-toolbar small">
                        <button 
                          type="button"
                          className="n2-format-btn"
                          onClick={() => applyFormatting(`option-${idx}`, 'bold')}
                          title="Bold"
                        >
                          <strong>B</strong>
                        </button>
                        <button 
                          type="button"
                          className="n2-format-btn"
                          onClick={() => applyFormatting(`option-${idx}`, 'underline')}
                          title="Underline"
                        >
                          <u>U</u>
                        </button>
                      </div>
                      <input
                        ref={(el) => { optionRefs.current[idx] = el; }}
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...newQuestion.options];
                          newOpts[idx] = e.target.value;
                          setNewQuestion({ ...newQuestion, options: newOpts });
                        }}
                        placeholder={`選択肢${idx + 1}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="n2-modal-field">
                <label>正解:</label>
                <input
                  type="text"
                  value={newQuestion.answer}
                  onChange={(e) => setNewQuestion({ ...newQuestion, answer: e.target.value })}
                  placeholder="正解の選択肢番号 (1, 2, 3, または 4)"
                />
              </div>
            </div>
            <div className="n2-modal-footer">
              <button className="n2-modal-btn cancel" onClick={handleCloseModal}>キャンセル</button>
              <button className="n2-modal-btn ok" onClick={handleAddQuestion}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Score Summary */}
      {submitted && (
        <div className="n2-score-summary">
          <div className="n2-score-card">
            <div className="n2-score-icon">🏆</div>
            <div className="n2-score-details">
              <h3>結果発表</h3>
              <div className="n2-score-text">
                <span className="score-correct">{correctCount}</span>
                <span className="score-separator"> / </span>
                <span className="score-total">{totalQuestions}</span>
              </div>
              <div className="n2-score-percentage">{Math.round((correctCount / totalQuestions) * 100)}%</div>
              <div className="n2-score-verdict">
                {Math.round((correctCount / totalQuestions) * 100) >= 60
                  ? '🎉 合格ライン達成！'
                  : '📚 あと少し！頑張ってください！'}
              </div>
            </div>
          </div>
          <div className="n2-section-breakdown">
            <h4>セクション別結果</h4>
            {questionsBySection.map(({ section, label, questions: sq }) => {
              if (sq.length === 0) return null;
              const sectionCorrect = sq.filter((_, i) => {
                const globalIdx = questions.indexOf(sq[i]);
                return isCorrect(globalIdx);
              }).length;
              return (
                <div key={section} className="n2-section-result">
                  <span className="section-result-label">{label}</span>
                  <div className="section-result-bar">
                    <div className="section-result-fill" style={{ width: `${(sectionCorrect / sq.length) * 100}%` }} />
                  </div>
                  <span className="section-result-score">{sectionCorrect}/{sq.length}</span>
                </div>
              );
            })}
          </div>
          <div className="n2-score-actions">
            <button className="n2-retry-btn" onClick={handleRetry}>もう一度挑戦</button>
            {onReset && (
              <button className="n2-reset-btn" onClick={onReset}>新しいPDFをアップロード</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuestionFrame;