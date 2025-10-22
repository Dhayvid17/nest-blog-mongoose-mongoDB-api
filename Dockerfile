# ======== Base Stage ========
# Base image
FROM node:24-alpine AS base

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# ======== Development Stage ========
# Base image
FROM base AS development


# Install development dependencies
RUN npm install

# Copy all files from current directory (host) to /app (container)
COPY . .

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "run", "start:dev"]


# ======== Build Stage ========
# Base image
FROM base AS build

# Install dependencies
RUN npm ci

# Copy all files from current directory (host) to /app (container)
COPY . .

# Build application
RUN npm run build

# Remove dev dependencies
RUN npm prune --production


# ======== Production Stage ========
# Base image
FROM node:24-alpine AS production

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy built application from build stage
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/node_modules ./node_modules


# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "run", "start:prod"]