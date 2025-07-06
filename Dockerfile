# syntax=docker/dockerfile:1.4
FROM node:20

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies using a cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.npm npm install

# Copy the rest of the project files
COPY . .

# Expose the app's port
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]

