#!/bin/bash

# Export standard macOS search paths (resolving Docker paths like /usr/local/bin)
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# --- COLOR CODES ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0;37m' # No Color

ROOT_DIR="/Users/sriramkhandelwal/Desktop/Projects/ecommerce-microservices"
LOGS_DIR="$ROOT_DIR/logs"

# Ensure log directory exists
mkdir -p "$LOGS_DIR"

print_banner() {
  echo -e "${CYAN}${BOLD}"
  echo "  ✦══════════════════════════════════════════════════════✦"
  echo "     AURA E-COMMERCE MICROSERVICES ORCHESTRATOR SHELL     "
  echo "  ✦══════════════════════════════════════════════════════✦"
  echo -e "${NC}"
}

get_port() {
  case "$1" in
    "auth-service") echo "8081" ;;
    "catalog-service") echo "8082" ;;
    "cart-service") echo "8083" ;;
    "inventory-service") echo "8086" ;;
    "payment-service") echo "8085" ;;
    "order-service") echo "8084" ;;
    "gateway") echo "8080" ;;
    *) echo "" ;;
  esac
}

status() {
  print_banner
  echo -e "${BOLD}Checking status of Microservices and backing infrastructure...${NC}\n"

  # 1. Backing Infrastructure
  echo -e "${BOLD}[Backing Infrastructure]${NC}"
  for service in "postgres:5432" "mongodb:27017" "redis:6379" "rabbitmq:5672"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    if nc -z localhost $port &>/dev/null; then
      printf "  %-12s : [ ${GREEN}ACTIVE${NC} ] on Port %s\n" "$name" "$port"
    else
      printf "  %-12s : [ ${RED}INACTIVE${NC} ] on Port %s\n" "$name" "$port"
    fi
  done
  echo ""

  # 2. Java Microservices
  echo -e "${BOLD}[Spring Boot Java Microservices]${NC}"
  for name in "auth-service" "catalog-service" "cart-service" "inventory-service" "payment-service" "order-service" "gateway"; do
    port=$(get_port "$name")
    pid=$(lsof -t -i:$port -sTCP:LISTEN)
    if [ ! -z "$pid" ]; then
      printf "  %-18s : [ ${GREEN}RUNNING${NC} ] (PID: %s) on Port %s\n" "$name" "$pid" "$port"
    else
      printf "  %-18s : [ ${RED}STOPPED${NC} ] on Port %s\n" "$name" "$port"
    fi
  done
  echo ""

  # 3. Next.js Storefront
  echo -e "${BOLD}[Next.js Storefront]${NC}"
  sf_pid=$(lsof -t -i:3000 -sTCP:LISTEN)
  if [ ! -z "$sf_pid" ]; then
    echo -e "  storefront         : [ ${GREEN}RUNNING${NC} ] (PID: $sf_pid) on Port 3000"
  else
    echo -e "  storefront         : [ ${RED}STOPPED${NC} ] on Port 3000"
  fi
  echo ""
}

stop() {
  print_banner
  echo -e "${YELLOW}${BOLD}Initiating graceful shutdown sequence...${NC}\n"

  # Kill Java services on their ports
  ports=("8080" "8081" "8082" "8083" "8084" "8085" "8086" "3000")
  for port in "${ports[@]}"; do
    pid=$(lsof -t -i:$port -sTCP:LISTEN)
    if [ ! -z "$pid" ]; then
      echo -e "Terminating process on port ${CYAN}$port${NC} (PID: $pid)..."
      kill -9 $pid &>/dev/null
    fi
  done

  echo -e "\n${GREEN}✔ All background microservices and frontend instances successfully terminated.${NC}"
  echo -e "To stop docker-compose backing databases, run: ${BOLD}docker compose down${NC}\n"
}

