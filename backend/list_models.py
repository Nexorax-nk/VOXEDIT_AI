# backend/list_models.py
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: API Key not found in .env")
else:
    genai.configure(api_key=api_key)
    print("Scanning available models...")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"✅ AVAILABLE: {m.name}")
    except Exception as e:
        print(f"Error listing models: {e}")