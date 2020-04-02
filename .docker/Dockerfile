FROM python:latest

# Install python
RUN apt-get update && apt-get dist-upgrade -y && apt-get install -y \
  curl
  # python3 \
  # python3-dev \
  # python3-venv

# Set up a SCope user
RUN groupadd -g 1000 -r scope && useradd -r -m -u 1000 -g scope scope
USER scope
RUN mkdir /home/scope/bin
WORKDIR /home/scope

# Install Node
RUN curl -sSL https://nodejs.org/dist/v12.16.1/node-v12.16.1-linux-x64.tar.xz --output /home/scope/node.tar.xz && \
   tar -C /home/scope/bin -xf /home/scope/node.tar.xz
ENV PATH /home/scope/bin/node-v12.16.1-linux-x64/bin:$PATH

# Install poetry
RUN curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python
ENV PATH="/home/scope/.poetry/bin:${PATH}"

# Finalise
COPY ./.docker/run-scope-server.sh /home/scope/run-scope-server.sh
ENTRYPOINT ["bash", "./run-scope-server.sh"]
