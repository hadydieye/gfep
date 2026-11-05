# Requirements Document

## Introduction

This document defines the requirements for Phase 0 — Foundations of the Guinea Finance Enterprise Portal (GFEP). Phase 0 establishes the complete technical foundation upon which all subsequent MVP phases are built. It covers three steps: monorepo initialization with both Next.js 15 frontend and NestJS 10 backend applications (Step 0.1), PostgreSQL database setup via Docker Compose with a complete Prisma schema covering all 22 models across 7 domains (Step 0.2), and the implementation of the GFEP design system in code including custom color tokens, typography, and personalized shadcn/ui components verified on a dedicated `/design-system` reference page (Step 0.3).

No functional business modules are built in Phase 0. Its sole deliverable is a verified, runnable foundation that future phases can extend without rework.

---

## Glossary

- **Monorepo**: A single repository containing multiple applications managed via npm workspaces, with `apps/frontend` and `apps/backend` as workspace packages.
- **Frontend**: The Next.js 15 + TypeScript application located at `apps/frontend`.
- **Backend**: The NestJS 10 + TypeScript application located at `apps/backend`.
- **Docker Compose**: The container orchestration configuration at the workspace root providing a PostgreSQL 16 service.
- **Prisma**: The ORM layer (version 5+) installed in the Backend, responsible for schema definition and migrations.
- **Design System**: The set of color tokens, typography rules, and customized shadcn/ui components defined in `04-UXUI-Design-System.md` and implemented in code.
- **Design System Page**: The internal reference page at `/design-system` in the Frontend, listing all base components and their variants.
- **Health Endpoint**: The Backend REST endpoint `GET /api/v1/health` that returns HTTP 200 to confirm the Backend is operational.
- **Color Token**: A named CSS custom property or Tailwind configuration entry that maps a semantic role (e.g., "primary", "surface") to a hex color value for both light and dark modes.
- **shadcn/ui**: The component library used in the Frontend; all components must be customized to the GFEP Design System before use — never used with their default unmodified theme.
- **GFEP Design System Palette**: The ten-role color palette defined in section 2.1 of `04-UXUI-Design-System.md`: Primary, Secondary, Background Main, Background Surface, Text Primary, Text Secondary, Border, Success, Warning, Error — each with explicit light-mode and dark-mode values.

---

## Requirements

### Requirement 1 — Monorepo Structure

**User Story:** As a developer, I want a properly structured monorepo with npm workspaces, so that the frontend and backend applications share a consistent toolchain and can be managed from a single root.

#### Acceptance Criteria

1. THE Monorepo SHALL contain a root `package.json` that declares npm workspaces pointing to `apps/frontend` and `apps/backend`.
2. THE Monorepo SHALL contain a `.nvmrc` file specifying Node.js 22 LTS as the required runtime version.
3. THE Monorepo SHALL declare `"engines": { "node": ">=22.0.0" }` in the root `package.json` to enforce the Node.js version constraint.
4. THE Monorepo SHALL expose a `dev` script at the root level that starts both the Frontend development server and the Backend development server concurrently.
5. THE Monorepo SHALL expose a `build` script at the root level that builds both the Frontend and the Backend.
6. THE Monorepo SHALL expose a `lint` script at the root level that runs ESLint for both the Frontend and the Backend.

---

### Requirement 2 — Frontend Application Initialization

**User Story:** As a developer, I want a Next.js 15 frontend application initialized with TypeScript, Tailwind CSS, and shadcn/ui, so that I have a working base to build GFEP screens on.

#### Acceptance Criteria

1. THE Frontend SHALL be a Next.js 15 application using the App Router and TypeScript.
2. THE Frontend SHALL have Tailwind CSS installed and configured with a `tailwind.config.ts` file.
3. THE Frontend SHALL have shadcn/ui installed and its component registry initialized.
4. THE Frontend SHALL have ESLint configured with rules appropriate for Next.js and TypeScript.
5. THE Frontend SHALL have Prettier configured with a `.prettierrc` file shared with or consistent with the Backend configuration.
6. WHEN `npm run dev` is executed from the workspace root or from `apps/frontend`, THE Frontend SHALL start without errors and serve a response on its default port.

---

### Requirement 3 — Backend Application Initialization

**User Story:** As a developer, I want a NestJS 10 backend application initialized with TypeScript, so that I have a working API base for GFEP.

#### Acceptance Criteria

