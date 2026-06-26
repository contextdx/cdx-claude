# Framework Detection Patterns

## Next.js Detection

### Required Indicators
- `next` in dependencies or devDependencies
- `next.config.js` or `next.config.mjs` in project root

### Directory Patterns
- `/pages` - Pages Router (Next.js 12 and below)
- `/app` - App Router (Next.js 13+)
- `/public` - Static assets
- `/styles` - CSS/SCSS files

### File Patterns
- `_app.tsx` or `_app.js` - Custom App component
- `_document.tsx` or `_document.js` - Custom Document
- `middleware.ts` - Edge middleware
- `*.page.tsx` - Page components (convention)

### Component Classification
| Pattern | Archetype |
|---------|-----------|
| `/pages/api/**` | `api` |
| `/app/**/route.ts` | `api` |
| `/pages/**` | `component` |
| `/app/**/page.tsx` | `component` |
| `/components/**` | `component` |
| `/lib/**` | `service` |

---

## NestJS Detection

### Required Indicators
- `@nestjs/core` in dependencies
- `nest-cli.json` in project root

### Directory Patterns
- `/src/modules` - Feature modules
- `/src/common` - Shared utilities
- `/src/config` - Configuration

### File Patterns
- `*.module.ts` - Module definitions
- `*.controller.ts` - HTTP controllers
- `*.service.ts` - Business logic
- `*.repository.ts` - Data access
- `*.entity.ts` - Database entities
- `*.dto.ts` - Data transfer objects
- `*.guard.ts` - Authorization guards
- `*.interceptor.ts` - Request interceptors
- `*.pipe.ts` - Validation pipes

### Component Classification
| Pattern | Archetype |
|---------|-----------|
| `*.controller.ts` | `api` |
| `*.service.ts` | `service` |
| `*.repository.ts` | `database` |
| `*.entity.ts` | `database` |
| `*.queue.ts` | `queue` |
| `*.processor.ts` | `queue` |

---

## Express.js Detection

### Required Indicators
- `express` in dependencies
- `app.js` or `server.js` or `index.js` with express import

### Directory Patterns
- `/routes` - Route handlers
- `/controllers` - Request handlers
- `/middleware` - Express middleware
- `/models` - Data models
- `/services` - Business logic

### File Patterns
- `*.routes.js` - Route definitions
- `*.controller.js` - Request handlers
- `*.middleware.js` - Middleware functions
- `*.model.js` - Data models

### Component Classification
| Pattern | Archetype |
|---------|-----------|
| `/routes/**` | `api` |
| `/controllers/**` | `api` |
| `/models/**` | `database` |
| `/services/**` | `service` |
| `/middleware/**` | `service` |

---

## React Detection

### Required Indicators
- `react` in dependencies
- `react-dom` in dependencies

### Directory Patterns
- `/src/components` - React components
- `/src/hooks` - Custom hooks
- `/src/context` - Context providers
- `/src/pages` - Page components
- `/src/features` - Feature modules

### File Patterns
- `*.tsx` or `*.jsx` - React components
- `use*.ts` - Custom hooks
- `*Context.tsx` - Context providers
- `*.test.tsx` - Test files

### Component Classification
| Pattern | Archetype |
|---------|-----------|
| `/components/**` | `component` |
| `/pages/**` | `component` |
| `/hooks/**` | `service` |
| `/context/**` | `service` |
| `/services/**` | `service` |
| `/api/**` | `external` |

---

## Angular Detection

### Required Indicators
- `@angular/core` in dependencies
- `angular.json` in project root

### Directory Patterns
- `/src/app` - Application root
- `/src/app/components` - Components
- `/src/app/services` - Services
- `/src/app/modules` - Feature modules

### File Patterns
- `*.component.ts` - Components
- `*.service.ts` - Services
- `*.module.ts` - Modules
- `*.directive.ts` - Directives
- `*.pipe.ts` - Pipes
- `*.guard.ts` - Route guards

### Component Classification
| Pattern | Archetype |
|---------|-----------|
| `*.component.ts` | `component` |
| `*.service.ts` | `service` |
| `*.guard.ts` | `service` |
| `*.interceptor.ts` | `service` |

---

## Monorepo Detection

### Workspace Indicators

| Tool | Detection |
|------|-----------|
| npm/yarn workspaces | `workspaces` in root `package.json` |
| Lerna | `lerna.json` in root |
| pnpm | `pnpm-workspace.yaml` in root |
| Turborepo | `turbo.json` in root |
| Nx | `nx.json` in root |
| Rush | `rush.json` in root |

### Common Workspace Structures
```
/packages/*         # Library packages
/apps/*             # Application packages
/services/*         # Backend services
/libs/*             # Shared libraries
```

### Hierarchy Creation

For monorepos, create a three-level hierarchy:
1. **Root node**: Repository name
2. **Workspace nodes**: Each package/app as tech stack parent
3. **Component nodes**: Files within each workspace
