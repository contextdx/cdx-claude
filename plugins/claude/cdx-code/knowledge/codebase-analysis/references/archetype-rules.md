# Archetype Classification Rules

## Overview

Archetypes categorize components into functional roles within the architecture. The classification uses a priority-based system where more specific patterns take precedence.

**Important:** Archetype names are defined by the server. Before analysis, fetch available archetypes via the `cdx-archetypes.js` CLI (see `/analyze` Step 0). The semantic categories below (service, api, database, etc.) are detection heuristics — the `type` field in the output must use a valid server archetype name from the fetched list, not these internal category names.

## Semantic Detection Categories

### Service

**Definition**: Business logic components that orchestrate operations.

**Detection Priority (highest to lowest)**:
1. File name ends with `.service.ts` or `.service.js`
2. Located in `/services/` directory
3. Located in `/lib/` or `/utils/` directory
4. Contains class with `@Injectable()` decorator (NestJS)
5. Exports functions that orchestrate other services

**Examples**:
- `user.service.ts` - User management logic
- `payment.service.ts` - Payment processing
- `/lib/auth.ts` - Authentication helpers

---

### API

**Definition**: HTTP endpoint handlers that receive and respond to requests.

**Detection Priority**:
1. File name ends with `.controller.ts` or `.controller.js`
2. Located in `/routes/` directory
3. Located in `/api/` directory
4. Located in `/pages/api/` (Next.js)
5. File name ends with `.route.ts` or `.routes.ts`
6. Contains `@Controller()` decorator (NestJS)
7. Contains Express router definitions

**Examples**:
- `users.controller.ts` - User API endpoints
- `/routes/orders.ts` - Order routes
- `/pages/api/auth.ts` - Next.js API route

---

### Database

**Definition**: Data access layer components that interact with databases.

**Detection Priority**:
1. File name ends with `.repository.ts`
2. File name ends with `.entity.ts` or `.model.ts`
3. Located in `/models/` directory
4. Located in `/entities/` directory
5. Located in `/repositories/` directory
6. Imports ORM packages (TypeORM, Prisma, Mongoose, Sequelize)
7. Contains database connection logic

**Examples**:
- `user.repository.ts` - User data access
- `order.entity.ts` - Order database model
- `/models/product.ts` - Product schema

---

### Component

**Definition**: UI components that render user interface elements.

**Detection Priority**:
1. File name ends with `.component.ts` (Angular)
2. Located in `/components/` directory
3. File extension is `.tsx` or `.jsx`
4. Located in `/pages/` (non-API routes)
5. Contains JSX/TSX syntax
6. Default exports React component

**Examples**:
- `Button.tsx` - Reusable button component
- `UserProfile.component.ts` - Angular component
- `/pages/dashboard.tsx` - Page component

---

### Queue

**Definition**: Message queue handlers and job processors.

**Detection Priority**:
1. File name ends with `.queue.ts` or `.job.ts`
2. File name ends with `.processor.ts` or `.worker.ts`
3. Located in `/jobs/` or `/workers/` directory
4. Located in `/queues/` directory
5. Imports queue packages (Bull, BullMQ, RabbitMQ, SQS)
6. Contains `@Processor()` decorator (NestJS)

**Examples**:
- `email.queue.ts` - Email sending queue
- `notification.processor.ts` - Notification job processor
- `/workers/image-resize.ts` - Background worker

---

### External

**Definition**: Integrations with third-party services and APIs.

**Detection Priority**:
1. Located in `/integrations/` directory
2. Located in `/external/` or `/vendors/` directory
3. File name contains provider name (stripe, twilio, aws)
4. Imports third-party SDK packages
5. Contains HTTP client calls to external domains

**Examples**:
- `stripe.integration.ts` - Stripe payment integration
- `/integrations/sendgrid.ts` - Email provider
- `aws-s3.service.ts` - AWS S3 integration

---

## Component-Layer Role Archetypes (L2 / L3)

When analyzing **inside** a single container or service (the component layer, L2/L3), classify backend code units into **specific role archetypes** instead of the generic `component`. These give each role a distinct visual and a stable semantic name. The names below must exist in the fetched server archetype list before use; fall back to the generic `component` if one is absent.

| Role archetype         | Detection patterns                                                                                     | Example              |
| ---------------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| `controller_component` | `*.controller.*`, `/controllers/`, `/routes/`, `@Controller()`, Express/router handlers                | `user.controller.ts` |
| `service_component`    | `*.service.*`, `/services/`, `@Injectable()` business logic, use-case orchestrators                    | `payment.service.ts` |
| `repository_component` | `*.repository.*`, `*.entity.*`, `*.model.*`, `/repositories/`, `/entities/`, ORM data-access classes   | `user.repository.ts` |
| `handler_component`    | `*.handler.*`, `*.processor.*`, `*.worker.*`, `*.job.*`, `@Processor()`, queue/event/command handlers  | `email.processor.ts` |
| `engine_component`     | `*.engine.*`, `/engines/`, names containing engine/calculator/evaluator/rules, algorithm-heavy compute | `pricing.engine.ts`  |
| `adapter_component`    | `*.adapter.*`, `/adapters/`, `/integrations/`, `/clients/`, third-party SDK bridges                     | `stripe.adapter.ts`  |
| `facade_component`     | `*.facade.*`, `/facades/`, classes named `*Facade` that aggregate several subsystems                    | `billing.facade.ts`  |

**Mapping from semantic categories:** API → `controller_component`, Service → `service_component`, Database → `repository_component`, Queue → `handler_component`. Engine, Adapter, and Facade have no coarse category — detect them from the patterns above.

Frontend code units map to their own provider-agnostic role archetypes (React/Vue/Angular — never a hosting-provider group like Vercel):

| Role archetype     | Detection patterns                                                                     | Example            |
| ------------------ | -------------------------------------------------------------------------------------- | ------------------ |
| `ui_component`     | `*.tsx`/`*.jsx` (non-page), `/components/`, `*.component.ts` (Angular), `*.vue`         | `UserCard.tsx`     |
| `page_component`   | `/pages/` (non-API), `app/**/page.tsx`, `*.page.tsx`, route components                  | `dashboard.tsx`    |
| `layout_component` | `layout.tsx`, `*.layout.tsx`, `/layouts/`, app shells                                   | `app/layout.tsx`   |
| `hook_component`   | `use*.ts`/`use*.tsx`, `/hooks/`, Vue composables                                        | `use-auth.ts`      |
| `store_component`  | `*.store.ts`, `*.slice.ts`, `*.context.tsx`, `/store/`, `/stores/`                      | `cart.slice.ts`    |

**Mapping from the UI category:** generic UI `Component` files → `ui_component`; use the more specific `page_component` / `layout_component` / `hook_component` / `store_component` when those patterns match.

**Layer scope:** Use these role archetypes only at the **component layer (L2/L3)**. At the overview/domain layers (L0/L1), keep classifying deployable units as container-level archetypes (`service`, `frontend_app`, `data_store`, etc.) and apply the database-layer grouping rule below.

---

## Framework Archetypes (application level)

Deployable applications can be classified by their **framework** when the fetched list contains a matching framework archetype (e.g. `nextjs`, `nestjs`, `express`, `react`, `angular`, `vue`, `django`, `fastapi`, `flask`, `spring-boot`, `rails`, `gin`, `aspnet-core`, `actix`, …). These are application/container-level identities — the framework-branded equivalent of `service` / `frontend_app` — used for the framework parent nodes created in Step 2 of analysis. They are **not** a hosting platform: a Next.js app deployed on Vercel is still `nextjs`, never a Vercel-group archetype. Fall back to `service` / `frontend_app` when no framework archetype matches.

---

## Classification Algorithm

### Step 1: Pattern Matching

Check file against patterns in priority order:

```
1. Check file extension and name suffix
2. Check parent directory name
3. Check imports and decorators
4. Check file content patterns
```

### Step 2: Context Consideration

If ambiguous, consider:
- What does this file import?
- What imports this file?
- What is the parent module's purpose?

### Step 3: LLM Fallback

For files that don't match patterns:
1. Read file content
2. Ask Claude to classify based on purpose
3. Provide context about parent directory

### Step 4: Manual Override

Allow metadata-based overrides:
- JSDoc `@archetype` tag
- `// contextdx:archetype=service` comment
- Configuration in `.contextdx.config.json`

---

## File Exclusion and Grouping Rules

**CRITICAL: Apply these rules BEFORE creating any nodes. These rules override the classification patterns above.**

### Files to EXCLUDE from Node Creation

The following files must NOT produce individual nodes. They should still be read during analysis for relationship inference and metadata enrichment, but no node should appear in the output for them.

| Pattern | Languages | Reason |
|---------|-----------|--------|
| `*.d.ts`, `*.types.ts`, `*.type.ts` | TypeScript | Type definitions — no runtime behavior |
| `*.dto.ts`, `*.dto.py`, `*DTO.java`, `*Dto.cs` | All | Data transfer objects — structural only |
| `constants.ts`, `enums.ts`, `config.ts` | TypeScript | Static values — no architectural role |
| `constants.py`, `enums.py`, `config.py` | Python | Static values — no architectural role |
| `Constants.java`, `Enums.java`, `Config.java` | Java | Static values — no architectural role |
| `*.test.ts`, `*.spec.ts`, `*_test.go`, `*_test.py`, `*Test.java`, `*_spec.rb` | All | Test files |
| `*.mock.ts`, `*.stub.ts`, `__mocks__/**` | All | Test support files |
| `index.ts`, `index.js` (barrel files that only re-export) | JS/TS | Re-export barrels — no logic |

