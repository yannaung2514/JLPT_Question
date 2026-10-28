import { useState, useEffect, useCallback, useRef } from 'react';
import './QuestionFrame.css';

type N2Section = 'vocabulary' | 'grammar' | 'reading' | 'listening';

interface N2Question {
  id?: string;
  sub_id?: number;
  number?: number;
  section: N2Section;
  difficulty: 'easy' | 'medium' | 'hard' | string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  script?: string;
  photoUrl?: string;
}

const SECTION_LABELS: Record<N2Section, string> = {
  vocabulary: '語彙',
  grammar: '文法',
  reading: '読解',
  listening: '聴解',
};

interface QuestionFrameProps {
  questions: N2Question[];
  audioUrls?: Record<string, string>;
  onReset?: () => void;
}

function QuestionFrame({ questions, audioUrls, onReset }: QuestionFrameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: number }>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [showNav, setShowNav] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [selectedSection, setSelectedSection] = useState<N2Section | 'all'>('all');
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [openScriptId, setOpenScriptId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const sections: N2Section[] = ['vocabulary', 'grammar', 'reading', 'listening'];
  
  // Extract unique exam IDs from questions
  const uniqueExamIds = Array.from(new Set(questions.map(q => q.id).filter(Boolean))) as string[];
  
  // Default to first exam when '全部' is removed
  useEffect(() => {
    if (uniqueExamIds.length > 0 && (!selectedExam || !uniqueExamIds.includes(selectedExam))) {
      setSelectedExam(uniqueExamIds[0]);
    }
  }, [uniqueExamIds, selectedExam]);
  
  const currentAudioUrl = selectedSection === 'listening'
    ? (selectedExam ? audioUrls?.[selectedExam] : (uniqueExamIds.length > 0 ? audioUrls?.[uniqueExamIds[0]] : undefined))
    : undefined;

  // Audio URL for the question whose script popup is open
  const openedScriptQuestion = openScriptId !== null ? questions[openScriptId] : null;
  const scriptAudioUrl = openedScriptQuestion?.section === 'listening'
    ? (openedScriptQuestion.id ? audioUrls?.[String(openedScriptQuestion.id)] : (uniqueExamIds.length > 0 ? audioUrls?.[uniqueExamIds[0]] : undefined))
    : undefined;

  // Reset audio state when URL changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAudioError(false);
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [currentAudioUrl]);

  const handleTogglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => setAudioError(true));
    }
  };

  const skipBackward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, audio.currentTime - 10);
    setCurrentTime(audio.currentTime);
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(duration || audio.duration || 0, audio.currentTime + 10);
    setCurrentTime(audio.currentTime);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  const formatAudioTime = (s: number) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  
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
      const matchesExam = !selectedExam || q.id === selectedExam;
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
      if (parsed.text) {
        let jsonText = String(parsed.text);
        jsonText = jsonText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        jsonText = jsonText.replace(/__(.+?)__/g, '<u>$1</u>');
        return jsonText.replace(/\n/g, '<br/>').replace(/\t/g, '\u3000\u3000');
      }
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

  // Listening (聴解) section headers based on sub_id
  const LISTENING_SECTION_HEADERS: Record<number, { title: string; header: string }> = {
    1: { title: '問題１', header: '問題１では、まず質問を聞いてください。それから話を聞いて、問題用紙の１から４の中から最もよいものを一つ選んでください。' },
    2: { title: '問題２', header: '問題２では、まず質問を聞いてください。そのあと、問題用紙のせんたくしを読んでください。読む時間があります。それから話を聞いて、問題用紙の１から４の中から、最もよいものを一つ選んでください。' },
    3: { title: '問題３', header: '問題３では、問題用紙に何も印刷されていません。この問題は、全体としてどんな内容かを聞く問題です。話の前に質問はありません。まず話を聞いてください。それから、質問とせんたくしを聞きする返事を聞いてから３の中から、最もよいものを一つ選んでください。' },
    4: { title: '問題４', header: '問題４では、問題用紙に何も印刷されていません。まず文を聞いてください。それから、それに対する答えを１から３の中から、最もよいものを一つ選んでください。' },
    5: { title: '問題５', header: '問題５では、長めの話を聞きます。この問題には練習はありません。問題用紙にメモをとってもかまいません。' }
  };

  // Compute sub_id=9 question number range from DB number column (filtered by selected exam)
  const subId9Numbers = questions
    .filter((q) => q.sub_id === 9 && q.id === (selectedExam || uniqueExamIds[0]))
    .map((q) => q.number)
    .filter((n): n is number => typeof n === 'number');
  const subId9Start = subId9Numbers.length > 0 ? Math.min(...subId9Numbers) : 48;
  const subId9End = subId9Numbers.length > 0 ? Math.max(...subId9Numbers) : 51;

  // Section header text mapping based on sub_id
  const getListeningSectionTitle = (subId: number): string => {
    return LISTENING_SECTION_HEADERS[subId]?.title || '';
  };
  const getSectionHeaderText = (subId: number, section?: N2Section): string => {
    if (section === 'listening') {
      return LISTENING_SECTION_HEADERS[subId]?.header || '';
    }
    if (subId === 9) {
      return `問題９ 次の文章を読んで・、文章全体の内容を考えて、${subId9Start}から${subId9End}の中に入る最もよいものを、1・2・3・4から一つ選びなさい。`;
    }
    const sectionHeaders: Record<number, string> = {
      1: '問題１______の語彙の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。',
      2: '問題２______の語彙の読み方として最もよいものを、1・2・3・4 から一つ選びなさい。',
      3: '問題３ ( )に人れるのに最もよいものを、1・2・3・4 から一つ選びなさい。',
      4: '問題４ ( )に人れるのに最もよいものを、1・2・3・4 から一つ選びなさい。',
      5: '問題５ の言葉に意味が最も近いものを、1・2・3・4から一つ選びなさい。',
      6: '問題６ 次の言葉の使い方として最もよいものを、1・2・3・4 から一 つ選びなさい 。',
      7: '問題７ 次の文の ( ) に人れるのに最もよいものを、 1・2・3・4 から一つ選びなさい 。',
      8: '問題８ 次の文のに☆人る最もよいものを、 1・2・3・4 から一つ選びなさ い 。',
      10: '問題１０ 次の１から５の文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。',
      11: '問題１１ 次の１から３の文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。',
      12: '問題１２ 次のAとBの文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい',
      13: '問題１３次の文章を読んで、後の問いに対する答えとして最もよいものを、1・2・3・4からーっ選びなさい。',
      14: '問題１４ 右のべーシは、あるテニススクールの人会案内てある。下の問いに対する答えとして最もよいものを、1・2・3・4から一つ選びなさい。'
    };
    return sectionHeaders[subId] || '';
  };

  // 問題5 (sub_id=5) の 1番/2番/3番 ヘッダーを number 列から選択:
  // number=1 -> 1番, number=2 -> 2番, number=31/32 -> 3番
  // ヘッダーテキストは桁数で決定: 1桁 (1,2) -> 1桁用, 2桁 (31,32) -> 2桁用
  const getListeningSub5BangHeader = (number?: number): { title: string; header: string } | null => {
    if (number === undefined) return null;
    const bang = number >= 10 ? Math.floor(number / 10) : number;
    const isTwo = String(number).length === 2;
    return {
      title: `${bang}番`,
      header: isTwo
        ? 'まず話を聞いてください。それから、ニつの質問を聞いて、それぞれ問題用紙の1から4の中から最もよいものを一つ選んてください。'
        : '問題用紙に何もいんさっされていません。まず話をい聞いてください。それから、質問とせんたくしを聞いて、１から４の中から、最もよいものを一つ選んでください。',
    };
  };

  return (
    <div className="n2-frame">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={currentAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={() => setAudioError(true)}
        style={{ display: 'none' }}
      />
      {selectedSection === 'listening' && currentAudioUrl && !audioError && (
        <div className="n2-audio-player">
          <div className="n2-audio-controls">
            <button className="n2-audio-btn" onClick={skipBackward}>-10s</button>
            <button className="n2-audio-btn n2-audio-play" onClick={handleTogglePlay}>{isPlaying ? '⏸' : '▶'}</button>
            <button className="n2-audio-btn" onClick={skipForward}>+10s</button>
          </div>
          <input
            type="range"
            className="n2-audio-seekbar"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
          />
          <div className="n2-audio-time">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</div>
        </div>
      )}
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
              <span className="n2-question-number">問題 {currentQuestion.number ?? currentIndex + 1}</span>
            </div>
            <div className="n2-question-text" dangerouslySetInnerHTML={{ __html: parseFormattedText(currentQuestion.questionText) }} />
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
                    <span className="n2-option-text" dangerouslySetInnerHTML={{ __html: parseFormattedText(opt) }} />
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
                      let lastKey: string | null = null;
                      let lastBangTitle: string | null = null;
                      let sub5MainShown = false;
                      let readingPassageShown = false;
                      let readingPassageText = '';
                      let readingQuestions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId10Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId11PassageShown = false;
                      let subId11Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId12PassageAText = '';
                      let subId12PassageBText = '';
                      let subId12Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId13PassageShown = false;
                      let subId13PassageText = '';
                      let subId13Questions: { q: typeof sectionQuestions[0]; globalIndex: number }[] = [];
                      let subId14GridText = '';
                      let subId14PhotoUrl = '';
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
                          if (q.photoUrl && !subId14PhotoUrl) {
                            subId14PhotoUrl = q.photoUrl;
                          }
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
                        // For 問題5 (sub_id=5), group by digit length of number:
                        // 1 digit (1,2,3) -> group 5-1, 2 digits (31,32,33) -> group 5-2
                        let sub5Bang: number | null = null;
                        if (currentSubId === 5 && q.section === 'listening' && q.number != null) {
                          sub5Bang = String(q.number).length === 1 ? 1 : 2;
                        }
                        const groupKey = sub5Bang !== null ? `5-${sub5Bang}` : String(currentSubId);
                        const showSectionHeader = groupKey !== lastKey;
                        lastKey = groupKey;
                        
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
                                  {getSectionHeaderText(currentSubId, q.section)}
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
                                      <span className="n2-q-number">{rq.q.number ?? rq.globalIndex + 1}) </span>
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
                                  {getSectionHeaderText(currentSubId, q.section)}
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
                                          <span className="n2-q-number">{rq.q.number ?? rq.globalIndex + 1}) </span>
                                          <span className="n2-q-text-label" dangerouslySetInnerHTML={{ __html: question ? parseFormattedText(question) : '' }} />
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
                                  {getSectionHeaderText(currentSubId, q.section)}
                                </div>
                              )}
                              {(() => {
                                let partCounter = 0;
                                return subId11Questions.map((rq, rqIdx) => {
                                  const { passage, info, warning, question } = parseSubId10Text(rq.q.questionText);
                                  // Part boundary is determined by passage presence within the same (id, sub_id) group
                                  const isPartStart = !!passage;
                                  if (isPartStart) partCounter++;
                                  const partNumber = partCounter > 0 ? partCounter : 1;
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
                                          <span className="n2-q-number">{rq.q.number ?? rq.globalIndex + 1}) </span>
                                          <span className="n2-q-text-label" dangerouslySetInnerHTML={{ __html: question ? parseFormattedText(question) : '' }} />
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
                              });
                                })()}
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
                                  {getSectionHeaderText(currentSubId, q.section)}
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
                                          <span className="n2-q-number">{rq.q.number ?? rq.globalIndex + 1}) </span>
                                          <span className="n2-q-text-label" dangerouslySetInnerHTML={{ __html: question ? parseFormattedText(question) : '' }} />
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
                                  {getSectionHeaderText(currentSubId, q.section)}
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
                                          <span className="n2-q-number">{rq.q.number ?? rq.globalIndex + 1}) </span>
                                          <span className="n2-q-text-label" dangerouslySetInnerHTML={{ __html: question ? parseFormattedText(question) : '' }} />
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
                                  {getSectionHeaderText(currentSubId, q.section)}
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
                                          <span className="n2-q-number">{rq.q.number ?? rq.globalIndex + 1}) </span>
                                          <span className="n2-q-text-label" dangerouslySetInnerHTML={{ __html: question ? parseFormattedText(question) : '' }} />
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
                              {subId14PhotoUrl && (
                                <div className="n2-sub14-photo-wrapper">
                                  <img
                                    src={subId14PhotoUrl}
                                    alt="問題文の参考図（語彙 N2）"
                                    className="n2-sub14-photo"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        }
                        
                        return (
                          <div key={globalIndex}>
                            {currentSubId && q.section === 'listening' && currentSubId === 5 && (
                              <>
                                {(() => {
                                  const isFirstSub5 = !sub5MainShown;
                                  if (isFirstSub5) sub5MainShown = true;

                                  const bangHeader = getListeningSub5BangHeader(q.number);
                                  const bangTitle = bangHeader ? bangHeader.title : '';
                                  const shouldShowBang = isFirstSub5 || bangTitle !== lastBangTitle;
                                  lastBangTitle = bangTitle;

                                  return (
                                    <>
                                      {isFirstSub5 && (
                                        <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                          <div style={{ marginBottom: '5px' }}>問題５</div>
                                          <div style={{ marginBottom: '10px', fontWeight: 'normal', fontSize: '14px' }}>
                                            問題５では、長めの話を聞きます。この問題には練習はありません。問題用紙にメモをとってもかまいません。
                                          </div>
                                        </div>
                                      )}
                                      {bangHeader && shouldShowBang && (
                                        <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                          <div style={{ marginBottom: '5px' }}>{bangTitle}</div>
                                          {bangHeader.header && (
                                            <div style={{ marginBottom: '10px', fontSize: '14px' }}>{bangHeader.header}</div>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </>
                            )}
                            {currentSubId && q.section !== 'listening' && showSectionHeader && (
                              <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                {getSectionHeaderText(currentSubId, q.section)}
                              </div>
                            )}
                            {currentSubId && q.section === 'listening' && currentSubId !== 5 && showSectionHeader && (
                              <div className="n2-section-header-text" style={{ marginTop: '20px', fontWeight: 'bold', fontSize: '16px' }}>
                                <div style={{ marginBottom: '5px' }}>{getListeningSectionTitle(currentSubId)}</div>
                                {getSectionHeaderText(currentSubId, q.section)}
                              </div>
                            )}
                            {q.section === 'listening' && q.script && (
                              <button
                                className="n2-script-btn"
                                onClick={() => {
                                  setOpenScriptId(globalIndex);
                                  const qq = questions[globalIndex];
                                  if (qq?.section === 'listening') {
                                    setSelectedSection('listening');
                                    if (qq.id) setSelectedExam(String(qq.id));
                                  }
                                }}
                                style={{ marginTop: '10px', marginBottom: '10px' }}
                              >
                                スクリプト
                              </button>
                            )}
                            <div 
                              className={`n2-question-compact ${currentSubId === 6 ? 'n2-usage-question' : ''}`}
                              style={showSectionHeader ? { marginTop: '20px' } : undefined}
                            >
                              <div className="n2-question-line">
                                <div className="n2-q-text-wrapper">
                                <span className="n2-q-number">{currentSubId === 5 && q.section === 'listening' && q.number != null ? (q.number >= 10 ? q.number % 10 : q.number) : (q.number ?? globalIndex + 1)} </span>
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
                              {q.photoUrl && (
                                <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                                  <img src={q.photoUrl} alt="question" style={{ maxWidth: '300px', maxHeight: '300px', height: 'auto', width: 'auto' }} />
                                </div>
                              )}
                              <div className={`n2-options-with-radio ${(currentSubId === 6 || (q.section === 'listening' && (currentSubId === 1 || currentSubId === 2))) ? 'n2-usage-options' : (q.section === 'listening' && (currentSubId === 3 || currentSubId === 4)) ? 'n2-listening-sub3-options' : ''}`}>
                                {q.options.map((opt, optIdx) => {
                                  // For sub_id=6, extract target word and underline it in options
                                  const targetWord = currentSubId === 6 ? extractTargetWord(q.questionText) : '';
                                  const optionHtml = currentSubId === 6 
                                    ? parseOptionText(opt, targetWord)
                                    : parseFormattedText(opt);
                                  
                                  return (
                                    <label key={optIdx} className={`n2-option-with-radio ${(currentSubId === 6 || (q.section === 'listening' && (currentSubId === 1 || currentSubId === 2))) ? 'n2-usage-option' : (q.section === 'listening' && (currentSubId === 3 || currentSubId === 4)) ? 'n2-listening-sub3-option' : ''}`}>
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
                                      {currentSubId === 5 && q.section === 'listening' ? null : (
                                        <span className="n2-opt-num">{optIdx + 1}</span>
                                      )}
                                      {currentSubId !== 51 && !((q.section === 'listening') && (currentSubId === 3 || currentSubId === 4)) && (
                                        <span 
                                          className="n2-opt-label"
                                          dangerouslySetInnerHTML={{ __html: optionHtml }}
                                        />
                                      )}
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
      {openScriptId !== null && (
        <div className="n2-script-modal-overlay" onClick={() => setOpenScriptId(null)}>
          <div className="n2-script-modal" onClick={(e) => e.stopPropagation()}>
            <div className="n2-script-modal-header">
              <h3 className="n2-script-modal-title">スクリプト</h3>
              <button className="n2-script-close-btn" onClick={() => setOpenScriptId(null)}>×</button>
            </div>
            <div className="n2-script-modal-body">
              <p className="n2-script-text">
                {questions[openScriptId]?.script || 'スクリプトがありません'}
              </p>
            </div>
            {scriptAudioUrl && !audioError && (
              <div className="n2-script-audio-controls">
                <button className="n2-audio-btn" onClick={skipBackward}>-10s</button>
                <button className="n2-audio-btn n2-audio-play" onClick={handleTogglePlay}>{isPlaying ? '⏸' : '▶'}</button>
                <button className="n2-audio-btn" onClick={skipForward}>+10s</button>
                <div className="n2-script-audio-time">{formatAudioTime(currentTime)} / {formatAudioTime(duration)}</div>
                <input
                  type="range"
                  className="n2-audio-seekbar"
                  min={0}
                  max={duration || 0}
                  value={currentTime}
                  onChange={handleSeek}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuestionFrame;