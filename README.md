# API Gateway Microservices Architecture
Intern ID: CITS670

A production-grade, event-driven microservices architecture built with Node.js, TypeScript, and Express. The system coordinates user management, event publishing/registration, and real-time notifications with centralized request routing, authorization, and rate limiting handled by an API Gateway.

---

## System Architecture

The following diagram illustrates the relationship between the API Gateway, the individual microservices, PostgreSQL databases, Redis, and the RabbitMQ message broker.

```mermaid
graph TD
    Client[Client Browser / API Client] -->|HTTP / JSON| Gateway[API Gateway :3000]

    %% Infrastructure dependencies
    Gateway -->|Rate Limiting & Caching| Redis[(Redis :6379)]
    Gateway -->|Reverse Proxy| US[User Service :3001]
    Gateway -->|Reverse Proxy| ES[Event Service :3002]
    Gateway -->|Reverse Proxy| NS[Notification Service :3003]
    Gateway -->|Reverse Proxy| SS[Search Service :3004]

    %% Databases
    US -->|Prisma| DB_U[(Postgres: User DB)]
    ES -->|Prisma| DB_E[(Postgres: Event DB)]
    NS -->|Prisma| DB_N[(Postgres: Notification DB)]
    SS -->|Prisma| DB_S[(Postgres: Search DB)]

    %% Event Broker
    US -.->|Publish: user.created / user.updated| Rabbit[RabbitMQ Exchange]
    ES -.->|Publish: event.registered / event.cancelled / event.updated| Rabbit
    
    Rabbit -.->|Consume: search.index.queue| SS
    Rabbit -.->|Consume: notification.events.queue| NS
```

---

## Microservice Directory

### 1. API Gateway (`services/api-gateway`)
- **Port**: `3000`
- **Responsibilities**:
  - **Reverse Proxy**: Proxies requests to target downstream services using `http-proxy-middleware`.
  - **Authentication**: Validates JWTs, sets cookies/headers, and forwards authenticated context (`x-user-id`, `x-user-role`, `x-user-email`) downstream.
  - **Rate Limiting**: Enforces strict endpoint throttling (general limits vs. stricter auth limits).
  - **Circuit Breaker**: Integrates `opossum` to wrap downstream service proxies, failing fast and returning fallback responses when downstream services degrade.
  - **Request Logging & Correlation Tracing**: Generates or forwards an `x-correlation-id` to trace requests end-to-end across services.

### 2. User Service (`services/user-service`)
- **Port**: `3001`
- **Database**: `user_db` (PostgreSQL)
- **Responsibilities**:
  - User registration, password hashing (`bcryptjs`), and user profile updates.
  - JWT token generation (Access & Refresh tokens).
  - Publishes `user.created` and `user.updated` events to RabbitMQ `users.exchange`.

### 3. Event Service (`services/event-service`)
- **Port**: `3002`
- **Database**: `event_db` (PostgreSQL)
- **Responsibilities**:
  - Event management (Create, Update, Get, Delete, List) supporting draft vs. published states.
  - Event registration and waitlisting.
  - Publishes `event.registered`, `event.updated`, and `event.cancelled` events to `events.exchange` carrying affected participant IDs for batch notifications.

### 4. Notification Service (`services/notification-service`)
- **Port**: `3003`
- **Database**: `notification_db` (PostgreSQL)
- **Responsibilities**:
  - Consumes RabbitMQ events from `notification.events.queue` bound to both `events.exchange` and `notifications.exchange`.
  - Dispatches and stores notifications (e.g., event confirmation, organizer alerts, cancellation notices).
  - Exposes REST endpoints to list user notifications (paginated) and mark notifications as read.

### 5. Search Service (`services/search-service`)
- **Port**: `3004`
- **Database**: `search_db` (PostgreSQL)
- **Responsibilities**:
  - Consumes RabbitMQ events from `search.index.queue` to synchronize and index user and event changes into a denormalized `SearchIndex` table.
  - Exposes powerful, high-performance searching and filtering APIs (`GET /api/v1/search`) with full-text search capabilities across multiple entities (Events, Users).

---

## RabbitMQ Event Topology