1. THE Backend SHALL be a NestJS 10 application using TypeScript.
2. THE Backend SHALL expose a health check endpoint at `GET /api/v1/health` that returns HTTP status 200.
3. THE Backend SHALL have ESLint configured with rules appropriate for NestJS and TypeScript.
4. THE Backend SHALL have Prettier configured consistent with the Frontend configuration.
5. WHEN `npm run dev` is executed from the workspace root or from `apps/backend`, THE Backend SHALL start without errors and the Health Endpoint SHALL return HTTP 200.

---

### Requirement 4 — Docker Compose and PostgreSQL

**User Story:** As a developer, I want a Docker Compose configuration providing a PostgreSQL 16 database, so that I can run the full GFEP stack locally without a manual database installation.

#### Acceptance Criteria

1. THE Monorepo SHALL contain a `docker-compose.yml` file at the workspace root that declares a PostgreSQL 16 service.
2. THE Docker Compose service SHALL expose PostgreSQL on port 5432.
3. THE Docker Compose service SHALL read its database name, username, and password from environment variables defined in a `.env` file at the workspace root.
4. THE Monorepo SHALL contain a `.env.example` file at the workspace root documenting all required environment variable keys without exposing secret values.
5. THE Monorepo SHALL contain a `.gitignore` entry that excludes `.env` from version control.
6. WHEN `docker compose up -d` is executed, THE PostgreSQL service SHALL start and accept connections on port 5432 using the credentials supplied in `.env`.

---

### Requirement 5 — Prisma Schema and Database Migration

**User Story:** As a developer, I want Prisma 5 installed in the backend with the complete GFEP schema applied to the database, so that all 22 data models across 7 domains are available for subsequent development phases.

#### Acceptance Criteria

1. THE Backend SHALL have Prisma version 5 or later installed as a dependency, with `@prisma/client` generated.
2. THE Backend SHALL contain a `prisma/schema.prisma` file whose content is an exact reproduction of the schema defined in section 3 of `05-Backend-Schema.md`, covering all 7 domains: Identity, Organization, Access Control, Documents, Finance, Application, and Security & Audit.
3. THE `prisma/schema.prisma` file SHALL declare all 22 models: `User`, `EmployeeIdentity`, `Session`, `AdGroupRoleMapping`, `Department`, `Position`, `Employee`, `Role`, `Permission`, `UserRole`, `RolePermission`, `DocumentCategory`, `Document`, `DocumentPermission`, `Transaction`, `Invoice`, `Notification`, `AuthEvent`, `AuditLog`, `SecurityEvent`, `LabScenario`, and `ScenarioExecution`.
4. THE `prisma/schema.prisma` file SHALL declare all enums defined in `05-Backend-Schema.md` section 3: `AuthProvider`, `UserStatus`, `EmploymentStatus`, `ConfidentialityLevel`, `DocumentPermissionType`, `TransactionType`, `TransactionStatus`, `InvoiceStatus`, `NotificationType`, `AuthEventType`, and `SecuritySeverity`.
5. THE Backend `DATABASE_URL` SHALL be read exclusively from an environment variable and SHALL never be hard-coded in source files.
6. WHEN `prisma migrate dev` is executed against the running PostgreSQL service, THE migration SHALL complete without errors and all 22 tables SHALL be created in the database.
7. WHEN `prisma studio` is launched, THE tool SHALL display all 22 tables and allow browsing of their structure.

---

### Requirement 6 — Design System Color Tokens

**User Story:** As a developer, I want the GFEP color palette defined as Tailwind configuration tokens, so that every component and screen uses consistent, semantically named colors in both light and dark modes.

#### Acceptance Criteria

1. THE Frontend Tailwind configuration SHALL define Color Tokens for all ten semantic roles of the GFEP Design System Palette: Primary, Secondary, Background Main, Background Surface, Text Primary, Text Secondary, Border, Success, Warning, and Error.
2. THE Frontend Tailwind configuration SHALL declare explicit light-mode and dark-mode values for each Color Token, matching the hex values specified in section 2.1 of `04-UXUI-Design-System.md`.
3. THE Frontend SHALL implement dark mode support using Tailwind's `class` strategy, toggled by adding or removing the `dark` class on the root HTML element.
4. THE Frontend CSS SHALL define the Color Tokens as CSS custom properties so that they are accessible to both Tailwind utility classes and any direct CSS usage.
5. THE Frontend Tailwind configuration SHALL use a base-4 spacing scale (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px) consistent with section 3 of `04-UXUI-Design-System.md`.

