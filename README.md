# School Management System

A full-stack web application for managing students, teachers, classes and grades, with role-based access for **Administrators**, **Teachers** and **Students**.

> Work in progress. This README grows with every feature.

## Tech stack

| Layer    | Technology                                             |
| -------- | ------------------------------------------------------ |
| Backend  | NestJS 11, TypeScript (strict)                         |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui  |
| Database | PostgreSQL 16 (Docker)                                 |
| Tooling  | ESLint + Prettier (API), Oxlint + Prettier (web), Jest |

## Project structure

```
.
├── backend/             NestJS REST API
├── frontend/            React single-page app
├── docker-compose.yml   PostgreSQL for local development
└── README.md
```

## Prerequisites

- Node.js 20+ (developed on Node 24 LTS)
- Docker Desktop

## Getting started

**1. Start the database**

```bash
docker compose up -d
```

**2. Start the API** (http://localhost:3000/api)

```bash
cd backend
cp .env.example .env
npm install
npm run start:dev
```

**3. Start the frontend** (http://localhost:5173)

```bash
cd frontend
npm install
npm run dev
```

In development, Vite proxies every `/api` request to the backend, so the frontend and the API behave as if they share the same origin.

## Useful scripts

| Where    | Command                | What it does                     |
| -------- | ---------------------- | -------------------------------- |
| backend  | `npm run start:dev`    | API with hot reload              |
| backend  | `npm run lint`         | ESLint (type-aware)              |
| backend  | `npm run typecheck`    | TypeScript check, no output      |
| backend  | `npm test`             | Unit tests                       |
| backend  | `npm run test:e2e`     | End-to-end tests                 |
| frontend | `npm run dev`          | Vite dev server                  |
| frontend | `npm run lint`         | Oxlint                           |
| frontend | `npm run build`        | Type check + production build    |

## Environment variables

The API validates its environment on startup and refuses to start if something is missing or invalid. See [`backend/.env.example`](backend/.env.example).
