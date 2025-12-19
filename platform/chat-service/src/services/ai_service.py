import os
import logging
from typing import List
import httpx
import google.generativeai as genai
from langchain_google_genai import GoogleGenerativeAIEmbeddings

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        # 1. Credential Resolution
        # Prioritize CHAT key, fallback to standard GOOGLE key
        self.api_key = os.getenv("CHAT_GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")
        
        if not self.api_key:
            logger.error("❌ API Key not found. Set CHAT_GOOGLE_API_KEY or GOOGLE_API_KEY.")
            return
        
        # Configure genai for model discovery
        genai.configure(api_key=self.api_key)
        
        # 2. Discover available models
        self.chat_model = "models/gemini-1.5-flash"  # Default
        try:
            logger.info("🔍 Discovering available Gemini models...")
            available_models = []
            for model in genai.list_models():
                if 'generateContent' in model.supported_generation_methods:
                    model_name = model.name
                    available_models.append(model_name)
                    # Prefer flash models
                    if 'flash' in model_name.lower() and '1.5' in model_name:
                        self.chat_model = model_name
                        logger.info(f"✨ Found Flash model: {self.chat_model}")
                        break
            
            if self.chat_model == "models/gemini-1.5-flash":
                # Try to find any flash model
                flash_models = [m for m in available_models if 'flash' in m.lower()]
                if flash_models:
                    self.chat_model = flash_models[0]
                    logger.info(f"✨ Using Flash model: {self.chat_model}")
                else:
                    # Fallback to pro if flash not available
                    pro_models = [m for m in available_models if 'pro' in m.lower() and '1.5' in m]
                    if pro_models:
                        self.chat_model = pro_models[0]
                        logger.warning(f"⚠️ Flash not available, using: {self.chat_model}")
                    else:
                        logger.warning(f"⚠️ Available models: {available_models[:5]}")
                        
        except Exception as e:
            logger.warning(f"⚠️ Model discovery failed ({e}). Using default: {self.chat_model}")
        
        # 3. Google API Configuration
        self.api_base = "https://generativelanguage.googleapis.com/v1beta"
        
        logger.info(f"✨ Initializing Chat Service with model: {self.chat_model}")
        
        try:
            # 4. Setup Embeddings (LangChain works fine for this)
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model="models/text-embedding-004",
                google_api_key=self.api_key
            )
            logger.info("✅ AI Service connected successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to Google AI: {e}")

    def get_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for a single text string."""
        if not text or not text.strip():
            return []
        clean_text = text.replace("\n", " ")
        return self.embeddings.embed_query(clean_text)

    def chat_with_context(self, query: str, context_chunks: List[str], history: List[dict] = None) -> str:
        """
        RAG: Answer query using provided context chunks and conversation history.
        Uses direct Google API (same approach as document service).
        """
        if history is None:
            history = []
        
        context_str = "\n\n".join(context_chunks)
        
        system_prompt = f"""You are a helpful AI tutor for a learning platform.
        Use the following pieces of retrieved context to answer the user's question.
        
        Context:
        {context_str}
        
        Instructions:
        1. Answer based strictly on the context provided.
        2. If the answer is not in the context, say "I couldn't find that specific information in the document." and offer general advice on the topic.
        3. Keep the answer concise and educational.
        4. Use conversation history to understand context and provide coherent follow-up answers.
        """
        
        # Build conversation history for the API
        contents = []
        
        # Add system instruction as first message
        contents.append({
            "role": "user",
            "parts": [{"text": system_prompt}]
        })
        contents.append({
            "role": "model",
            "parts": [{"text": "I understand. I'll use the provided context and conversation history to answer questions."}]
        })
        
        # Add conversation history (last 5 turns to avoid token limits)
        for msg in history[-5:]:
            role = "user" if msg["role"] == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })
        
        # Add current user query
        contents.append({
            "role": "user",
            "parts": [{"text": query}]
        })
        
        # Use direct Google API (same as document service)
        url = f"{self.api_base}/{self.chat_model}:generateContent"
        
        payload = {
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": 2048,
                "temperature": 0.7,
                "topP": 0.95,
                "topK": 40,
            },
        }
        
        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(url, params={"key": self.api_key}, json=payload)
                resp.raise_for_status()
                data = resp.json()
            
            candidates = data.get("candidates", [])
            if not candidates:
                raise RuntimeError("No candidates returned from Google model")
            
            parts = candidates[0].get("content", {}).get("parts", [])
            texts = [p.get("text", "") for p in parts if "text" in p]
            return "\n".join(texts).strip()
            
        except Exception as e:
            logger.error(f"Generation error: {e}")
            return "I'm having trouble generating a response right now. Please try again."


ai_service = AIService()