Inter-service asynchronous communication is orchestrated via RabbitMQ exchanges, routing keys, and queues:

| Exchange Name | Routing Key | Target Queue | Source Service | Consumer Service | Purpose |
|:---|:---|:---|:---|:---|:---|
| `users.exchange` | `user.created` | `search.index.queue` | User Service | Search Service | Indexes new users for search |
| `users.exchange` | `user.updated` | `search.index.queue` | User Service | Search Service | Updates indexed user details |
| `events.exchange` | `search.index.update` | `search.index.queue` | Event Service | Search Service | Indexes/Updates published events |
| `events.exchange` | `event.registered` | `notification.events.queue` | Event Service | Notification Service | Dispatches registration & organizer alerts |
| `events.exchange` | `event.cancelled` | `notification.events.queue` | Event Service | Notification Service | Sends bulk notifications to event participants |
| `events.exchange` | `event.updated` | `notification.events.queue` | Event Service | Notification Service | Alerts participants of event updates |
| `notifications.exchange` | `notification.send` | `notification.events.queue` | Any Service | Notification Service | Directly queues a custom user notification |

---

## Getting Started & Deployment

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js v20+](https://nodejs.org/)

### Local Installation

1. **Clone the Repository** and navigate to the project directory.
2. **Environment Variables**: The workspace comes pre-configured with a `.env` file containing default credentials for local development. Copy `.env.example` if a clean setup is needed:
   ```bash
   cp .env.example .env
   ```
3. **Build & Boot the Stack**: Run the dev compose script (this downloads infrastructure images, compiles workspaces, and builds the isolated microservices Docker images):
   ```bash
   npm run dev
   ```
4. **Deploy Database Schemas**: Once the Postgres containers are healthy, push the Prisma schemas from the host to establish tables in the respective databases:
   ```bash
   # Push User database schema
   docker run --rm --network wien_microservices-net -e DATABASE_URL="postgresql://postgres:postgres123@postgres-user:5432/user_db" -v "${PWD}:/app" -w /app node:20-alpine sh -c "apk add --no-cache openssl && npx prisma db push --schema=services/user-service/prisma/schema.prisma"

   # Push Event database schema
   docker run --rm --network wien_microservices-net -e DATABASE_URL="postgresql://postgres:postgres123@postgres-event:5432/event_db" -v "${PWD}:/app" -w /app node:20-alpine sh -c "apk add --no-cache openssl && npx prisma db push --schema=services/event-service/prisma/schema.prisma"

   # Push Notification database schema
   docker run --rm --network wien_microservices-net -e DATABASE_URL="postgresql://postgres:postgres123@postgres-notification:5432/notification_db" -v "${PWD}:/app" -w /app node:20-alpine sh -c "apk add --no-cache openssl && npx prisma db push --schema=services/notification-service/prisma/schema.prisma"

   # Push Search database schema
   docker run --rm --network wien_microservices-net -e DATABASE_URL="postgresql://postgres:postgres123@postgres-search:5432/search_db" -v "${PWD}:/app" -w /app node:20-alpine sh -c "apk add --no-cache openssl && npx prisma db push --schema=services/search-service/prisma/schema.prisma"
   ```

5. **Restart microservices** (optional, to ensure clean database reconnections):
   ```bash
   docker restart user-service event-service notification-service search-service
   ```

---

## Running Integration Tests

An integration test script is provided in the repository to simulate the E2E registration, event creation, publishing, search indexing, and real-time notification dispatch flows:

```bash
# Execute E2E integration verification script
node services/api-gateway/../../C:/Users/user/.gemini/antigravity-ide/brain/c055b4cd-d806-46df-87e3-53f076bb4ae5/scratch/test_flow.js
```

---

## Observability & Correlation Tracing

All HTTP requests passing through the API Gateway generate a unique `x-correlation-id` UUID if not provided by the client. 
- Downstream services receive this ID in headers via `x-correlation-id`.
- The correlation ID is automatically appended to all logs using a custom AsyncLocalStorage context tracker (`requestContext`), allowing seamless tracing across user registrations, search requests, and RabbitMQ publishing flows.
