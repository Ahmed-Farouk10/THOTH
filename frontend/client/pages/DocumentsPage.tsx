import { useState, useEffect, useRef } from 'react';
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
  created_at: string;
}

export default function DocumentsPage() {
  const { user, isAuthenticated } = useAuth();
  const { subscribe, isConnected } = useWebSocket();
  const [summaryType, setSummaryType] = useState('detailed');
  const [isUploading, setIsUploading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processingDocs, setProcessingDocs] = useState<Set<string>>(new Set());

  // NEW: Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // NEW: Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk'>('single');
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // NEW: WebSocket subscription for instant updates
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    console.log('🔌 Subscribing to document.processed.v1 events via WebSocket');
    const unsubscribe = subscribe('document.processed.v1', (message) => {
      console.log('📄 Document processed event received!', message);

      // WebSocket is already user-specific (authenticated), so if we receive this event, it's for us
      console.log('✅ Refreshing documents instantly via WebSocket');
      fetchDocuments();
      setSuccessMessage('Document processing complete!');

      // Auto-dismiss success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
    });

    return unsubscribe;
  }, [isAuthenticated, user, subscribe]);

  // Polling as backup (reduced interval since WebSocket is primary)
  // Polling is our backup mechanism for reliability

  // NEW: Poll for PROCESSING documents with cache-busting
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    // Check if any documents are processing
    const hasProcessing = documents.some(doc => doc.status === 'PROCESSING');

    if (!hasProcessing) return; // No need to poll if nothing is processing

    console.log('📊 Polling enabled - documents are processing');
    let pollCount = 0;

    const pollInterval = setInterval(async () => {
      pollCount++;
      console.log(`🔄 Poll #${pollCount} - Fetching document updates...`);

      try {
        // Force fresh data by calling API directly with cache-busting
        await fetchDocuments();
        console.log('✅ Poll complete - documents refreshed');
      } catch (err) {
        console.error('❌ Poll error:', err);
      }
    }, 2000); // Check every 2 seconds (reduced from 3)

    return () => {
      console.log(`⏹️ Polling stopped after ${pollCount} attempts`);
      clearInterval(pollInterval);
    };
  }, [isAuthenticated, user, documents]); // Re-run when documents change

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchDocuments();
    }
  }, [isAuthenticated, user]);

  const fetchDocuments = async () => {
    try {
      const response = await api.getUserDocuments(user!.user_id);
      const docs = Array.isArray(response) ? response : (response as any)?.documents || [];
      const sortedDocs = docs.sort((a: Document, b: Document) => {
        if (a.status === 'UPLOADED' && b.status !== 'UPLOADED') return -1;
        if (a.status !== 'UPLOADED' && b.status === 'UPLOADED') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setDocuments(sortedDocs);
    } catch (err) {
      console.error('Failed to fetch documents', err);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let uploadedCount = 0;
      for (const file of files) {
        await api.uploadDocument(file);
        uploadedCount++;
      }
      setSuccessMessage(`Successfully uploaded ${uploadedCount} document(s). Ready to process.`);
      await fetchDocuments();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleProcess = async (docId: string) => {
    try {
      setProcessingDocs(prev => new Set(prev).add(docId));
      await api.triggerProcessing(docId);

      setDocuments(docs => docs.map(d =>
        d.id === docId ? { ...d, status: 'PROCESSING' } : d
      ));

      setSuccessMessage('Processing started. You will receive a notification when complete.');
    } catch (err: any) {
      setError(err.message || 'Failed to start processing');
      setProcessingDocs(prev => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
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
      setSelectedIds(new Set(documents.map(doc => doc.id)));
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
        await api.deleteDocument(singleDeleteId);
        setSuccessMessage('Document deleted successfully');
      } else if (deleteTarget === 'bulk') {
        for (const id of selectedIds) {
          await api.deleteDocument(id);
        }
        setSuccessMessage(`${selectedIds.size} document(s) deleted successfully`);
        setSelectedIds(new Set());
        setSelectAll(false);
      }
      await fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to delete document(s)');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setSingleDeleteId(null);
    }
  };

  const getDeleteModalMessage = () => {
    if (deleteTarget === 'single') {
      const doc = documents.find(d => d.id === singleDeleteId);
      return `Are you sure you want to delete "${doc?.filename}"?`;
    }
    return `Are you sure you want to delete the selected documents?`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '80px 20px',
      background: 'linear-gradient(135deg, var(--stone-dark) 0%, var(--stone-medium) 100%)'
    }}>
      <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            marginBottom: '20px',
            color: 'var(--gold-light)',
            textDecoration: 'none',
            fontSize: '1rem',
            padding: '8px 16px',
            border: '1px solid var(--gold-light)',
            borderRadius: 'var(--border-radius)',
            transition: 'all 0.3s ease'
          }}
        >
          ← Back to Home
        </Link>

        {!isAuthenticated ? (
          <LoginPrompt />
        ) : (
          <>
            <div style={{
              background: 'rgba(70, 62, 50, 0.6)',
              padding: '40px',
              borderRadius: 'var(--border-radius)',
              marginBottom: '30px',
              backdropFilter: 'blur(10px)',
              border: '1px solid var(--stone-light)'
            }}>
              <h1 style={{ color: 'var(--gold-light)', marginBottom: '10px', textAlign: 'center', fontSize: '2.5rem' }}>
                📜 Document Vault
              </h1>
              <p style={{ color: 'var(--papyrus-light)', textAlign: 'center', fontSize: '1.1rem' }}>
                Upload and manage your ancient scrolls
              </p>

              {/* Upload Section */}
              <div style={{
                marginTop: '30px',
                padding: '30px',
                background: 'rgba(44, 36, 22, 0.5)',
                borderRadius: 'var(--border-radius)',
                border: '2px dashed var(--gold-light)'
              }}>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  multiple
                  accept=".pdf,.txt,.doc,.docx"
                  style={{ display: 'none' }}
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  style={{
                    display: 'block',
                    padding: '20px',
                    background: isUploading ? 'rgba(75, 85, 99, 0.5)' : 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                    color: isUploading ? '#9ca3af' : 'var(--stone-dark)',
                    textAlign: 'center',
                    borderRadius: 'var(--border-radius)',
                    cursor: isUploading ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {isUploading ? '⏳ Uploading...' : '📤 Upload Documents'}
                </label>
              </div>

              {/* Status Messages */}
              {error && (
                <div style={{
                  marginTop: '20px',
                  padding: '15px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: 'var(--border-radius)',
                  color: '#f87171'
                }}>
                  ⚠️ {error}
                </div>
              )}

              {successMessage && (
                <div style={{
                  marginTop: '20px',
                  padding: '15px',
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.5)',
                  borderRadius: 'var(--border-radius)',
                  color: '#4ade80'
                }}>
                  ✓ {successMessage}
                </div>
              )}

              {/* Document List */}
              <div style={{ marginTop: '40px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  borderBottom: '1px solid var(--stone-light)',
                  paddingBottom: '10px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <h3 style={{ color: 'var(--gold-light)', fontSize: '1.5rem', margin: 0 }}>
                    Your Scrolls ({documents.length})
                  </h3>

                  {/* NEW: Bulk action toolbar */}
                  {documents.length > 0 && (
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

                {isUploading && documents.length === 0 ? (
                  <LoadingSpinner message="Uploading documents..." />
                ) : documents.length === 0 ? (
                  <p style={{ color: 'var(--papyrus-dark)', textAlign: 'center' }}>No scrolls found. Upload one to begin.</p>
                ) : (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    {documents.map((doc) => (
                      <div key={doc.id} style={{
                        background: 'rgba(44, 36, 22, 0.7)',
                        padding: '20px',
                        borderRadius: 'var(--border-radius)',
                        border: `2px solid ${selectedIds.has(doc.id) ? 'var(--gold-light)' : 'var(--stone-light)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '15px',
                        transition: 'all 0.2s ease'
                      }}>
                        {/* NEW: Checkbox for selection */}
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                          style={{
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer'
                          }}
                        />

                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <h4 style={{ color: 'var(--papyrus-light)', marginBottom: '5px' }}>{doc.filename}</h4>
                          <span style={{
                            fontSize: '0.8rem',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: doc.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.2)' :
                              doc.status === 'PROCESSING' ? 'rgba(234, 179, 8, 0.2)' :
                                doc.status === 'UPLOADED' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: doc.status === 'COMPLETED' ? '#4ade80' :
                              doc.status === 'PROCESSING' ? '#fde047' :
                                doc.status === 'UPLOADED' ? '#60a5fa' : '#f87171',
                            border: `1px solid ${doc.status === 'COMPLETED' ? 'rgba(34, 197, 94, 0.5)' :
                              doc.status === 'PROCESSING' ? 'rgba(234, 179, 8, 0.5)' :
                                doc.status === 'UPLOADED' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)'
                              }`
                          }}>
                            {doc.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          {doc.status === 'UPLOADED' && (
                            <button
                              onClick={() => handleProcess(doc.id)}
                              disabled={processingDocs.has(doc.id)}
                              style={{
                                background: 'linear-gradient(to right, var(--gold-light), var(--gold-medium))',
                                color: 'var(--stone-dark)',
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: 'var(--border-radius)',
                                cursor: processingDocs.has(doc.id) ? 'wait' : 'pointer',
                                fontWeight: 'bold',
                                opacity: processingDocs.has(doc.id) ? 0.7 : 1
                              }}
                            >
                              {processingDocs.has(doc.id) ? '⏳ Starting...' : '✨ Process'}
                            </button>
                          )}

                          {/* NEW: Custom delete with modal */}
                          <button
                            onClick={() => openDeleteSingle(doc.id)}
                            style={{
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              padding: '8px 12px',
                              border: '1px solid rgba(239, 68, 68, 0.5)',
                              borderRadius: 'var(--border-radius)',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                            }}
                            title="Delete Scroll"
                          >
                            🗑️
                          </button>

                          {doc.status === 'COMPLETED' && (
                            <Link to="/quiz" style={{
                              textDecoration: 'none',
                              color: 'var(--gold-light)',
                              fontSize: '0.9rem',
                              border: '1px solid var(--gold-light)',
                              padding: '6px 12px',
                              borderRadius: 'var(--border-radius)',
                              display: 'inline-block'
                            }}>
                              Generate Quiz
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* NEW: Delete Modal */}
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSingleDeleteId(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Document(s)"
        message={getDeleteModalMessage()}
        itemCount={deleteTarget === 'bulk' ? selectedIds.size : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
}
