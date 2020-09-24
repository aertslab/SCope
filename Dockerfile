FROM debian:latest

RUN apt-get update -y

RUN apt-get install -y \
    curl wget \
    gnupg \
    unzip \
    git

# Node js
RUN curl -sL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN apt-get install -y build-essential

# Conda
RUN wget --quiet --content-disposition http://bit.ly/miniconda3 -O ~/miniconda.sh && \
    /bin/bash ~/miniconda.sh -b -p /opt/conda && \
    rm ~/miniconda.sh && \
    ln -s /opt/conda/etc/profile.d/conda.sh /etc/profile.d/conda.sh && \
    echo ". /opt/conda/etc/profile.d/conda.sh" >> ~/.bashrc && \
    echo "conda activate base" >> ~/.bashrc
ENV PATH /opt/conda/bin:$PATH
RUN . /opt/conda/etc/profile.d/conda.sh

# Environment
RUN conda create -n scope python=3.8.3 -y
RUN echo "conda activate scope" >> ~/.bashrc

# Poetry
RUN conda install -c conda-forge poetry

# Get sources into container
COPY . /app

# put custom config into container
COPY ${SCOPE_CONFIG:-config.json} /app/config.json

# install the app
RUN cd /app && npm install

# No need to run the build when apache is serving assets from the host (see docker-compose.yml)
# RUN cd /app && npm run build

RUN cd /app/opt && poetry install

# Frontend
#EXPOSE 55850
## Data upload
#EXPOSE 55851
## Backend
#EXPOSE 55852

WORKDIR /app/opt

# ENTRYPOINT ["poetry", "run", "hypercorn", "main:scope_api"]
