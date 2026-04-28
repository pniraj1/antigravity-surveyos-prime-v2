import httpx
import os
from dotenv import load_dotenv

# Path to the .env file in the AIagent directory
env_path = "c:/Users/Manasi/AIagent/.env"
load_dotenv(env_path)

def test_minimax():
    nv_key = os.environ.get("NVIDIA_API_KEY")
    print(f"Testing with key: {nv_key[:10]}...")
    
    try:
        url = "https://integrate.api.nvidia.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {nv_key}",
            "accept": "application/json",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "minimaxai/minimax-m2.7",
            "messages": [{"role": "user", "content": "Hello, are you online?"}],
            "max_tokens": 50
        }
        res = httpx.post(url, headers=headers, json=payload, timeout=60.0)

        print(f"HTTP status: {res.status_code}")
        if res.status_code == 200:
            print("Success! NVIDIA MiniMax 2.7 is reachable.")
            try:
                print("Response:", res.json()['choices'][0]['message']['content'])
            except Exception:
                print("Success but couldn't parse JSON response.")
        else:
            print(f"Error: {res.status_code} - {res.text}")
    except Exception as e:
        print(f"Connection Error: {str(e)}")

if __name__ == "__main__":
    test_minimax()
