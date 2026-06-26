# Language Detection and Framework Patterns

## Language Detection

### Manifest File Priority

When multiple manifest files exist, use this priority order:

1. **Primary manifests** (definitive language indicators)
2. **Secondary manifests** (supporting files)
3. **File extension analysis** (fallback)

### Detection Rules by Language

---

## JavaScript/TypeScript

### Manifest Detection
- `package.json` - Primary indicator
- `tsconfig.json` - TypeScript project
- `jsconfig.json` - JavaScript project with config

### Framework Indicators

| Framework | Dependencies | Config Files | Directory Patterns |
|-----------|-------------|--------------|-------------------|
| **Next.js** | `next` | `next.config.js`, `next.config.mjs` | `/pages`, `/app` |
| **NestJS** | `@nestjs/core` | `nest-cli.json` | `/src/modules` |
| **Express** | `express` | - | `/routes`, `/middleware` |
| **React** | `react`, `react-dom` | - | `/src/components` |
| **Vue** | `vue` | `vue.config.js` | `/src/components` |
| **Angular** | `@angular/core` | `angular.json` | `/src/app` |
| **Fastify** | `fastify` | - | `/routes` |
| **Electron** | `electron` | - | `/main`, `/renderer` |

### File Extensions
- `.js`, `.jsx` - JavaScript
- `.ts`, `.tsx` - TypeScript
- `.mjs`, `.cjs` - ES/CommonJS modules

### Import Patterns
```javascript
// ES6 imports
import { Service } from './service';
import * as utils from '../utils';
import defaultExport from 'module';

// CommonJS
const module = require('module');
const { named } = require('./local');

// Dynamic
const mod = await import('./dynamic');
```

---

## Python

### Manifest Detection
- `requirements.txt` - Pip dependencies
- `pyproject.toml` - Modern Python projects
- `Pipfile` - Pipenv projects
- `setup.py` - Legacy packages
- `poetry.lock` - Poetry projects

### Framework Indicators

| Framework | Dependencies | Config Files | Directory Patterns |
|-----------|-------------|--------------|-------------------|
| **Django** | `django` | `settings.py`, `manage.py` | `/apps`, `/<app>/views.py` |
| **FastAPI** | `fastapi` | - | `/routers`, `/api` |
| **Flask** | `flask` | - | `/routes`, `/views` |
| **Celery** | `celery` | `celery.py` | `/tasks` |
| **SQLAlchemy** | `sqlalchemy` | - | `/models` |
| **Pydantic** | `pydantic` | - | `/schemas` |

### File Extensions
- `.py` - Python source

### Import Patterns
```python
# Standard imports
import os
import sys

# From imports
from module import Class
from package.subpackage import function

# Relative imports
from . import sibling
from ..parent import module

# Aliased
import numpy as np
from typing import Optional as Opt
```

### Archetype Detection

| Archetype | File Patterns | Directory Patterns |
|-----------|--------------|-------------------|
| `api` | `*_view.py`, `*_api.py` | `/views/`, `/api/`, `/routers/` |
| `service` | `*_service.py`, `*_handler.py` | `/services/`, `/handlers/` |
| `database` | `*_model.py`, `*_repository.py` | `/models/`, `/repositories/` |
| `queue` | `*_task.py`, `*_worker.py` | `/tasks/`, `/workers/`, `/jobs/` |

---

## Java

### Manifest Detection
- `pom.xml` - Maven project
- `build.gradle` - Gradle project
- `build.gradle.kts` - Gradle Kotlin DSL
- `settings.gradle` - Multi-module Gradle

### Framework Indicators

| Framework | Dependencies | Config Files | Annotations |
|-----------|-------------|--------------|-------------|
| **Spring Boot** | `spring-boot-starter-*` | `application.properties`, `application.yml` | `@SpringBootApplication` |
| **Quarkus** | `io.quarkus:*` | `application.properties` | `@QuarkusMain` |
| **Micronaut** | `io.micronaut:*` | `application.yml` | `@MicronautApplication` |
| **Jakarta EE** | `jakarta.*` | `beans.xml` | `@Stateless`, `@Singleton` |

### File Extensions
- `.java` - Java source
- `.kt` - Kotlin source

### Import Patterns
```java
// Package imports
import com.example.service.UserService;
import org.springframework.stereotype.Service;

// Wildcard imports
import java.util.*;

// Static imports
import static org.junit.Assert.*;
```

### Archetype Detection

| Archetype | Class Suffixes | Annotations | Directories |
|-----------|---------------|-------------|-------------|
| `api` | `*Controller`, `*Resource` | `@RestController`, `@Controller` | `/controller/`, `/resource/` |
| `service` | `*Service`, `*ServiceImpl` | `@Service` | `/service/` |
| `database` | `*Repository`, `*DAO`, `*Entity` | `@Repository`, `@Entity` | `/repository/`, `/entity/` |
| `queue` | `*Listener`, `*Consumer` | `@JmsListener`, `@KafkaListener` | `/listener/`, `/consumer/` |