**How to use excluded files:** Even though these files do not become nodes, you should still read them to:
- Extract type information for enriching node metadata descriptions
- Identify imports/exports for relationship inference between real nodes
- Understand the data shapes that flow between components

### Files to GROUP Under a Container Node (Database Layer)

**Layer scope:** This grouping applies at the **overview and domain layers (L0/L1)**. At the **component layer (L2/L3)**, do the opposite — emit one `repository_component` node per repository/data-access class (see "Component-Layer Role Archetypes" above) so the data layer's internal structure is visible.

At L0/L1, database entity, model, and repository files must NOT become individual nodes. Instead:

1. Create ONE container node representing the database/data-access layer
2. List the individual entity/model/repository names in the container node's `metadata.description`
3. Any edges that would have pointed to an individual entity file should point to the container node instead

**Files that trigger grouping:**

| Pattern | Languages | Examples |
|---------|-----------|---------|
| `*.entity.ts`, `*.model.ts`, `*.repository.ts` | TypeScript/NestJS | `user.entity.ts`, `order.model.ts` |
| `*_model.py`, `*_repository.py` | Python | `user_model.py`, `order_repository.py` |
| `*Entity.java`, `*Repository.java` | Java/Spring | `UserEntity.java`, `UserRepository.java` |
| `*_model.go`, `*_repository.go`, `*_store.go` | Go | `user_model.go`, `user_store.go` |
| `*Repository.cs`, `*DbContext.cs` | C#/.NET | `UserRepository.cs`, `AppDbContext.cs` |
| Files in `/models/`, `/entities/`, `/repositories/` directories | All | Any files in these directories |

**Correct container node format:**

```json
{
  "slug": "database-layer",
  "name": "Database Layer",
  "type": "<appropriate server archetype name for database>",
  "description": "Data access layer containing entities: User, Order, Product, Payment",
  "path": "/src/entities",
  "parentSlug": "<parent framework or workspace slug>",
  "detailedDescription": "## Database Layer\n\nData access layer using Drizzle ORM.\n\n### Entities\n- User, Order, Product, Payment\n\n### Repositories\n- UserRepository, OrderRepository",
  "metadata": {
    "language": "typescript",
    "framework": "nestjs"
  }
}
```

**Do NOT create individual entity nodes like this:**
```json
{ "slug": "user-entity", "name": "UserEntity", "type": "...", "path": "/src/entities/user.entity.ts" },
{ "slug": "order-entity", "name": "OrderEntity", "type": "...", "path": "/src/entities/order.entity.ts" }
```

**Edge targeting:** When a service imports a repository or entity, the edge `targetSlug` should be `"database-layer"` (the container), not the individual entity slug.

---

## Board Root and Domain Grouping

**The board itself is the root container at every layer.** Do not create a single all-encompassing domain_group that wraps every other node — that is redundant. However, **multiple domain_group nodes for logical grouping ARE expected** on most real-world codebases. Use the board's own `metadata.description`/`metadata.detailedDescription` for project-level context.

### DON'T — Single root wrapper (board is already the root)
```json
{ "slug": "my-project", "name": "My Project", "type": "domain_group" },
{ "slug": "api-server", "parentSlug": "my-project", ... },
{ "slug": "web-app", "parentSlug": "my-project", ... },
{ "slug": "database", "parentSlug": "my-project", ... }
```
One domain_group wrapping everything = redundant. The board already serves as the root container.

### DON'T — Everything flat (no grouping at all)
```json
{ "slug": "api-server", "name": "API Server", ... },
{ "slug": "web-app", "name": "Web App", ... },
{ "slug": "database", "name": "Database", ... },
{ "slug": "auth-service", "name": "Auth Service", ... },
{ "slug": "email-provider", "name": "Email Provider", ... },
{ "slug": "billing-provider", "name": "Billing Provider", ... }
```
No grouping = hard to read. Real codebases have logical domains — group them.

### DO — Multiple domain groups for logical grouping
```json
{ "slug": "backend-services", "name": "Backend Services", "type": "domain_group" },
{ "slug": "frontend", "name": "Frontend", "type": "domain_group" },
{ "slug": "external-integrations", "name": "External Integrations", "type": "domain_group" },
{ "slug": "api-server", "parentSlug": "backend-services", ... },
{ "slug": "auth-service", "parentSlug": "backend-services", ... },
{ "slug": "web-app", "parentSlug": "frontend", ... },
{ "slug": "email-provider", "parentSlug": "external-integrations", ... },
{ "slug": "billing-provider", "parentSlug": "external-integrations", ... }
```
Multiple domain groups sit directly on the board (no `parentSlug`). Child components nest inside via `parentSlug`. **Any board with more than ~8 nodes** should use domain groups based on natural domain boundaries — this applies to all layers, not just L0.

