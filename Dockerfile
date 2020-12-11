FROM node:15-buster-slim

RUN npm install forever -g

CMD ["bash"]