FROM python:3.10-slim

# Install system dependencies for OpenCV and pyttsx3
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    espeak \
    alsa-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install them
COPY requirements.txt .
# Use opencv-python-headless to save space and avoid UI dependencies
RUN sed -i 's/opencv-python/opencv-python-headless/' requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend files
COPY . .

# Expose port 8000
EXPOSE 8000

# Start the FastAPI app
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
