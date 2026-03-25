#!/bin/bash

# ──────────────────────────────────────────
# AI Recruiter — Developer CLI
# ──────────────────────────────────────────

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

function usage() {
    echo -e "${BLUE}AI Recruiter Dev CLI${NC}"
    echo "Usage: ./dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start     Start the entire stack (Frontend, Backend, Database)"
    echo "  stop      Stop all services"
    echo "  restart   Restart all services"
    echo "  status    Check the status of services"
    echo "  logs      View real-time logs (Ctrl+C to exit)"
    echo "  clean     Stop services and remove volumes (Wipes Database!)"
    echo ""
}

case "$1" in
    start)
        echo -e "${GREEN}Starting AI Recruiter stack...${NC}"
        docker-compose up -d --build
        echo -e "${GREEN}Services started!${NC}"
        echo -e "Frontend: ${BLUE}http://localhost:3000${NC}"
        echo -e "Backend:  ${BLUE}http://localhost:8001${NC}"
        ;;
    stop)
        echo -e "${YELLOW}Stopping services...${NC}"
        docker-compose stop
        ;;
    restart)
        echo -e "${YELLOW}Restarting services...${NC}"
        docker-compose restart
        ;;
    status)
        docker-compose ps
        ;;
    logs)
        docker-compose logs -f
        ;;
    clean)
        echo -e "${RED}Cleaning everything (including data)...${NC}"
        docker-compose down -v
        ;;
    *)
        usage
        exit 1
        ;;
esac