start() {
  print_banner
  
  # Check if target JAR files exist, if not compile
  echo -e "${BOLD}Verifying target compilations...${NC}"
  build_needed=false
  for module in "gateway" "auth-service" "catalog-service" "cart-service" "order-service" "payment-service" "inventory-service"; do
    if [ ! -f "$ROOT_DIR/services/$module/target/$module-1.0.0.jar" ]; then
      echo -e "  Missing JAR compilation for module: ${YELLOW}$module${NC}"
      build_needed=true
    fi
  done

  if [ "$build_needed" = true ] || [ "$1" = "--build" ]; then
    echo -e "\n${YELLOW}${BOLD}Building Java packages with Maven Reactor (skipping unit tests)...${NC}"
    cd "$ROOT_DIR"
    mvn clean package -DskipTests
    if [ $? -ne 0 ]; then
      echo -e "${RED}❌ Maven compilation failed! Aborting startup sequence.${NC}"
      exit 1
    fi
    echo -e "${GREEN}✔ Maven reactor build finished successfully!${NC}\n"
  else
    echo -e "  ${GREEN}✔ Target JAR files verified.${NC}\n"
  fi

  # Start backing docker services
  echo -e "${BOLD}Launching backing docker containers...${NC}"
  cd "$ROOT_DIR"
  docker compose up -d
  if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start docker compose infrastructure. Aborting startup sequence.${NC}"
    exit 1
  fi
  echo -e "${GREEN}✔ Docker containers running.${NC}\n"

  # Wait for Docker containers to accept connections
  echo -e "${BOLD}Waiting for databases and message brokers to initialize...${NC}"
  for service in "postgres:5432" "mongodb:27017" "redis:6379" "rabbitmq:5672"; do
    name=$(echo $service | cut -d: -f1)
    port=$(echo $service | cut -d: -f2)
    echo -n "  Waiting for $name on port $port..."
    attempts=0
    while ! nc -z localhost $port &>/dev/null; do
      sleep 1
      attempts=$((attempts+1))
      if [ $attempts -ge 30 ]; then
        echo -e " [ ${RED}TIMEOUT${NC} ]"
        echo -e "${RED}❌ Connection to $name timed out. Ensure your Docker Desktop is active.${NC}"
        exit 1
      fi
    done
    echo -e " [ ${GREEN}READY${NC} ]"
  done
  echo ""

  # Terminate conflicting ports first
  echo -e "${BOLD}Pre-emptively clearing microservices ports to prevent conflicts...${NC}"
  ports=("8080" "8081" "8082" "8083" "8084" "8085" "8086" "3000")
  for port in "${ports[@]}"; do
    pid=$(lsof -t -i:$port -sTCP:LISTEN)
    if [ ! -z "$pid" ]; then
      kill -9 $pid &>/dev/null
    fi
  done
  echo -e "  ${GREEN}✔ Ports clean.${NC}\n"

  # Start Java Services sequentially
  echo -e "${BOLD}Launching Spring Boot services sequentially (dependencies first)...${NC}"
  
  order=("auth-service" "catalog-service" "cart-service" "inventory-service" "payment-service" "order-service" "gateway")

  for name in "${order[@]}"; do
    port=$(get_port "$name")
    jar_file="$ROOT_DIR/services/$name/target/$name-1.0.0.jar"
    log_file="$LOGS_DIR/$name.log"
    
    echo -n "  Starting $name on port $port..."
    nohup java -jar "$jar_file" > "$log_file" 2>&1 &
    
    # Wait until the port is listening
    attempts=0
    while [ -z "$(lsof -t -i:$port -sTCP:LISTEN)" ]; do
      sleep 0.5
      attempts=$((attempts+1))
      if [ $attempts -ge 40 ]; then
        echo -e " [ ${RED}FAILED${NC} ]"
        echo -e "${RED}❌ $name failed to startup. Check log at: $log_file${NC}"
        exit 1
      fi
    done
    echo -e " [ ${GREEN}ONLINE${NC} ] (PID: $(lsof -t -i:$port -sTCP:LISTEN))"
  done
  echo ""

  # Start Next.js Storefront
  echo -e "${BOLD}Starting Next.js Storefront...${NC}"
  cd "$ROOT_DIR/storefront"
  nohup npm run dev > "$LOGS_DIR/storefront.log" 2>&1 &

  attempts=0
  while [ -z "$(lsof -t -i:3000 -sTCP:LISTEN)" ]; do
    sleep 0.5
    attempts=$((attempts+1))
    if [ $attempts -ge 20 ]; then
      echo -e "  Storefront [ ${RED}FAILED${NC} ]"
      echo -e "${RED}❌ Storefront failed to launch on port 3000. Check log at: $LOGS_DIR/storefront.log${NC}"
      exit 1
    fi
  done
  echo -e "  Storefront         : [ ${GREEN}ONLINE${NC} ] on Port 3000\n"

  echo -e "${GREEN}${BOLD}✦═══ SUCCESS: ALL MICROSERVICES & THE FRONTEND ARE ONLINE ═══✦${NC}"
  echo -e "${BOLD}You can access the UI now at: ${CYAN}http://localhost:3000${NC}"
  echo -e "Backend Central Gateway: ${CYAN}http://localhost:8080${NC}"
  echo -e "RabbitMQ Admin Console : ${CYAN}http://localhost:15672${NC} (guest/guest)"
  echo -e "Check active services anytime via: ${BOLD}./run-platform.sh status${NC}"
  echo -e "Shutdown all services anytime via: ${BOLD}./run-platform.sh stop${NC}"
  echo -e "Central logs folder: ${BOLD}$LOGS_DIR${NC}\n"
}

case "$1" in
  start)
    start "$2"
    ;;
  stop)
    stop
    ;;
  status)
    status
    ;;
  restart)
    stop
    sleep 2
    start "$2"
    ;;
  *)
    echo -e "Usage: ${BOLD}./run-platform.sh {start|stop|status|restart}${NC}"
    echo -e "Use ${BOLD}./run-platform.sh start --build${NC} to force Maven compilation before boot."
    exit 1
    ;;
esac
