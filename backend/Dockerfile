FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Thay đổi lệnh này tùy vào cách bạn chạy server (ví dụ: gunicorn, uvicorn, hoặc python main.py)
CMD ["python", "run.py"]