import json
import logging
import os
import re
from typing import Dict, Any

import httpx
from pydantic import ValidationError

from schemas import QuizGenerated

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        # Load all available API keys (up to 6)
        all_keys = {}
        for key_num in ['', '_2', '_3', '_4', '_5', '_6']:
            key = os.getenv(f"GROQ_API_KEY{key_num}")
            if key:
                key_id = key_num.replace('_', '') or '1'
                all_keys[key_id] = key
        
        # Determine which key to start with (load balancing)
        primary_key = os.getenv("PRIMARY_GROQ_KEY", "1")
        
        # Reorder keys: primary key first, then others
        self.api_keys = []
        if primary_key in all_keys:
            self.api_keys.append(all_keys[primary_key])
            logger.info(f"🔑 Primary key: #{primary_key}")
        
        # Add remaining keys as fallbacks
        for key_id in sorted(all_keys.keys()):
            if key_id != primary_key and all_keys[key_id] not in self.api_keys:
                self.api_keys.append(all_keys[key_id])
        
        if not self.api_keys:
            logger.warning("No GROQ_API_KEY found; quiz generation will fail until configured.")
            self.api_token = None
        else:
            logger.info(f"AI Service initialized with {len(self.api_keys)} Groq API key(s), starting with key #{primary_key}")
        
        self.model_id = "llama-3.3-70b-versatile"  # Fast and reliable Groq model

    def _call_groq_api(self, prompt: str, max_tokens: int = 2048) -> str:
        """Call Groq API with automatic fallback across multiple API keys."""
        import time
        
        max_retries_per_key = 2  # Retries per key
        base_delay = 2  # seconds
        
        # Try each API key
        for key_index, api_key in enumerate(self.api_keys):
            for attempt in range(max_retries_per_key):
                try:
                    logger.info(f"Invoking Groq [{key_index+1}/{len(self.api_keys)}] attempt {attempt + 1}/{max_retries_per_key}...")
                    
                    url = "https://api.groq.com/openai/v1/chat/completions"
                    
                    payload = {
                        "model": self.model_id,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": max_tokens,
                        "temperature": 0.2,
                    }
                    
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    
                    with httpx.Client(timeout=60.0) as client:
                        resp = client.post(url, headers=headers, json=payload)
                        
                        # Handle rate limiting with exponential backoff
                        if resp.status_code == 429:
                            if attempt < max_retries_per_key - 1:
                                retry_delay = base_delay * (2 ** attempt)
                                logger.warning(f"Key {key_index+1} rate limited. Retrying in {retry_delay}s...")
                                time.sleep(retry_delay)
                                continue
                            else:
                                # Move to next key
                                logger.warning(f"Key {key_index+1} exhausted. Trying next key...")
                                break
                        
                        # Handle auth errors - move to next key immediately
                        if resp.status_code in [401, 403]:
                            logger.warning(f"Key {key_index+1} auth failed. Trying next key...")
                            break
                        
                        resp.raise_for_status()
                        data = resp.json()
                    
                    logger.info(f"✅ Success with key {key_index+1}")
                    return data['choices'][0]['message']['content']
                    
                except httpx.HTTPStatusError as e:
                    if e.response.status_code in [429, 401, 403] and (attempt < max_retries_per_key - 1 or key_index < len(self.api_keys) - 1):
                        continue
                    logger.error(f"Key {key_index+1} HTTP Error: {e}")
                    if key_index == len(self.api_keys) - 1:
                        raise
                except Exception as e:
                    logger.error(f"Key {key_index+1} Error: {e}")
                    if key_index == len(self.api_keys) - 1 and attempt == max_retries_per_key - 1:
                        raise
        
        raise Exception("All Groq API keys exhausted")

    def _extract_json_from_response(self, response_text: str) -> Dict[str, Any]:
        """Extract JSON from LLM response."""
        logger.debug(f"Raw text to parse: {response_text[:200]}...")
        
        # CRITICAL FIX: Remove control characters that break JSON parsing
        # Replace literal \n, \r, \t inside strings with spaces
        cleaned_text = response_text.strip()
        
        # Remove markdown code blocks if present
        if "```json" in cleaned_text:
            parts = cleaned_text.split("```json")
            if len(parts) > 1:
                cleaned_text = parts[1].split("```")[0].strip()
        elif "```" in cleaned_text:
            parts = cleaned_text.split("```")
            if len(parts) > 1:
                cleaned_text = parts[1].strip()
        
        # Additional cleanup: remove ```json or ``` wrappers
        if cleaned_text.startswith('```'):
            cleaned_text = re.sub(r'^```(?:json)?\s*\n?', '', cleaned_text)
            cleaned_text = re.sub(r'\n?```\s*$', '', cleaned_text)
        
        # Try to find JSON object
        json_match = re.search(r'\{[\s\S]*\}', cleaned_text)
        if json_match:
            json_str = json_match.group(0)
            
            # Remove NULL bytes
            json_str = json_str.replace('\x00', '')
            
            try:
                return json.loads(json_str, strict=False)
            except json.JSONDecodeError as e:
                # Try aggressive cleanup: replace problematic escape sequences
                logger.warning(f"Initial JSON parse failed: {e}. Trying cleanup...")
                
                # Fix common escape issues - replace invalid escapes with spaces
                import codecs
                try:
                    # Decode escape sequences properly
                    json_str_clean = json_str.encode('utf-8').decode('unicode_escape').encode('latin1').decode('utf-8')
                except:
                    # If that fails, just remove control characters
                    json_str_clean = re.sub(r'[\x00-\x1F\x7F]', ' ', json_str)
                
                try:
                    return json.loads(json_str_clean, strict=False)
                except json.JSONDecodeError as e2:
                    logger.error(f"JSON decode error after cleanup: {e2}")
                    logger.error(f"Original error: {e}")
                    logger.error(f"Problematic JSON (first 700 chars): {json_str[:700]}")
                    raise ValueError(f"Could not parse JSON: {e2}")
                logger.error(f"JSON decode error: {e}")
                logger.error(f"Problematic JSON string (first 500 chars): {json_str[:500]}")
                raise ValueError(f"Could not parse JSON: {e}")
        
        raise ValueError(f"Could not find valid JSON object. Response was: {cleaned_text[:200]}")

    def generate_quiz(self, text_content: str, difficulty: str = "Medium") -> QuizGenerated:
        """Generate quiz using Groq API."""
        if not self.api_keys:
            raise ValueError("GROQ_API_KEY not configured. Cannot generate quiz.")
        
        # Determine question count based on difficulty
        question_counts = {
            "easy": 5,
            "Easy": 5,
            "medium": 10,
            "Medium": 10,
            "hard": 15,
            "Hard": 15,
            "Expert": 20
        }
        question_count = question_counts.get(difficulty, 5)  # FIXED: Re-add this line
        
        # Normalize difficulty for consistency
        normalized_difficulty = difficulty.capitalize()
        if normalized_difficulty not in ["Easy", "Medium", "Hard", "Expert"]:
            normalized_difficulty = "Medium"
        
        # CRITICAL FIX: Detect if this is a custom topic (short prompt) vs document text
        is_custom_topic = len(text_content) < 200
        
        if is_custom_topic:
            # For custom topics, create a comprehensive quiz prompt
            topic = text_content.replace("Generate educational content about:", "").strip()
            safe_text = f"""Create a comprehensive quiz about the topic: {topic}

Generate {question_count} well-researched, educational multiple-choice questions about {topic}.
Each question should test understanding of key concepts, facts, and principles related to {topic}.

Requirements:
- Questions should be clear and unambiguous
- Options should be plausible but have one clearly correct answer
- Explanations should be educational and helpful
- Cover different aspects of {topic}"""
        else:
            # For document-based quizzes, use the existing approach
            safe_text = text_content[:8000]  # Groq can handle more tokens
        
        # Enhanced prompt with difficulty-based question count and detailed wrong answer guidance
        prompt = f"""You are an expert educational AI. Generate a quiz {"about the topic" if is_custom_topic else "based strictly on the provided text"}.

{"Topic" if is_custom_topic else "Text Content"}:

{safe_text}

Instructions:

1. Generate exactly {question_count} multiple-choice questions.

2. Difficulty Level: {normalized_difficulty}.
   - Easy: Basic recall and comprehension, straightforward questions
   - Medium: Application and analysis, moderate reasoning required
   - Hard: Synthesis, evaluation, complex reasoning, tricky edge cases
   - Expert: Advanced synthesis, critical evaluation, highly complex reasoning, often requiring inference beyond explicit text

3. Each question must have exactly 4 options.

4. Provide the correct answer index (0-3).

5. Provide a comprehensive explanation that includes:
   - Why the correct answer is right
   - Why each wrong answer is incorrect
   - Guidance to help understand the concept better
   - Hints or tips to remember this information

Format the explanation like this:
"Correct Answer: [Explain why this is right]

Wrong Answers:
- Option X is incorrect because [reason] 
- Option Y is incorrect because [reason]

Guidance: [Additional tips, memory aids, or clarification to help understand the concept]"

**CRITICAL FORMATTING RULES:**
1. Generate ONLY valid JSON - no extra text, no markdown, no code fences
2. Use straight quotes (") not curly quotes
3. Escape ALL quotes inside strings with backslash
4. Do NOT use newlines inside string values
5. Total response must be under 15,000 characters

Generate exactly {question_count} questions in this EXACT JSON format:

{{
  "title": "Quiz Title Here",
  "difficulty": "{normalized_difficulty}",
  "questions": [
    {{
      "question_text": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer_index": 0,
      "explanation": "Explanation text here"
    }}
  ]
}}

Difficulty: {normalized_difficulty}
- Easy: Basic concepts, simple wording
- Medium: Moderate complexity, requires understanding
- Hard: Advanced topics, critical thinking required
- Expert: Complex scenarios, deep knowledge needed

RESPOND WITH VALID JSON ONLY - NO OTHER TEXT."""

        try:
            # Increase max_tokens for harder quizzes with more questions
            max_tokens = 2048 if question_count <= 5 else 3072 if question_count <= 10 else 4096 if question_count <= 15 else 5120
            
            response_text = self._call_groq_api(prompt, max_tokens=max_tokens)
            quiz_data = self._extract_json_from_response(response_text)
            quiz = QuizGenerated(**quiz_data)
            logger.info(f"Successfully generated {normalized_difficulty} quiz '{quiz.title}' with {len(quiz.questions)} questions")
            return quiz
            
        except Exception as e:
            logger.error(f"Error generating quiz: {e}")
            raise



ai_service = AIService()