---

## Go

### Manifest Detection
- `go.mod` - Go module
- `go.sum` - Dependency checksums

### Framework Indicators

| Framework | Module Path | Patterns |
|-----------|------------|----------|
| **Gin** | `github.com/gin-gonic/gin` | `gin.Default()`, `gin.New()` |
| **Echo** | `github.com/labstack/echo` | `echo.New()` |
| **Fiber** | `github.com/gofiber/fiber` | `fiber.New()` |
| **gRPC** | `google.golang.org/grpc` | `*.proto`, `/pb/` |
| **GORM** | `gorm.io/gorm` | `gorm.Model` |

### File Extensions
- `.go` - Go source

### Import Patterns
```go
// Standard imports
import "fmt"
import "net/http"

// Grouped imports
import (
    "context"
    "github.com/user/repo/pkg"
    internal "github.com/user/repo/internal"
)

// Blank imports (side effects)
import _ "github.com/lib/pq"
```

### Archetype Detection

| Archetype | File Patterns | Directory Patterns |
|-----------|--------------|-------------------|
| `api` | `*_handler.go`, `*_controller.go` | `/handlers/`, `/api/`, `/http/` |
| `service` | `*_service.go`, `*_usecase.go` | `/services/`, `/usecase/` |
| `database` | `*_repository.go`, `*_store.go` | `/repositories/`, `/store/`, `/db/` |
| `queue` | `*_consumer.go`, `*_worker.go` | `/consumers/`, `/workers/` |

### Standard Project Layout
```
/cmd/app/           - Main applications
/internal/          - Private code
/pkg/               - Public libraries
/api/               - API definitions (OpenAPI, Proto)
```

---

## C# / .NET

### Manifest Detection
- `*.csproj` - C# project file
- `*.sln` - Solution file
- `global.json` - SDK version
- `nuget.config` - NuGet configuration

### Framework Indicators

| Framework | NuGet Packages | Project SDK | Patterns |
|-----------|---------------|-------------|----------|
| **ASP.NET Core** | `Microsoft.AspNetCore.*` | `Microsoft.NET.Sdk.Web` | `/Controllers/` |
| **Blazor** | `Microsoft.AspNetCore.Components.*` | - | `/Pages/`, `*.razor` |
| **Entity Framework** | `Microsoft.EntityFrameworkCore` | - | `DbContext` |
| **MassTransit** | `MassTransit` | - | `/Consumers/` |

### File Extensions
- `.cs` - C# source
- `.razor` - Blazor components

### Import Patterns
```csharp
// Using directives
using System;
using System.Collections.Generic;
using Microsoft.AspNetCore.Mvc;

// Aliased
using Project = MyCompany.MyProject;

// Static
using static System.Math;

// Global (C# 10+)
global using System.Linq;
```

### Archetype Detection

| Archetype | Class Suffixes | Attributes | Directories |
|-----------|---------------|------------|-------------|
| `api` | `*Controller` | `[ApiController]`, `[Route]` | `/Controllers/` |
| `service` | `*Service` | - | `/Services/` |
| `database` | `*Repository`, `*DbContext` | `[Table]`, `[Key]` | `/Repositories/`, `/Data/` |
| `component` | `*Component`, `*Page` | - | `/Components/`, `/Pages/` |

---

## Ruby

### Manifest Detection
- `Gemfile` - Bundler dependencies
- `Gemfile.lock` - Locked versions
- `*.gemspec` - Gem specification

### Framework Indicators

| Framework | Gems | Config Files | Patterns |
|-----------|------|--------------|----------|
| **Rails** | `rails` | `config/routes.rb`, `config/application.rb` | `/app/` structure |
| **Sinatra** | `sinatra` | - | `get '/'`, `post '/'` |
| **Sidekiq** | `sidekiq` | `sidekiq.yml` | `/workers/`, `/jobs/` |
| **Grape** | `grape` | - | `/api/` |

### File Extensions
- `.rb` - Ruby source
- `.erb` - Embedded Ruby templates

### Import Patterns
```ruby
# Require
require 'json'
require 'active_record'

# Require relative
require_relative './lib/helper'
require_relative '../models/user'

# Load
load 'config.rb'

# Autoload
autoload :User, 'models/user'
```

### Archetype Detection (Rails)

