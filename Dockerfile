FROM node:18-buster-slim

RUN apt-get -y update

RUN apt-get -y install imagemagick

# this removes a limit on processing pdfs in imagemagick
RUN sed -i '/pattern="PDF"/d' /etc/ImageMagick-6/policy.xml

RUN npm install forever -g

CMD ["bash"]