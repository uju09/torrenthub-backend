# Use Node.js LTS Alpine for smaller image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for layer caching)
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source files
COPY server.js ./

# Create directories for downloads and files
RUN mkdir -p downloads files

# Copy files directory (contains payload files)
COPY files/ ./files/

# Expose port
EXPOSE 3001

# Set environment variable
ENV NODE_ENV=production

# Run the server
CMD ["node", "server.js"]
