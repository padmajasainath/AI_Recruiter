# Build Stage
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Set build-time environment variables
ENV NEXT_PUBLIC_API_URL=https://ai-recruiter-api-167160983469.us-west1.run.app
ENV NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyABFmq5Z60jyQ68tPTN9cif02LCL9U3pOo
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=cm-ai-recruiter.firebaseapp.com
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=cm-ai-recruiter
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=cm-ai-recruiter.firebasestorage.app
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=561251772400
ENV NEXT_PUBLIC_FIREBASE_APP_ID=1:561251772400:web:179113b09e73c83a6ddf35

# Build application
RUN npm run build

# Production Stage
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

# Start Next.js server
CMD ["npm", "start"]
