FROM ubuntu

RUN apt-get update -y

RUN apt-get install -y \
    curl wget \
    gnupg \
    unzip \
    git

# Node js
RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
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
RUN conda create -n scope python=3.6.2 -y
RUN echo "conda activate scope" >> ~/.bashrc 

#RUN wget --quiet https://github.com/aertslab/SCope/releases/download/untagged-7055c54f734999ce039f/SCope-linux-x64.zip -O /opt/scope.zip
#RUN (cd /opt/ && unzip scope.zip)

# RUN cd / && \
#    git clone https://github.com/aertslab/SCope && \
#    mv SCope app

# Get sources into container
COPY . /app

# RUN echo "conda activate scope" | bash -
RUN cd /app && \
    npm install

RUN cd /app/opt && \
    python setup.py develop

RUN cd /app && \
    npm run build

# Frontend
EXPOSE 55850
# Data upload
EXPOSE 55851
# Backend
EXPOSE 55852

WORKDIR /app

# The frontend fails if this directory does not exist
# RUN mkdir /app/assets/

ENTRYPOINT ["npm", "run", "scope"]
