FROM python:3.10

WORKDIR /app

COPY . .

# Install Python dependencies without caching to save space
RUN pip install --no-cache-dir -r requirements.txt

# Install ffmpeg and clean up apt cache to keep the image size small
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

# Use Cloud Run's dynamic $PORT environment variable, falling back to 8080 locally
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]