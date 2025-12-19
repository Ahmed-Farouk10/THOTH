import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import LoginPrompt from '../components/LoginPrompt';
import { DeleteModal } from '../components/DeleteModal';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface Document {
  id: string;
  filename: string;
  status: string;
}

export default function QuizPage() {
  const { user, isAuthenticated } = useAuth();
  const { subscribe } = useWebSocket();
  const [mode, setMode] = useState<'document' | 'custom'>('document');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: number }>({});
  const [feedback, setFeedback] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // States for generating new quiz
  const [selectedDocId, setSelectedDocId] = useState('');
  const [genDifficulty, setGenDifficulty] = useState('Medium');

  // Custom mode states
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('novice');
  const [customQuestions, setCustomQuestions] = useState<any[] | null>(null);

  // NEW: Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // NEW: Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk'>('single');
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // NEW: WebSocket subscription for instant quiz updates
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    console.log('🔌 Subscribing to quiz.generated.v1 events via WebSocket');
    const unsubscribe = subscribe('quiz.generated.v1', (message) => {
      console.log('🧠 Quiz generated event received!', message);

      // WebSocket is already user-specific, so if we receive this event, it's for us
      console.log('✅ Refreshing quizzes instantly via WebSocket');
      fetchQuizzes();
      setSuccessMessage('Quiz generated successfully!');

      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    });

    return unsubscribe;
  }, [isAuthenticated, user, subscribe]);

  // Fetch quizzes and documents
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchQuizzes();
      fetchDocuments();
    }
  }, [isAuthenticated, user]);

  const fetchQuizzes = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getQuizzes(user.user_id);
      setQuizzes(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load quizzes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await api.getUserDocuments(user!.user_id);
      const docs = Array.isArray(response) ? response : (response as any)?.documents || [];
      setDocuments(docs.filter((d: Document) => d.status === 'COMPLETED'));
    } catch (err) {
      console.error('Failed to fetch documents', err);
    }
  };

  const loadQuiz = async (quizId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const quiz = await api.getQuiz(quizId);
      setSelectedQuiz(quiz);
      setCurrentQuestionIndex(0);
      setUserAnswers({});
      setFeedback(null);
      setQuizCompleted(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const submitAnswer = async (questionId: string, selectedIndex: number) => {
    if (!selectedQuiz || !user) return;

    setIsLoading(true);
    setError(null);
    try {
      const result = await api.submitQuizAnswer(
        selectedQuiz.id,
        questionId,
        selectedIndex,
        user.user_id,
        false
      );
      setFeedback(result);
      setUserAnswers({ ...userAnswers, [questionId]: selectedIndex });
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer');
    } finally {
      setIsLoading(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < selectedQuiz.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setFeedback(null);
    } else {
      setQuizCompleted(true);
    }
  };

  const backToQuizList = () => {
    setSelectedQuiz(null);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setFeedback(null);
    setQuizCompleted(false);
    fetchQuizzes();
  };

  const generateQuizFromDocument = async () => {
    if (!selectedDocId || !user) return;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await api.generateQuizFromDocument(selectedDocId, genDifficulty, user.user_id);
      setSuccessMessage('Quiz generation started! You will receive a notification when it is ready.');
      setSelectedDocId('');
      // We don't verify success immediately as it's async, but we can refresh listing
      setTimeout(fetchQuizzes, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to generate quiz');
    } finally {
      setIsLoading(false);
    }
  };

  // Custom quiz generation (direct return)
  const generateCustomQuiz = async () => {
    if (!topic.trim() || !user) return;

    setIsLoading(true);
    setError(null);
    try {
      const questionCount = difficulty === 'novice' ? 5 : difficulty === 'adept' ? 10 : 15;

      const quiz = await api.generateQuizFromTopic(
        topic,
        difficulty === 'novice' ? 'easy' : difficulty === 'adept' ? 'medium' : 'hard',
        questionCount,
        user.user_id
      );

      setSelectedQuiz(quiz);
      setMode('document'); // Switch to view it
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to generate quiz');
      setIsLoading(false);
    }
  };

  // NEW: Bulk selection functions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(quizzes.map(quiz => quiz.id)));
    }
    setSelectAll(!selectAll);
  };

  // NEW: Delete functions with modal
  const openDeleteSingle = (id: string) => {
    setSingleDeleteId(id);
    setDeleteTarget('single');
    setShowDeleteModal(true);
  };

  const openDeleteBulk = () => {
    setDeleteTarget('bulk');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteTarget === 'single' && singleDeleteId) {
        await api.deleteQuiz(singleDeleteId, user!.user_id);
        setSuccessMessage('Quiz deleted successfully');
      } else if (deleteTarget === 'bulk') {
        for (const id of selectedIds) {
          await api.deleteQuiz(id, user!.user_id);
        }
        setSuccessMessage(`${selectedIds.size} quizzes deleted successfully`);
        setSelectedIds(new Set());
        setSelectAll(false);
      }
      await fetchQuizzes();
    } catch (err: any) {
      setError(err.message || 'Failed to delete quiz(zes)');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSingleDeleteId(null);
    }
  };

  const getDeleteModalMessage = () => {
    if (deleteTarget === 'single') {
      const quiz = quizzes.find(q => q.id === singleDeleteId);
      return `Are you sure you want to delete "${quiz?.quiz_title || 'this quiz'}"?`;
    }
    return `Are you sure you want to delete the selected quizzes?`;
  };

  const currentQuestion = selectedQuiz?.questions[currentQuestionIndex];

  return (
    <div style={{
      minHeight: '100vh',
      padding: '80px 20px',
      background: 'linear-gradient(135deg, var(--stone-dark) 0%, var(--stone-medium) 100%)'
    }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        <Link
          to="/"
          className="back-btn"
          style={{
            background: 'transparent',
            color: 'var(--papyrus-light)',
            border: '2px solid var(--gold-light)',
            padding: '10px 20px',
            borderRadius: 'var(--border-radius)',
            cursor: 'pointer',
            fontSize: '1rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '30px',
            textDecoration: 'none',
            transition: 'all 0.3s ease'
          }}
        >
          ← Back to Temple
        </Link>

        <div className="service-header" style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: '3rem', color: 'var(--gold-light)', marginBottom: '20px', fontFamily: "'Palatino Linotype', 'Book Antiqua', serif" }}>
            🧠 Knowledge Trials
          </h2>
          <p style={{ color: 'var(--papyrus-light)', fontSize: '1.2rem' }}>Test your wisdom with divine quizzes</p>
        </div>

        {/* Mode Toggle */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
          <button
            onClick={() => setMode('document')}
            style={{
              background: mode === 'document' ? 'linear-gradient(to right, var(--gold-light), var(--gold-medium))' : 'transparent',
              color: mode === 'document' ? 'var(--stone-dark)' : 'var(--papyrus-light)',
              border: `2px solid var(--gold-light)`,
              padding: '12px 24px',
              borderRadius: 'var(--border-radius)',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            📜 Document Quizzes
          </button>
          <button
            onClick={() => setMode('custom')}
            style={{
              background: mode === 'custom' ? 'linear-gradient(to right, var(--gold-light), var(--gold-medium))' : 'transparent',
              color: mode === 'custom' ? 'var(--stone-dark)' : 'var(--papyrus-light)',
              border: `2px solid var(--gold-light)`,
              padding: '12px 24px',
              borderRadius: 'var(--border-radius)',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
              transition: 'all 0.3s ease'
            }}
          >
            ✍️ Custom Topic
          </button>
        </div>

        {error && (
          <div style={{
            background: 'rgba(220, 38, 38, 0.2)',
            border: '1px solid rgba(220, 38, 38, 0.5)',
            color: 'var(--papyrus-light)',
            padding: '15px',
            borderRadius: 'var(--border-radius)',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            ⚠️ {error}
          </div>
        )}

        {successMessage && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid rgba(34, 197, 94, 0.5)',
            color: 'var(--papyrus-light)',
            padding: '15px',
            borderRadius: 'var(--border-radius)',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            ✓ {successMessage}
          </div>
        )}

        {/* Document Quizzes Mode */}
        {mode === 'document' && (
          <>
            {!isAuthenticated ? (
              <div style={{ padding: '40px 20px', maxWidth: '600px', margin: '0 auto' }}>
                <LoginPrompt />
              </div>
            ) : selectedQuiz ? (
              // Quiz Taking Interface
              <div style={{
                background: 'linear-gradient(145deg, var(--stone-dark), var(--stone-medium))',
                padding: '40px',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--gold-light)',
                maxWidth: '900px',
                margin: '0 auto'
              }}>
                {quizCompleted ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎉</div>
                    <h3 style={{ color: 'var(--gold-light)', fontSize: '2rem', marginBottom: '20px' }}>
                      Quiz Completed!
                    </h3>
                    <p style={{ color: 'var(--papyrus-light)', fontSize: '1.2rem', marginBottom: '30px' }}>
                      You've answered all {selectedQuiz.questions.length} questions.
                    </p>
                    <button
                      onClick={backToQuizList}
                      style={{
                        background: 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                        color: 'var(--stone-dark)',
                        padding: '15px 30px',
                        fontSize: '1.1rem',
                        border: 'none',
                        borderRadius: 'var(--border-radius)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}
                    >
                      Back to Quizzes
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '30px' }}>
                      <h3 style={{ color: 'var(--gold-light)', fontSize: '1.5rem', marginBottom: '10px' }}>
                        {selectedQuiz.title}
                      </h3>
                      <p style={{ color: 'var(--papyrus-dark)' }}>
                        Question {currentQuestionIndex + 1} of {selectedQuiz.questions.length}
                      </p>
                    </div>

                    {currentQuestion && (
                      <div>
                        <h4 style={{ color: 'var(--papyrus-light)', fontSize: '1.3rem', marginBottom: '25px', lineHeight: '1.6' }}>
                          {currentQuestion.question_text}
                        </h4>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
                          {currentQuestion.options.map((option: string, idx: number) => (
                            <label
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                padding: '15px',
                                background: userAnswers[currentQuestion.id] === idx
                                  ? 'rgba(212, 175, 55, 0.2)'
                                  : 'rgba(44, 36, 22, 0.5)',
                                border: `2px solid ${userAnswers[currentQuestion.id] === idx ? 'var(--gold-light)' : 'var(--stone-light)'}`,
                                borderRadius: 'var(--border-radius)',
                                cursor: feedback ? 'not-allowed' : 'pointer',
                                transition: 'all 0.3s ease',
                                opacity: feedback ? 0.7 : 1
                              }}
                            >
                              <input
                                type="radio"
                                name={`question-${currentQuestion.id}`}
                                checked={userAnswers[currentQuestion.id] === idx}
                                onChange={() => !feedback && setUserAnswers({ ...userAnswers, [currentQuestion.id]: idx })}
                                disabled={!!feedback}
                                style={{ cursor: feedback ? 'not-allowed' : 'pointer', width: '20px', height: '20px' }}
                              />
                              <span style={{ color: 'var(--papyrus-light)', fontSize: '1.1rem' }}>{option}</span>
                            </label>
                          ))}
                        </div>

                        {feedback && (
                          <div style={{
                            background: feedback.is_correct ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            border: `1px solid ${feedback.is_correct ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
                            padding: '20px',
                            borderRadius: 'var(--border-radius)',
                            marginBottom: '20px'
                          }}>
                            <h4 style={{ color: 'var(--gold-light)', marginBottom: '10px', fontSize: '1.2rem' }}>
                              {feedback.is_correct ? '✅ Correct!' : '❌ Incorrect'}
                            </h4>
                            <p style={{ color: 'var(--papyrus-light)', marginBottom: '10px' }}>
                              <strong>Your answer:</strong> {feedback.selected_answer}
                            </p>
                            {!feedback.is_correct && (
                              <p style={{ color: 'var(--papyrus-light)', marginBottom: '10px' }}>
                                <strong>Correct answer:</strong> {feedback.correct_answer}
                              </p>
                            )}
                            <p style={{ color: 'var(--papyrus-light)', lineHeight: '1.6' }}>
                              <strong>Explanation:</strong> {feedback.explanation}
                            </p>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'space-between' }}>
                          <button
                            onClick={backToQuizList}
                            style={{
                              background: 'transparent',
                              color: 'var(--papyrus-light)',
                              border: '2px solid var(--stone-light)',
                              padding: '12px 24px',
                              borderRadius: 'var(--border-radius)',
                              cursor: 'pointer',
                              fontSize: '1rem',
                              fontWeight: 'bold'
                            }}
                          >
                            ← Back to List
                          </button>

                          {!feedback ? (
                            <button
                              onClick={() => submitAnswer(currentQuestion.id, userAnswers[currentQuestion.id])}
                              disabled={userAnswers[currentQuestion.id] === undefined || isLoading}
                              style={{
                                background: userAnswers[currentQuestion.id] !== undefined
                                  ? 'linear-gradient(to right, var(--gold-light), var(--gold-medium))'
                                  : 'rgba(109, 92, 69, 0.5)',
                                color: 'var(--stone-dark)',
                                padding: '12px 24px',
                                border: 'none',
                                borderRadius: 'var(--border-radius)',
                                cursor: userAnswers[currentQuestion.id] !== undefined && !isLoading ? 'pointer' : 'not-allowed',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase',
                                opacity: userAnswers[currentQuestion.id] !== undefined ? 1 : 0.5
                              }}
                            >
                              {isLoading ? '⏳ Submitting...' : '✓ Submit Answer'}
                            </button>
                          ) : (
                            <button
                              onClick={nextQuestion}
                              style={{
                                background: 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                                color: 'var(--stone-dark)',
                                padding: '12px 24px',
                                border: 'none',
                                borderRadius: 'var(--border-radius)',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                textTransform: 'uppercase'
                              }}
                            >
                              {currentQuestionIndex < selectedQuiz.questions.length - 1 ? 'Next Question →' : 'Finish Quiz'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              // Quiz List and Creation
              <div style={{
                background: 'linear-gradient(145deg, var(--stone-medium), var(--stone-dark))',
                padding: '40px',
                borderRadius: 'var(--border-radius)',
                border: '1px solid var(--stone-light)',
                minHeight: '400px'
              }}>
                {/* Create New Quiz Section */}
                <div style={{
                  marginBottom: '40px',
                  padding: '25px',
                  background: 'rgba(212, 175, 55, 0.05)',
                  borderRadius: 'var(--border-radius)',
                  border: '1px solid var(--gold-light)'
                }}>
                  <h3 style={{ color: 'var(--gold-light)', marginBottom: '15px' }}>✨ Generate New Quiz</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) 150px auto', gap: '15px', alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', color: 'var(--papyrus-light)', marginBottom: '5px' }}>From Document:</label>
                      <select
                        value={selectedDocId}
                        onChange={(e) => setSelectedDocId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'rgba(44, 36, 22, 0.7)',
                          color: 'var(--papyrus-light)',
                          border: '1px solid var(--stone-light)',
                          borderRadius: 'var(--border-radius)'
                        }}
                      >
                        <option value="">Select processed document...</option>
                        {documents.map(doc => (
                          <option key={doc.id} value={doc.id}>{doc.filename}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', color: 'var(--papyrus-light)', marginBottom: '5px' }}>Difficulty:</label>
                      <select
                        value={genDifficulty}
                        onChange={(e) => setGenDifficulty(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          background: 'rgba(44, 36, 22, 0.7)',
                          color: 'var(--papyrus-light)',
                          border: '1px solid var(--stone-light)',
                          borderRadius: 'var(--border-radius)'
                        }}
                      >
                        <option value="Easy">Beginner (5)</option>
                        <option value="Medium">Average (10)</option>
                        <option value="Hard">Hard (15)</option>
                      </select>
                    </div>
                    <button
                      onClick={generateQuizFromDocument}
                      disabled={!selectedDocId || isLoading}
                      style={{
                        padding: '10px 20px',
                        background: 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                        color: 'var(--stone-dark)',
                        border: 'none',
                        borderRadius: 'var(--border-radius)',
                        fontWeight: 'bold',
                        cursor: !selectedDocId || isLoading ? 'not-allowed' : 'pointer',
                        opacity: !selectedDocId || isLoading ? 0.6 : 1,
                        height: '42px'
                      }}
                    >
                      Generate
                    </button>
                  </div>
                </div>

                {/* NEW: Quiz list header with bulk actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <h3 style={{ color: 'var(--gold-light)', fontSize: '1.8rem', margin: 0 }}>
                    Your Document Quizzes ({quizzes.length})
                  </h3>

                  {/* Bulk action toolbar */}
                  {quizzes.length > 0 && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--papyrus-light)',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={toggleSelectAll}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        Select All
                      </label>

                      {selectedIds.size > 0 && (
                        <button
                          onClick={openDeleteBulk}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            padding: '8px 16px',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            borderRadius: 'var(--border-radius)',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '0.9rem'
                          }}
                        >
                          🗑️ Delete Selected ({selectedIds.size})
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isLoading ? (
                  <div style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{
                      display: 'inline-block',
                      width: '50px',
                      height: '50px',
                      border: '5px solid var(--gold-light)',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    <p style={{ color: 'var(--papyrus-light)', marginTop: '20px' }}>Loading quizzes...</p>
                  </div>
                ) : quizzes.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📚</div>
                    <p style={{ color: 'var(--papyrus-light)', fontSize: '1.2rem', marginBottom: '10px' }}>
                      No quizzes yet
                    </p>
                    <p style={{ color: 'var(--papyrus-dark)' }}>
                      Select a document above to generate a quiz!
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '20px' }}>
                    {quizzes.map((quiz) => (
                      <div
                        key={quiz.id}
                        style={{
                          background: 'rgba(44, 36, 22, 0.7)',
                          padding: '25px',
                          borderRadius: 'var(--border-radius)',
                          border: '1px solid var(--stone-light)',
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.borderColor = 'var(--gold-light)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.borderColor = 'var(--stone-light)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {/* NEW: Checkbox for bulk selection */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px' }}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(quiz.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelect(quiz.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '20px',
                              height: '20px',
                              cursor: 'pointer',
                              marginTop: '5px'
                            }}
                          />

                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <h4 style={{ color: 'var(--gold-light)', fontSize: '1.3rem', marginBottom: '10px' }}>
                                  {quiz.title}
                                </h4>
                                <p style={{ color: 'var(--papyrus-dark)', fontSize: '0.95rem', marginBottom: '5px' }}>
                                  📝 {quiz.questions.length} questions
                                </p>
                                <p style={{ color: 'var(--papyrus-dark)', fontSize: '0.85rem' }}>
                                  Created: {new Date(quiz.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadQuiz(quiz.id);
                                  }}
                                  style={{
                                    background: 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                                    color: 'var(--stone-dark)',
                                    padding: '10px 20px',
                                    border: 'none',
                                    borderRadius: 'var(--border-radius)',
                                    cursor: 'pointer',
                                    fontSize: '0.95rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  Take Quiz →
                                </button>
                                {/* NEW: Custom delete modal instead of confirm */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteSingle(quiz.id);
                                  }}
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    color: '#f87171',
                                    padding: '10px 14px',
                                    border: '1px solid rgba(239, 68, 68, 0.5)',
                                    borderRadius: 'var(--border-radius)',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                  }}
                                  title="Delete Quiz"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Custom Topic Mode (existing functionality) */}
        {mode === 'custom' && (
          <div className="service-content" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '40px',
            marginBottom: '50px'
          }}>
            <div className="service-form" style={{
              background: 'linear-gradient(145deg, var(--stone-dark), var(--stone-medium))',
              padding: '30px',
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--gold-light)'
            }}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: 'var(--papyrus-light)',
                  fontWeight: 'bold'
                }}>
                  Topic of Knowledge:
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--stone-light)',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: 'rgba(44, 36, 22, 0.7)',
                    color: 'var(--papyrus-light)',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                  placeholder="Enter topic (e.g., Egyptian Mythology, History)"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: 'var(--papyrus-light)',
                  fontWeight: 'bold'
                }}>
                  Difficulty Level:
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="form-control"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid var(--stone-light)',
                    borderRadius: 'var(--border-radius)',
                    backgroundColor: 'rgba(44, 36, 22, 0.7)',
                    color: 'var(--papyrus-light)',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                >
                  <option value="novice">Novice (5 questions)</option>
                  <option value="adept">Adept (10 questions)</option>
                  <option value="master">Master (15 questions)</option>
                </select>
              </div>

              <button
                onClick={generateCustomQuiz}
                disabled={isLoading || !topic.trim()}
                className="btn-primary"
                style={{
                  background: 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                  color: 'var(--stone-dark)',
                  padding: '15px 30px',
                  fontSize: '1.2rem',
                  boxShadow: 'var(--shadow)',
                  border: 'none',
                  borderRadius: 'var(--border-radius)',
                  cursor: isLoading || !topic.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 'bold',
                  width: '100%',
                  justifyContent: 'center',
                  opacity: isLoading || !topic.trim() ? 0.5 : 1
                }}
              >
                {isLoading ? '⏳ Generating...' : '❓ Generate Trial'}
              </button>
            </div>

            <div className="service-output" style={{
              background: 'linear-gradient(145deg, var(--stone-medium), var(--stone-dark))',
              padding: '30px',
              borderRadius: 'var(--border-radius)',
              border: '1px solid var(--stone-light)',
              minHeight: '300px',
              overflowY: 'auto'
            }}>
              <h3 style={{ color: 'var(--gold-light)', marginBottom: '20px', fontSize: '1.5rem' }}>
                Divine Trial
              </h3>
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{
                    display: 'inline-block',
                    width: '40px',
                    height: '40px',
                    border: '4px solid var(--gold-light)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '20px'
                  }} />
                  <p style={{ color: 'var(--papyrus-light)' }}>Thoth is preparing your knowledge trial...</p>
                </div>
              ) : customQuestions ? (
                <div>
                  <div style={{ marginBottom: '20px', padding: '15px', background: 'rgba(15, 76, 117, 0.3)', borderRadius: 'var(--border-radius)' }}>
                    <h4 style={{ color: 'var(--gold-light)', marginBottom: '10px' }}>
                      Knowledge Trial: {topic}
                    </h4>
                    <p style={{ color: 'var(--papyrus-light)', fontSize: '0.9rem' }}>
                      <strong>Difficulty:</strong> {difficulty.toUpperCase()} ({customQuestions.length} questions)
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {customQuestions.map((q) => (
                      <div key={q.id} style={{
                        background: 'rgba(44, 36, 22, 0.7)',
                        padding: '20px',
                        borderRadius: 'var(--border-radius)',
                        border: '1px solid var(--stone-light)'
                      }}>
                        <h4 style={{ color: 'var(--gold-light)', marginBottom: '15px', fontSize: '1.1rem' }}>
                          {q.id}. {q.question}
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                          {q.options.map((option: string, idx: number) => (
                            <label key={idx} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              cursor: 'pointer',
                              color: 'var(--papyrus-light)',
                              transition: 'color 0.3s ease'
                            }}>
                              <input
                                type="radio"
                                name={`question-${q.id}`}
                                style={{ cursor: 'pointer' }}
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button className="btn-primary" style={{
                      background: 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                      color: 'var(--stone-dark)',
                      padding: '15px 30px',
                      fontSize: '1rem',
                      boxShadow: 'var(--shadow)',
                      border: 'none',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      marginTop: '10px'
                    }}>
                      ✅ Submit Answers
                    </button>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--papyrus-dark)', textAlign: 'center', marginTop: '100px' }}>
                  Enter a topic and generate your trial
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* NEW: Delete confirmation modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title={deleteTarget === 'single' ? 'Delete Quiz' : 'Delete Quizzes'}
        message={getDeleteModalMessage()}
        itemCount={deleteTarget === 'bulk' ? selectedIds.size : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
