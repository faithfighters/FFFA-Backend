FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ARG ENV=production
RUN if [ "$ENV" = "stage" ]; then cp .env.staging .env; else cp .env.production .env; fi

RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]


