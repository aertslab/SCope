Bootstrap: docker

From: ubuntu

%environment
    export PATH=/opt/conda/bin:$PATH

%files
    . /app

%post
    # in case this is built on singularity hub
    chmod -R 755 '/app'

    # install some basic dependencies
    apt-get update -y
    apt-get install -y \
      curl wget \
      gnupg \
      unzip \
      git

    # node js
    curl -sL https://deb.nodesource.com/setup_10.x | bash -
    apt-get install -y nodejs
    apt-get install -y build-essential 

    # conda
    wget --quiet --content-disposition http://bit.ly/miniconda3 -O /root/miniconda.sh && \
      /bin/bash /root/miniconda.sh -b -p /opt/conda && \
      rm /root/miniconda.sh && \
      ln -s /opt/conda/etc/profile.d/conda.sh /etc/profile.d/conda.sh && \
      echo ". /opt/conda/etc/profile.d/conda.sh" >> /etc/bash.bashrc && \
      echo "conda activate base" >> /etc/bash.bashrc
    . /opt/conda/etc/profile.d/conda.sh

    # environment
    conda create -n scope python=3.6.2 -y
    echo "conda activate scope" >> /etc/bash.bashrc 
    export PATH=/opt/conda/bin:$PATH

    # install scope
    mkdir /app/assets/
    cd /app && npm install
    cd /app/opt && python setup.py develop
    cd /app && npm run build

%apprun backend
  exec scope-server

%apprun frontend
  exec /bin/sh -c 'cd /app && python2 -m SimpleHTTPServer 55850'

