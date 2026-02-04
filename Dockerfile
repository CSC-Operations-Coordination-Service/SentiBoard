FROM python:3.10

# set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .

# install python dependencies
RUN pip install --upgrade pip
RUN pip install -U pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt
RUN apt-get update
RUN apt-get upgrade -y

COPY . .

COPY site-packages/czml/czml.py /usr/local/lib/python3.10/site-packages/czml/czml.py
COPY site-packages/satellite_czml/czml.py /usr/local/lib/python3.10/site-packages/satellite_czml/czml.py
RUN mkdir -p /apps/logs

# gunicorn
CMD ["gunicorn", "--config", "gunicorn-cfg.py", "run:app"]
