FROM python:3.10

# set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

COPY requirements.txt .

# install python dependencies
RUN pip install --upgrade pip
RUN pip install -U pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt
RUN apt-get update
RUN apt-get upgrade -y
#RUN apt-get install maven -y
#RUN mvn dependency:copy-dependencies -DoutputDirectory=./jars -f $(python3 -c 'import importlib; import importlib.util; import pathlib; print(pathlib.Path(importlib.util.find_spec("sutime").origin).parent / "pom.xml")')
#RUN python3 -m spacy download en_core_web_sm
#RUN python3 -m spacy download en_core_web_lg
#RUN python3 -m spacy download en_core_web_trf

COPY . .

# gunicorn
CMD ["gunicorn", "--config", "gunicorn-cfg.py", "run:app"]