| Archetype | File Patterns | Directory Patterns |
|-----------|--------------|-------------------|
| `api` | `*_controller.rb` | `/app/controllers/` |
| `service` | `*_service.rb` | `/app/services/` |
| `database` | `*.rb` in models | `/app/models/` |
| `queue` | `*_job.rb`, `*_worker.rb` | `/app/jobs/`, `/app/workers/` |
| `component` | `*_component.rb` | `/app/components/` |

---

## Rust

### Manifest Detection
- `Cargo.toml` - Rust package manifest
- `Cargo.lock` - Dependency lock file

### Framework Indicators

| Framework | Crates | Patterns |
|-----------|--------|----------|
| **Actix Web** | `actix-web` | `HttpServer::new()` |
| **Axum** | `axum` | `Router::new()` |
| **Rocket** | `rocket` | `#[rocket::main]` |
| **Diesel** | `diesel` | `#[derive(Queryable)]` |
| **SQLx** | `sqlx` | `#[sqlx::query]` |

### File Extensions
- `.rs` - Rust source

### Import Patterns
```rust
// Use declarations
use std::collections::HashMap;
use crate::models::User;
use super::parent_module;

// External crates
use serde::{Serialize, Deserialize};
use tokio::sync::mpsc;

// Glob imports
use std::io::*;

// Aliased
use std::collections::HashMap as Map;
```

### Archetype Detection

| Archetype | File Patterns | Module Patterns |
|-----------|--------------|-----------------|
| `api` | `*_handler.rs`, `*_route.rs` | `mod handlers`, `mod routes` |
| `service` | `*_service.rs` | `mod services` |
| `database` | `*_repository.rs`, `*_model.rs` | `mod models`, `mod db` |
| `queue` | `*_worker.rs`, `*_consumer.rs` | `mod workers` |

### Standard Layout
```
/src/
  main.rs           - Binary entry
  lib.rs            - Library entry
  /handlers/        - HTTP handlers
  /services/        - Business logic
  /models/          - Data models
  /db/              - Database layer
```

---

## Cross-Language Patterns

### Database Access Detection

| Language | ORM/Driver | Read Patterns | Write Patterns |
|----------|-----------|---------------|----------------|
| **JS/TS** | TypeORM, Prisma, Mongoose | `find`, `findOne`, `select` | `save`, `create`, `update`, `delete` |
| **Python** | SQLAlchemy, Django ORM | `query`, `filter`, `get` | `add`, `commit`, `save`, `delete` |
| **Java** | JPA, Hibernate | `find`, `findById`, `findAll` | `save`, `persist`, `merge`, `delete` |
| **Go** | GORM, sqlx | `Find`, `First`, `Where` | `Create`, `Save`, `Update`, `Delete` |
| **C#** | EF Core | `Find`, `Where`, `FirstOrDefault` | `Add`, `Update`, `Remove`, `SaveChanges` |
| **Ruby** | ActiveRecord | `find`, `where`, `first` | `save`, `create`, `update`, `destroy` |
| **Rust** | Diesel, SQLx | `find`, `filter`, `load` | `insert`, `update`, `delete` |

### HTTP Client Detection

| Language | Libraries | Patterns |
|----------|----------|----------|
| **JS/TS** | axios, fetch, got | `axios.get()`, `fetch()` |
| **Python** | requests, httpx, aiohttp | `requests.get()`, `httpx.get()` |
| **Java** | RestTemplate, WebClient, OkHttp | `restTemplate.getForObject()` |
| **Go** | net/http, resty | `http.Get()`, `client.R().Get()` |
| **C#** | HttpClient | `httpClient.GetAsync()` |
| **Ruby** | Faraday, HTTParty, Net::HTTP | `Faraday.get()`, `HTTParty.get()` |
| **Rust** | reqwest, hyper | `reqwest::get()`, `client.get()` |

### Message Queue Detection

| Language | Libraries | Publish Patterns | Subscribe Patterns |
|----------|----------|-----------------|-------------------|
| **JS/TS** | Bull, amqplib | `queue.add()`, `channel.publish()` | `queue.process()`, `channel.consume()` |
| **Python** | Celery, pika | `task.delay()`, `channel.basic_publish()` | `@app.task`, `channel.basic_consume()` |
| **Java** | Spring AMQP, Kafka | `rabbitTemplate.send()` | `@RabbitListener`, `@KafkaListener` |
| **Go** | amqp, kafka-go | `ch.Publish()`, `writer.WriteMessages()` | `msgs := ch.Consume()`, `reader.ReadMessage()` |
| **C#** | MassTransit, RabbitMQ.Client | `publishEndpoint.Publish()` | `IConsumer<T>` |
| **Ruby** | Bunny, Sidekiq | `exchange.publish()`, `MyWorker.perform_async()` | `subscribe`, `include Sidekiq::Worker` |
| **Rust** | lapin, rdkafka | `channel.basic_publish()` | `consumer.next()` |
