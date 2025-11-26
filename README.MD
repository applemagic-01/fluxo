# Fluxo Project Overview

## Introduction
Fluxo is a full-stack Project Management Tool designed to help teams collaborate, manage projects, and track tasks efficiently.

## Technology Stack

### Client (Frontend)
- **Framework:** React 19 (via Vite 7)
- **Styling:** Tailwind CSS 4
- **State Management:** Redux Toolkit, React Redux
- **Routing:** React Router DOM 7
- **Authentication:** Clerk React
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **Charts:** Recharts
- **Utilities:** Date-fns, React Hot Toast

### Server (Backend)
- **Runtime:** Node.js
- **Framework:** Express 5
- **Database:** PostgreSQL (via Neon Serverless)
- **ORM:** Prisma
- **Authentication:** Clerk Express
- **Real-time:** WebSocket (`ws`)
- **Background Jobs:** Inngest
- **Email:** Nodemailer

## Architecture

### Database Schema (Prisma)
The application uses a relational database model with the following core entities:
- **User:** Application users.
- **Workspace:** Groups of projects and members.
- **Project:** Specific initiatives within a workspace.
- **Task:** Individual units of work within a project.
- **Comment:** Discussions on tasks.
- **Memberships:** `WorkspaceMember` and `ProjectMember` manage many-to-many relationships with roles.

### Frontend Structure (`client/src`)
- **`App.jsx`:** Main entry point with routing configuration.
- **`pages/`:** Contains page components (`Dashboard`, `Projects`, `Team`, etc.).
- **`components/`:** Reusable UI components.
- **`features/`:** Redux slices and feature-specific logic.
- **`configs/`:** Configuration files.

### Backend Structure (`server/`)
- **`server.js`:** Entry point for the Express server.
- **`prisma/schema.prisma`:** Database schema definition.
- **`routes/`:** API route definitions.
- **`controllers/`:** Request handling logic.
- **`middlewares/`:** Custom middleware (e.g., auth).
- **`inngest/`:** Background job definitions.

## Getting Started

### Prerequisites
- Node.js installed
- PostgreSQL database (Neon)
- Clerk account for authentication

### Installation
1.  **Clone the repository.**
2.  **Install dependencies:**
    ```bash
    # Client
    cd client
    npm install

    # Server
    cd ../server
    npm install
    ```
3.  **Environment Setup:**
    - Configure `.env` in `client` and `server` with necessary keys (Database URL, Clerk Keys, etc.).
4.  **Run the application:**
    ```bash
    # Client
    cd client
    npm run dev

    # Server
    cd server
    npm start
    ```