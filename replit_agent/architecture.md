# Architecture Documentation

## Overview

This application is a tutoring service management system built with a modern tech stack. It provides functionality for students to book tutoring sessions, purchase tickets, and view session reports, while tutors can manage their schedules, view their bookings, and submit session reports.

The system follows a client-server architecture with a clear separation between frontend and backend. It uses a React-based single-page application (SPA) for the frontend and an Express.js API server for the backend. Data is persisted in a PostgreSQL database using the Drizzle ORM.

## System Architecture

### High-Level Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  React Frontend │◄────►│  Express Server │◄────►│  PostgreSQL DB  │
│  (Vite)         │      │  (Node.js)      │      │  (via Drizzle)  │
│                 │      │                 │      │                 │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                                  ▲
                                  │
                                  ▼
                         ┌─────────────────┐
                         │  External APIs  │
                         │  - PayPal       │
                         │  - Email Service│
                         └─────────────────┘
```

### Frontend Architecture

The frontend is built with React (using Vite as the build tool) and follows a modern component-based architecture. Key architectural decisions include:

- **UI Components**: Uses Shadcn/UI, a collection of reusable components built on Radix UI primitives with Tailwind CSS styling
- **Routing**: Uses Wouter for lightweight client-side routing
- **State Management**: Uses React Query for server state management and local React state for UI state
- **Form Handling**: Uses React Hook Form with Zod for form validation

### Backend Architecture

The backend is built with Express.js and follows a modular architecture with clear separation of concerns:

- **API Routes**: Defined in `server/routes.ts`, providing RESTful endpoints for the frontend
- **Authentication**: Custom authentication implementation using Passport.js with session-based auth
- **Database Access**: Abstracted through a storage service layer (`server/storage.ts`)
- **Business Logic**: Implemented in route handlers and specific service modules

### Database Schema

The database schema is defined using Drizzle ORM schema definitions in `shared/schema.ts`. Key entities include:

- **Users**: Stores user accounts (both tutors and parents/students)
- **Students**: Stores student profiles linked to parent user accounts
- **Tutors**: Stores tutor profiles with their subjects and qualifications
- **Bookings**: Stores tutoring session bookings
- **TutorShifts**: Stores tutor availability schedules
- **LessonReports**: Stores reports for completed lessons
- **StudentTickets**: Tracks tickets purchased and available for booking sessions
- **PaymentTransactions**: Records payment history

## Key Components

### Frontend Components

1. **Authentication Module**:
   - Handles user login, registration, and session management
   - Implemented with context API (see `use-auth.tsx`)

2. **Booking System**:
   - Allows users to book tutoring sessions based on subject, date, and tutor availability
   - Components: `booking-page.tsx`, `calendar-view.tsx`, `booking-confirmation-modal.tsx`

3. **Ticket Purchase System**:
   - Enables purchasing of session tickets through PayPal integration
   - Components: `ticket-purchase-page.tsx`, `PaymentModal.tsx`, `PayPalButton.tsx`

4. **Reporting System**:
   - Allows tutors to submit session reports and users to view them
   - Components: `report-edit-modal.tsx`, `report-view-modal.tsx`

5. **Profile Management**:
   - Handles user and student profile setup and editing
   - Components: `profile-setup-page.tsx`, `settings-page.tsx`

6. **Tutor Management**:
   - Allows tutors to manage their profiles, schedules, and view bookings
   - Components: `tutor-profile-page.tsx`, `tutor-schedule-page.tsx`, `tutor-bookings-page.tsx`

### Backend Components

1. **Authentication Service**:
   - Implements user authentication with password hashing and session management
   - Located in `server/auth.ts`

2. **Storage Service**:
   - Provides a unified interface for database access
   - Implements CRUD operations for all entities
   - Located in `server/storage.ts`

3. **Email Service**:
   - Handles email notifications for bookings, reports, etc.
   - Located in `server/email-service.ts`

4. **PayPal Integration**:
   - Handles payment processing through PayPal
   - Located in `server/paypal.ts`

5. **Database Connection**:
   - Sets up and manages database connections using Neon Postgres via Drizzle ORM
   - Located in `server/db.ts`

## Data Flow

### Authentication Flow

1. User submits credentials via login form
2. Backend validates credentials and creates a session
3. Session ID is stored in a cookie
4. Frontend uses the session cookie for subsequent authenticated requests

### Booking Flow

1. User selects subject, date, and time slot
2. System fetches available tutors based on criteria
3. User selects a tutor and confirms booking
4. System creates booking record and decreases available tickets
5. Email notifications are sent to both user and tutor

### Reporting Flow

1. Tutor views upcoming/completed bookings
2. For completed sessions, tutor submits a lesson report
3. System stores the report and links it to the booking
4. Parents/students can view the reports for their bookings

## External Dependencies

### Frontend Dependencies

- **React**: UI library
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/UI**: Component library built on Radix UI
- **Tanstack React Query**: Data fetching and caching
- **React Hook Form**: Form state management
- **Zod**: Schema validation
- **Wouter**: Routing library
- **date-fns**: Date utility library
- **Lucide React**: Icon library

### Backend Dependencies

- **Express**: Web framework
- **Passport**: Authentication middleware
- **Drizzle ORM**: Database ORM
- **Neon Postgres**: Serverless Postgres provider
- **NodeMailer**: Email sending library
- **PayPal SDK**: Payment processing integration

## Deployment Strategy

The application is configured for deployment on Replit, as indicated by the `.replit` configuration file. The deployment strategy includes:

1. **Build Process**:
   - Frontend: Vite builds the React application into static assets
   - Backend: esbuild bundles the server code for production

2. **Runtime Configuration**:
   - Production mode is enabled through the NODE_ENV environment variable
   - Database connections use connection pooling for efficiency

3. **Scalability Considerations**:
   - The application uses a serverless PostgreSQL database (Neon)
   - Stateless authentication allows for horizontal scaling

4. **Environment Variables**:
   - Database credentials (DATABASE_URL)
   - Session secret (SESSION_SECRET)
   - Email service credentials (EMAIL_USER, EMAIL_PASS)
   - PayPal API credentials (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)

The application is designed to be deployed on Replit's autoscaling infrastructure, with the build command configured as `npm run build` and the run command as `npm run start`.