// API Client for backend services
// All requests go through API Gateway at localhost:80

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost';
const TTS_SERVICE_URL = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost';
const USER_SERVICE_URL = import.meta.env.VITE_USER_SERVICE_URL || 'http://localhost';
const DOCUMENT_SERVICE_URL = import.meta.env.VITE_DOCUMENT_SERVICE_URL || 'http://localhost';
const QUIZ_SERVICE_URL = import.meta.env.VITE_QUIZ_SERVICE_URL || 'http://localhost';
const CHAT_SERVICE_URL = import.meta.env.VITE_CHAT_SERVICE_URL || 'http://localhost';

export class APIClient {
    private getHeaders(includeContentType = true): HeadersInit {
        const token = localStorage.getItem('thoth_auth_token');
        const headers: HeadersInit = {};

        if (includeContentType) {
            headers['Content-Type'] = 'application/json';
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return headers;
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
            throw new Error(error.detail || error.message || `HTTP ${response.status}`);
        }
        return response.json();
    }

    // Authentication
    async register(username: string, email: string, password: string) {
        const res = await fetch(`${USER_SERVICE_URL}/api/auth/register`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ username, email, password })
        });
        return this.handleResponse(res);
    }

    async login(username: string, password: string) {
        const res = await fetch(`${USER_SERVICE_URL}/api/auth/login`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ username, password })
        });
        return this.handleResponse(res);
    }

    // TTS Service
    async synthesizeSpeech(text: string, voice?: string): Promise<Blob> {
        const res = await fetch(`${TTS_SERVICE_URL}/api/tts/synthesize`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                text,
                voice: voice || 'default'
            })
        });

        if (!res.ok) {
            throw new Error(`TTS failed: ${res.status}`);
        }

        return res.blob();
    }

    async listVoices() {
        const res = await fetch(`${TTS_SERVICE_URL}/api/tts/voices`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(res);
    }

    // STT Service
    async transcribeAudio(audioBlob: Blob): Promise<{ transcription: string; confidence?: number }> {
        const formData = new FormData();

        // Determine file extension from mimetype
        const ext = audioBlob.type.includes('webm') ? 'webm' :
            audioBlob.type.includes('mp4') ? 'm4a' :
                audioBlob.type.includes('mpeg') ? 'mp3' :
                    audioBlob.type.includes('ogg') ? 'ogg' : 'wav';

        formData.append('audio', audioBlob, `recording.${ext}`);

        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`http://localhost/api/stt/transcribe`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                // Don't set Content-Type - browser will set it with boundary for FormData
            },
            body: formData
        });

        return this.handleResponse(res);
    }

    // Document Service
    async uploadDocument(file: File): Promise<{ document_id?: string; status: string; message: string }> {
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${DOCUMENT_SERVICE_URL}/api/documents/upload`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: formData
        });

        return this.handleResponse(res);
    }

    async triggerProcessing(documentId: string) {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${DOCUMENT_SERVICE_URL}/api/documents/${documentId}/process`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        return this.handleResponse(res);
    }

    async getDocumentStatus(documentId: string): Promise<{
        id: string;
        status: string;
        filename: string;
        s3_text_url?: string;
        s3_notes_url?: string;
    }> {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${DOCUMENT_SERVICE_URL}/api/documents/${documentId}`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        return this.handleResponse(res);
    }

    async getDocumentNotes(documentId: string): Promise<{
        document_id: string;
        notes_url: string;
        presigned_url: string;
    }> {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${DOCUMENT_SERVICE_URL}/api/documents/${documentId}/notes`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        return this.handleResponse(res);
    }

    async listDocuments(): Promise<{ documents: any[]; count: number }> {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${DOCUMENT_SERVICE_URL}/api/documents`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        return this.handleResponse(res);
    }

    // Quiz Service
    async getQuizzes(userId: string, documentId?: string): Promise<any[]> {
        const token = localStorage.getItem('thoth_auth_token');
        const params = new URLSearchParams({ user_id: userId });
        if (documentId) {
            params.append('document_id', documentId);
        }

        const res = await fetch(`${QUIZ_SERVICE_URL}/api/quizzes?${params}`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        return this.handleResponse(res);
    }

    async getQuiz(quizId: string): Promise<{
        id: string;
        title: string;
        document_id: string;
        questions: Array<{
            id: string;
            question_text: string;
            options: string[];
        }>;
        created_at: string;
    }> {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${QUIZ_SERVICE_URL}/api/quizzes/${quizId}`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });

        return this.handleResponse(res);
    }

    async submitQuizAnswer(
        quizId: string,
        questionId: string,
        selectedAnswerIndex: number,
        userId: string,
        addToNotes: boolean = false
    ): Promise<{
        is_correct: boolean;
        correct_answer_index: number;
        selected_answer: string;
        correct_answer: string;
        explanation: string;
        added_to_notes: boolean;
    }> {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${QUIZ_SERVICE_URL}/api/quizzes/${quizId}/submit?user_id=${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({
                question_id: questionId,
                selected_answer_index: selectedAnswerIndex,
                add_to_notes: addToNotes
            })
        });

        return this.handleResponse(res);
    }

    async generateQuizFromDocument(documentId: string, difficulty: string, userId: string) {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${QUIZ_SERVICE_URL}/api/quizzes/generate-from-document?document_id=${documentId}&difficulty=${difficulty}&user_id=${userId}`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
        });
        return this.handleResponse(res);
    }

    async generateQuizFromTopic(topic: string, difficulty: string, questionCount: number, userId: string) {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${QUIZ_SERVICE_URL}/api/quizzes/generate-from-topic?topic=${encodeURIComponent(topic)}&difficulty=${difficulty}&question_count=${questionCount}&user_id=${userId}`, {
            method: 'POST',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
        });
        return this.handleResponse(res);
    }

    // Chat Service

    async deleteDocument(documentId: string) {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${DOCUMENT_SERVICE_URL}/api/documents/${documentId}`, {
            method: 'DELETE',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        return this.handleResponse(res);
    }

    async deleteQuiz(quizId: string, userId: string) {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${QUIZ_SERVICE_URL}/api/quizzes/${quizId}?user_id=${userId}`, {
            method: 'DELETE',
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        return this.handleResponse(res);
    }

    // Chat History
    async getConversations(userId: string) {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${CHAT_SERVICE_URL}/api/chat/conversations?user_id=${userId}`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        return this.handleResponse(res);
    }

    async getChatMessages(conversationId: string, userId: string) {
        const token = localStorage.getItem('thoth_auth_token');
        const res = await fetch(`${CHAT_SERVICE_URL}/api/chat/messages/${conversationId}?user_id=${userId}`, {
            headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        });
        return this.handleResponse(res);
    }


    async sendChatMessage(
        userId: string,
        documentId: string,
        message: string,
        conversationId?: string
    ): Promise<{
        response: string;
        conversation_id: string;
        sources_count: number;
    }> {
        const res = await fetch(`${API_BASE_URL}/api/chat/message`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                user_id: userId,
                document_id: documentId,
                message: message,
                conversation_id: conversationId
            })
        });
        return this.handleResponse(res);
    }

    async getUserDocuments(userId: string) {
        const res = await fetch(`${DOCUMENT_SERVICE_URL}/api/documents?user_id=${userId}`, {
            headers: this.getHeaders()
        });
        return this.handleResponse(res);
    }
}

// Export singleton instance
export const api = new APIClient();
