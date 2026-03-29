import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
genai.configure(api_key=api_key)

output_file = "models.txt"
print(f"Listing supported Gemini models to {output_file}...")

try:
    with open(output_file, "w") as f:
        models = list(genai.list_models())
        for m in models:
            if 'generateContent' in m.supported_generation_methods:
                f.write(f"Name: {m.name}, Display: {m.display_name}\n")
    print("Done.")
except Exception as e:
    print(f"Error: {e}")
