# VisionAttend Pro - Production Docker Container
FROM python:3.10-slim

# Install system dependencies for OpenCV, dlib, and image processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications and install
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Ensure storage directories exist and are writable
RUN mkdir -p /app/database /app/data /app/models && \
    chmod -R 777 /app/database /app/data /app/models

# Environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Start server
CMD ["python", "run.py"]
