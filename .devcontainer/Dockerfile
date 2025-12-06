# Use the official DevContainer node image with a valid "node" user
FROM mcr.microsoft.com/devcontainers/javascript-node:1-18-bullseye

# Install Python
USER root
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    apt-get clean

# Switch back to the predefined non-root "node" user
USER node
WORKDIR /workspace
