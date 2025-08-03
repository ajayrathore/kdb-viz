# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Development
- `npm run dev` - Start React frontend dev server (port 3000)
- `npm run server` - Start Express API server (port 3001)
- `npm run dev:full` - Run both frontend and backend concurrently

### Build & Testing
- `npm run build` - Build for production (TypeScript compilation + Vite build)
- `npm run lint` - Run ESLint with TypeScript rules
- `npm run test` - Run unit tests with Vitest
- `npm run test:e2e` - Run end-to-end tests with Playwright
- `npm run preview` - Preview production build

### Single Test Execution
- `npm run test -- <test-file>` - Run specific test file with Vitest
- `npx playwright test <test-file>` - Run specific E2E test

## Architecture Overview

This is a modern web-based KDB+ database visualization tool built with a React frontend and Express.js backend.

### Frontend Architecture (React/TypeScript)
- **Main App**: React 18 with TypeScript, uses Vite for fast development
- **State Management**: Zustand for lightweight state management, React Context for theme
- **UI Framework**: Tailwind CSS with custom UI components using Radix UI primitives
- **Data Visualization**: Plotly.js for interactive charts, supports line, bar, scatter, histogram, area, OHLC, heatmap, and more
- **Virtual Scrolling**: TanStack Virtual for handling large datasets efficiently
- **Layout**: Resizable panels with react-resizable-panels

### Backend Architecture (Node.js/Express)
- **KDB+ Connection**: Uses `node-q` library for KDB+ connectivity
- **API Server**: Express.js with CORS, handles connection management and query execution
- **Endpoints**: RESTful API for connecting, querying tables, and executing custom queries
- **Error Handling**: Comprehensive error management with graceful connection handling

### Key Components
- **Connection Management**: `src/hooks/use-kdb-connection.ts` - Main hook for KDB+ connections
- **Query Execution**: `src/services/kdb-api.ts` - API service layer with cancellation support
- **Data Grid**: `src/components/virtual-data-grid.tsx` - High-performance virtual scrolling grid
- **Chart Modal**: `src/components/chart-modal-plotly.tsx` - Interactive Plotly.js charts with multiple chart types
- **Server**: `server.js` - Express API server with KDB+ integration

### Data Flow
1. Frontend connects to Express API server (port 3001)
2. API server establishes connection to KDB+ database using node-q
3. Queries execute through API layer with proper error handling and data formatting
4. Results display in virtual data grid with optional chart visualization
5. Charts support multiple data types and visualization modes

### Development Notes
- API server runs on port 3001, frontend dev server on port 3000 (conflicts with Vite default 5173 in vite.config.ts)
- KDB+ connections are managed server-side with connection pooling and graceful shutdown
- Query cancellation supported both for connections and query execution
- Data formatting converts KDB+ specific types (nulls, timestamps) to JavaScript compatible values
- Chart types auto-detect data patterns (time-series, OHLC, volume, etc.)
- Path alias `@` resolves to `./src` directory for clean imports

### Testing Setup

- Unit tests: Vitest framework
- E2E tests: Playwright with connection testing in `tests/connection.spec.ts`
- Configuration files: `playwright.config.ts`, test scripts in package.json