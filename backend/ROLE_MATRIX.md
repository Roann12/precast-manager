# Backend Role Matrix

This document maps API endpoints to required roles and tenant/factory scope.
It reflects the current router dependencies in `backend/app/routers`.

## Role Key

- `admin` - Full administrative access.
- `planner` - Planning and setup workflows.
- `production` - Production execution workflows.
- `QC` - Quality control workflows.
- `yard` - Yard inventory/location workflows.
- `dispatch` - Dispatch workflows.
- `authenticated` - Any logged-in user.

## Scope Key

- `Factory-scoped` - Data limited to `current_user.factory_id`.
- `Super-admin only` - User must be `admin` and `factory_id == null`.

## Endpoint Matrix

### Auth

- `POST /auth/token` - Public login endpoint.
- `GET /auth/me` - `authenticated`.
- `POST /auth/change-password` - `authenticated`.
- User/admin management endpoints under `/auth` - `admin` (with factory checks in handlers).

### Dashboard (`/dashboard`)

- `GET /production` - `authenticated`, factory-scoped.
- `GET /calendar` - `authenticated`, factory-scoped.
- `GET /mould-utilization` - `authenticated`, factory-scoped.
- `GET /yard-stock` - `authenticated`, factory-scoped.
- `GET /overview` - `authenticated`, factory-scoped.
- `GET /planned-by-type` - `authenticated`, factory-scoped.
- `GET /capacity` - `authenticated`, factory-scoped.
- `GET /production-completion` - `planner|production|admin`, factory-scoped.
- `GET /late-items` - `planner|admin`, factory-scoped.
- `GET /project-summaries` - `planner|admin`, factory-scoped.

### Projects (`/projects`)

- `GET /projects` and `GET /projects/{id}` - `authenticated`, factory-scoped.
- `POST /projects` - `planner|admin`, factory-scoped.
- `PUT /projects/{id}` - `planner|admin`, factory-scoped.
- `DELETE /projects/{id}` - `planner|admin`, factory-scoped.

### Elements (`/elements`)

- `GET /elements` and `GET /elements/{id}` - `authenticated`, factory-scoped.
- `POST /elements` - `planner|admin`, factory-scoped.
- `PUT /elements/{id}` - `planner|admin`, factory-scoped.
- `POST /elements/{id}/archive` - `planner|admin`, factory-scoped.
- `POST /elements/{id}/unarchive` - `planner|admin`, factory-scoped.
- `DELETE /elements/{id}` - `planner|admin`, factory-scoped.

### Moulds (`/moulds`)

- `GET /moulds` and `GET /moulds/{id}` - `authenticated`, factory-scoped.
- `POST /moulds` - `planner|admin`, factory-scoped.
- `PUT /moulds/{id}` - `planner|admin`, factory-scoped.
- `DELETE /moulds/{id}` - `planner|admin`, factory-scoped.

### Planner/Production

- Planner endpoints (`/planner`) - mostly `planner|admin`, factory-scoped.
- Production schedule endpoints (`/production`) - mostly `production|admin`, factory-scoped.
- `POST /production/complete` - `production|admin`, now validates yard location belongs to same factory.

### Hollowcore (`/hollowcore`)

- Beds/settings/planner/casts endpoints - `planner|admin`, factory-scoped.
- `POST /hollowcore/casts/{id}/complete` - `planner|admin`, now validates yard location belongs to same factory.

### QC (`/qc`)

- Queue/results/tests/mix stats/status - `QC|admin`, factory-scoped.
- Batch-based joins in results now include factory filters to avoid cross-tenant collisions.

### Yard (`/yard`)

- Read/list endpoints - authenticated with factory-scoping.
- Mutating yard endpoints - role-guarded in router/service and factory-scoped.

### Dispatch (`/dispatch`)

- `POST /dispatch/create` - `dispatch|admin`, factory-scoped.
- `POST /dispatch/add-item` - `dispatch|admin`, factory-scoped (planned orders only).
- `POST /dispatch/remove-item` - `dispatch|admin`, factory-scoped (planned orders only).
- `GET /dispatch` and `GET /dispatch/{id}` - `dispatch|admin`, factory-scoped.
- `GET /dispatch/export-note` - `dispatch|admin`, factory-scoped.
- `POST /dispatch/{id}/complete` - `dispatch|admin`, factory-scoped.
- `POST /dispatch/{id}/cancel` - `dispatch|admin`, factory-scoped.
- `POST /dispatch/{id}/reopen` - `dispatch|admin`, factory-scoped.

### Mix Designs (`/mix-designs`)

- `GET /mix-designs` and `GET /mix-designs/{id}` - `authenticated`, factory-scoped for non-super-admin users.
- `POST /mix-designs` - `planner|admin`, factory-scoped.
- `PUT /mix-designs/{id}` - `planner|admin`, factory-scoped.
- `DELETE /mix-designs/{id}` - `planner|admin`, factory-scoped.

### Dev (`/dev`)

- Dev router only loads when enabled and not production.
- `POST /dev/seed` - `admin` + super-admin restriction (`factory_id == null`).

## Notes

- This matrix is policy documentation, not enforcement by itself.
- Enforcement lives in:
  - dependencies (`require_role`, `get_current_user`, `get_current_factory_id`)
  - router dependencies (`Depends(...)`)
  - query filters (`factory_id` checks in DB queries)
- Keep this file updated whenever endpoint auth dependencies are changed.