---

### Requirement 7 — Typography

**User Story:** As a developer, I want Inter or Geist loaded explicitly via next/font, so that the Frontend renders with a consistent, intentional typeface rather than the browser's default system font.

#### Acceptance Criteria

1. THE Frontend SHALL load either Inter or Geist using `next/font` and apply the font to the root layout.
2. THE Frontend SHALL NOT rely on `ui-sans-serif` or any unloaded system font as the primary typeface.
3. THE Frontend CSS SHALL expose the loaded font as a CSS variable so that Tailwind's `fontFamily` configuration can reference it by name.

---

### Requirement 8 — Customized shadcn/ui Components

**User Story:** As a developer, I want the six core shadcn/ui components customized to the GFEP Design System before any screen is built, so that no screen is ever assembled with default unmodified component styles.

#### Acceptance Criteria

1. THE Frontend SHALL install and customize the `Button` shadcn/ui component with three variants: primary (GFEP primary color background, white text), secondary (transparent background, GFEP border color outline), and destructive (GFEP error color background).
2. THE Frontend SHALL install and customize the `Card` shadcn/ui component to use the Background Surface color, a light border using the Border color token, 8px border radius, and a subtle box shadow — never a pronounced drop shadow.
3. THE Frontend SHALL install and customize the `Table` shadcn/ui component with sticky column headers, a hover state that applies a light background change to the hovered row, and a default row height of 40px.
4. THE Frontend SHALL install and customize the `Input` shadcn/ui component so that form labels are always rendered above the input field and validation error messages are rendered below the field in the Error color.
5. THE Frontend SHALL install and customize the `Badge` shadcn/ui component in pill shape with four semantic color variants: success (Success color), warning (Warning color), error (Error color), and neutral (Border color).
6. THE Frontend SHALL install and customize the `Toast` (Sonner or shadcn/ui toast) component to appear in the top-right corner, auto-dismiss after 4 seconds for success and info variants, and remain persistent (requiring manual dismissal) for the error variant.
7. WHEN any of the six components above is rendered, THE component SHALL visually reflect the GFEP Design System Palette and SHALL NOT display the default shadcn/ui gray/slate theme colors.

---

### Requirement 9 — Design System Reference Page

**User Story:** As a developer, I want an internal `/design-system` page in the Frontend listing all customized components in both light and dark modes, so that I can visually verify design system compliance throughout development.

#### Acceptance Criteria

1. THE Frontend SHALL expose a page at the route `/design-system` that renders all six customized shadcn/ui components (Button, Card, Table, Input, Badge, Toast) with all their variants.
2. THE Design System Page SHALL display each component in both light mode and dark mode simultaneously, or provide a visible toggle to switch between modes.
3. THE Design System Page SHALL display the complete GFEP color palette with each Color Token's name, light-mode hex value, and dark-mode hex value.
4. THE Design System Page SHALL display a typography specimen showing the font loaded via `next/font` at the sizes and weights defined in section 2.2 of `04-UXUI-Design-System.md`.
5. WHEN a developer views the Design System Page, THE page SHALL make it visually apparent whether any displayed component still uses the default shadcn/ui unmodified theme (i.e., no gray/slate colors should appear where GFEP palette colors are expected).

---

### Requirement 10 — Phase 0 Completion Criteria

**User Story:** As a developer, I want all Phase 0 completion criteria verified concretely before proceeding to MVP Phase 1, so that subsequent phases are not built on an incomplete or misconfigured foundation.

#### Acceptance Criteria

1. WHEN `npm run dev` is executed from the Monorepo root, THE Frontend SHALL start and serve its default home page without compilation errors.
2. WHEN `npm run dev` is executed from the Monorepo root, THE Backend SHALL start and `GET /api/v1/health` SHALL return HTTP 200 without runtime errors.
3. WHEN `prisma migrate dev` is executed against the running Docker Compose PostgreSQL service, THE migration SHALL complete successfully with all 22 tables created.
4. WHEN a developer opens the `/design-system` page in a browser, THE page SHALL display all six customized shadcn/ui components in both light and dark modes with no default shadcn/ui unmodified styling visible.
5. IF any of the four criteria above fails, THEN THE developer SHALL resolve the failure before considering Phase 0 complete and before starting any work from Phase MVP 1.
