FROM node
RUN useradd -ms /bin/bash project
USER project
WORKDIR /mnt/project
EXPOSE 2016