### Detecting Domain Boundaries

| Signal | Example | Action |
|--------|---------|--------|
| Feature folders | `/src/auth/`, `/src/payments/`, `/src/orders/` | Create one container per feature folder |
| NestJS modules | `auth.module.ts`, `payments.module.ts` | Create one container per module |
| Monorepo packages | `packages/auth/`, `packages/checkout/` | Create one container per package |
| Django apps | `apps/users/`, `apps/billing/` | Create one container per app |
| Go packages | `internal/auth/`, `internal/billing/` | Create one container per package |

### Domain Container Format

```json
{
  "slug": "auth-domain",
  "name": "Authentication",
  "type": "<appropriate server archetype name>",
  "description": "Authentication domain: login, registration, password reset, session management",
  "parentSlug": "<framework or workspace slug>",
  "detailedDescription": "## Authentication\n\nHandles user authentication...",
  "metadata": {
    "language": "typescript",
    "framework": "nestjs"
  }
}
```

Components within the domain use `"parentSlug": "auth-domain"`.

### When NOT to Create Domain Containers

- No clear feature/module folders — components are all in flat directories like `/services/`, `/controllers/`
- Fewer than 3 components per potential domain — not worth the extra nesting
- Don't force artificial groupings — if the codebase doesn't have domain structure, skip this

### Container vs. Drill-down: Mutual Exclusion (All Layers)

**CRITICAL:** If a node will drill down to a child board (`layerBoardSlug` is set), it must NOT be a `domain_group` container with visible children on the current board. This rule applies at every layer.

**DON'T** — Container that also drills down (causes duplication across layers):
```json
{ "slug": "nestjs-server", "type": "domain_group", "layerBoardSlug": "root--nestjs-server" },
{ "slug": "auth-service", "parentSlug": "nestjs-server", ... },
{ "slug": "user-service", "parentSlug": "nestjs-server", ... }
```
These children appear on BOTH the parent board (inside the container) and the child board.

**DO** — Opaque node that drills down:
```json
{ "slug": "nestjs-server", "type": "<server-archetype>", "layerBoardSlug": "root--nestjs-server" }
```
No other node has `"parentSlug": "nestjs-server"`. Internal components belong on the child board only.

**DO** — Container that groups without drill-down:
```json
{ "slug": "external-services", "type": "domain_group" },
{ "slug": "aws-s3", "parentSlug": "external-services", ... },
{ "slug": "stripe", "parentSlug": "external-services", ... }
```
Small cluster, no `layerBoardSlug`. Children are visible on this board.

---

## Slug Generation

### Algorithm

1. **Source**: Start from the primary class name, default export name, or function name
2. **Convert to kebab-case**: `UserService` → `user-service`, `PaymentProcessor` → `payment-processor`
3. **Fallback**: If no named export, use `<parent-directory>-<filename>` without extension: `/services/auth.ts` → `services-auth`
4. **Domain containers**: `<domain>-domain` (e.g., `auth-domain`, `payments-domain`)
5. **Database container**: `database-layer` or `<workspace>-database-layer` in monorepos
6. **Max length**: 60 characters — truncate long names
7. **Never** use raw file paths, hashes, or opaque identifiers as slugs

### Name Field

- Use the human-readable form: `"User Service"`, `"Payment Controller"`, `"Authentication"`
- Derived from the same source as the slug but in title case with spaces
- Never use raw file names like `user.service.ts` as the display name

---

## Edge Cases

### Hybrid Files

Files that serve multiple purposes:
- Prefer the primary function
- Example: Controller with business logic → `api` (primary role)

### Utility Files with Logic

Generic utilities (`utils.ts`, `helpers.ts`) that contain meaningful business logic:
- Classify as `service` only if they contain substantive orchestration logic
- If they only contain pure utility functions (string formatting, date helpers), exclude them

---

## Relationship Inference from Detection Categories

| Source Category | Target Category | Likely Relationship |
|-----------------|-----------------|---------------------|
| api | service | `uses` |
| service | database | `db_read` or `db_write` |
| service | queue | `publishes` |
| queue | service | `invokes` |
| service | external | `api_call` |
| component | service | `uses` |
| component | api | `api_call` |

**Note:** Edge `type` values must also use valid server archetype names for edges (fetched from the archetypes CLI).
