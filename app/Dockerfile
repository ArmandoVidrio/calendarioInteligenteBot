# Base image
FROM python:3.11-slim

# Install dependencies
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Cloud Run uses the PORT env variable
ENV PORT=8080

CMD exec uvicorn main:app --host 0.0.0.0 --port $PORT
