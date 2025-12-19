# THOTH - Intelligent AI Learning Platform

![THOTH Platform](https://img.shields.io/badge/AI-Platform-gold)
![Python](https://img.shields.io/badge/Python-3.11-blue)
![React](https://img.shields.io/badge/React-18-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-blue)

## 🪶 Overview

**THOTH** is an advanced AI-powered learning platform that combines document processing, intelligent chat, quiz generation, and speech capabilities. Named after the Egyptian god of wisdom and knowledge, THOTH provides a comprehensive suite of tools for knowledge management and interactive learning.

## ✨ Key Features

### 📚 Document Processing
- Upload and parse PDF, DOCX, TXT, and Markdown files
- Automatic text extraction and chunking
- Vector embeddings for semantic search
- Real-time processing status updates via WebSockets

### 💬 Divine Oracle (RAG Chat)
- Context-aware conversations with your documents
- Retrieval-Augmented Generation (RAG) using vector search
- Source citation and passage references
- Conversation history management

### 🧠 AI Quiz Generation
- Automatic quiz creation from uploaded documents
- Custom topic-based quiz generation
- Multiple question types (MCQ, True/False)
- Instant results and scoring

### 🎤 Speech Capabilities
- Text-to-Speech (TTS) for AI responses
- Speech-to-Text (STT) for voice input
- Multiple voice options

### 🔔 Real-time Notifications
- WebSocket-based instant updates
- Document processing completion alerts
- Quiz generation notifications

## 🏗️ Architecture

### Microservices
- **Frontend**: React + TypeScript + Vite
- **API Gateway**: Nginx reverse proxy
- **Aggregator Service**: FastAPI orchestration layer
- **User Service**: Authentication & user management
- **Document Service**: File processing & storage
- **Chat Service**: RAG-based conversational AI
- **Quiz Service**: AI quiz generation
- **STT/TTS Services**: Speech processing
- **Notification Service**: WebSocket event distribution

### Infrastructure
- **Database**: PostgreSQL (user data), MongoDB (documents/chats)
- **Message Queue**: Apache Kafka
- **Object Storage**: AWS S3 (LocalStack for development)
- **Vector Store**: Integrated with document chunks

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Git
- 8GB+ RAM recommended

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/THOTH.git
cd THOTH
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your API keys (OpenAI, Groq, etc.)
```

3. **Start the platform**
```bash
docker-compose up -d
```

4. **Access the application**
- Frontend: http://localhost
- API Gateway: http://localhost/api

### Environment Variables

Create a `.env` file with the following:

```env
# AI API Keys
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_groq_key

# Database
POSTGRES_USER=thoth_user
POSTGRES_PASSWORD=your_secure_password
MONGO_URI=mongodb://mongodb:27017

# AWS S3 (LocalStack for dev)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
S3_BUCKET_NAME=thoth-documents

# Services
FRONTEND_PORT=80
AGGREGATOR_PORT=8000
```

## 📁 Project Structure

```
THOTH/
├── frontend/              # React TypeScript frontend
│   ├── client/           # Source code
│   └── nginx.conf        # Nginx configuration
├── aggregator/           # API Gateway service
├── platform/
│   ├── user-service/     # User authentication
│   ├── chat-service/     # RAG chat functionality
│   ├── quiz-service/     # Quiz generation
│   ├── notification-service/  # WebSocket notifications
│   ├── stt-service/      # Speech-to-Text
│   └── tts-service/      # Text-to-Speech
├── documentreader/       # Document processing worker
├── nginx/                # Reverse proxy configuration
├── localstack_init/      # S3 initialization scripts
└── docker-compose.yml    # Service orchestration
```

## 🛠️ Development

### Running Services Individually

```bash
# Frontend only
docker-compose up frontend

# Backend services
docker-compose up aggregator user-service chat-service

# Rebuild after changes
docker-compose up -d --build SERVICE_NAME
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f chat-service
```

## 🎨 Frontend Features

- **Modern UI**: Glassmorphism design with Egyptian theming
- **Real-time Updates**: WebSocket integration for instant feedback
- **Bulk Actions**: Select and manage multiple items
- **Custom Modals**: Polished delete confirmations
- **Responsive Design**: Mobile-friendly interface

## 🔧 Technology Stack

### Frontend
- React 18
- TypeScript
- Vite
- Three.js (3D models)
- React Router
- Custom CSS with CSS Variables

### Backend
- Python 3.11
- FastAPI
- LangChain
- OpenAI API
- Groq API
- PostgreSQL
- MongoDB
- Apache Kafka

### DevOps
- Docker & Docker Compose
- Nginx
- LocalStack (S3 emulation)

## 📝 API Documentation

Once running, access the API documentation at:
- Aggregator: http://localhost/api/docs
- Individual services: http://localhost:PORT/docs

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Egyptian mythology for the inspiration
- OpenAI for GPT models
- Groq for fast inference
- The open-source community

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

**Built with ❤️ and ancient wisdom** 🪶
