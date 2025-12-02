FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./

EXPOSE 3002

# Importa el archivo: app/main.py → módulo = app.main
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002"]
