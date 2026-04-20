FROM python:3.12-slim AS runner
WORKDIR /app

# Oracle Instant Client 21.13 for Linux x86-64 + system deps
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libaio1 \
        wget \
        unzip \
        ca-certificates && \
    wget -q https://download.oracle.com/otn_software/linux/instantclient/2113000/instantclient-basic-linux.x64-21.13.0.0.0dbru.zip && \
    unzip -q instantclient-basic-linux.x64-21.13.0.0.0dbru.zip -d /opt/oracle && \
    rm instantclient-basic-linux.x64-21.13.0.0.0dbru.zip && \
    echo /opt/oracle/instantclient_21_13 > /etc/ld.so.conf.d/oracle-instantclient.conf && \
    ldconfig && \
    apt-get remove -y wget unzip && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV ORACLE_CLIENT_LIB=/opt/oracle/instantclient_21_13
ENV PYTHON_SERVICE_PORT=8001

EXPOSE 8001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
