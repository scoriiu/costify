# Arhitectura platformei

Costify este un sistem multi-tenant construit pe principii moderne de izolare a datelor, calcul in timp real si audit stricten. Acest articol descrie arhitectura la nivel de ansamblu — cum sunt organizate componentele, cum curg datele si de ce am ales aceasta structura.

## 1. Modelul multi-tenant

Costify deserveste simultan **multi contabili** (user accounts), fiecare cu **multe firme** (clienti) in portofoliu. Izolarea este stricta: contabilul A nu vede niciodata datele contabilului B.

```
Platforma Costify
    ├── Contabil 1 (user)
    │     ├── Firma A
    │     ├── Firma B
    │     └── Firma C ...
    │
    ├── Contabil 2 (user)
    │     ├── Firma X
    │     ├── Firma Y
    │     └── Firma Z ...
    │
    └── Contabil 3 (user) ...
```

**Izolarea este aplicata la mai multe nivele**:

1. **Application level** — fiecare service verifica `userId owns clientId` inainte de orice operatie
2. **Foreign keys** — `Client.userId` este FK; orice query porneste de la `userId`
3. **Session scoping** — context-ul de request contine `userId`, toate functiile primesc `userId` explicit
4. **Future: Row-level security** — la scale mare vom adauga RLS la nivel PostgreSQL

## 2. Principiul jurnal-centric

Costify foloseste o arhitectura **jurnal-centrica**: registrul jurnal este **unica sursa de adevar**. Tot ce afisam (balanta, CPP, KPI-uri) este calculat in timp real din jurnal, nu stocat pre-calculat.

```
Jurnal (JournalLine)  ──►  Balanta  ──►  CPP  ──►  KPI
   Single source             Live           Live       Live
   of truth                  compute        compute    compute
```

De ce? Vezi [Principiul jurnal-centric](./principiul-jurnal-centric.md) pentru o explicatie detaliata.

## 3. Modulele platformei

Costify este organizat in **module** — fiecare cu o responsabilitate clara, API public bine definit si teste proprii. Modulele comunica doar prin API-uri publice, nu prin detalii interne.

```
src/modules/
├── auth/          - Autentificare, sesiuni, parole, RBAC
├── tenant/        - Management clienti (firme)
├── ingestion/     - Parsare XLSX, import jurnal, deduplicare
├── balances/      - Calcul balanta de verificare (pure functions)
├── reporting/     - Calcul KPI + CPP (pure functions)
├── audit/         - Audit trail cu checksum
└── costi/         - Chat AI + tools pentru acces la date
```

### Responsabilitatile fiecarui modul

#### `auth`
- Login / logout
- Verificare sesiune
- Management parole (bcrypt)
- RBAC (Role-Based Access Control) — desi momentan avem un singur rol
- Validare input

#### `tenant`
- Creare, listare, stergere clienti
- Verificare ownership (`userId owns clientId`)
- Generare slug-uri unice per user
- Audit pentru operatii de tenant

#### `ingestion`
- Parsare XLSX cu libraria `xlsx`
- Normalizare format romanesc (data, sume)
- Gestionare compound entries (`%`)
- Extragere denumiri de conturi analitice
- Deduplicare prin MD5 hash
- Batch insert (5000 randuri per batch)
- Extragere parteneri (JournalPartner)

#### `balances`
- **Pure function**: `computeBalanceFromJournal(entries, year, month)`
- Niciun acces la DB — primeste entries ca parametru
- Calcul solduri initiale (cumulativ pana la inceput de an selectat)
- Inchidere automata 6xx/7xx in 121 pe ani precedenti
- Calcul rulaje si solduri finale
- Agregare per cont sintetic si analitic

#### `reporting`
- **Pure function**: `computeKpis(balance_rows)` → 8 KPI-uri
- **Pure function**: `computeCpp(balance_rows)` → structura OMFP 1802

#### `audit`
- Insert append-only in `AuditEvent`
- Calcul checksum SHA-256 pentru tamper detection
- Verificare integritate (nu poate fi sters / modificat)

#### `costi`
- Integrare cu Claude API (Anthropic)
- Definire tools (6 functii)
- Ownership check la fiecare tool call
- Max 5 rounds de tool use per conversatie

### Izolarea modulelor

Fiecare modul expune un **API public** prin fisierul `service.ts`. Alte module apeleaza doar acest API — niciodata detalii interne.

**Exemplu corect**:
```typescript
// In API route
import { importJournal } from "@/modules/ingestion";
import { getBalanceForPeriod } from "@/modules/balances";
```

**Exemplu gresit** (nu fac asta):
```typescript
// NU:
import { parseXLSX } from "@/modules/ingestion/parser";
import { computeRow } from "@/modules/balances/internals";
```

Aceasta disciplina face refactoring usor — putem schimba **cum** calculam balanta fara sa afectam CPP-ul, pentru ca API-ul ramane acelasi.

## 4. Stratul de date

Costify foloseste **PostgreSQL** ca baza de date principala, cu **Prisma** ca ORM.

### Schema principala

```
User (contabil)
  ├── Session (sesiuni active)
  └── Client (firme)
        ├── ImportEvent (istoric importuri)
        ├── JournalLine (intrari in jurnal)
        ├── JournalPartner (mapari partener → cont analitic)
        └── AuditEvent (audit trail — append only)
```

### Tabelele

#### `User`
```typescript
{
  id: string;         // cuid
  email: string;      // unique
  name: string;
  passwordHash: string;  // bcrypt
  emailVerified: boolean;
  active: boolean;
  lastLoginAt: Date?;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `Session`
```typescript
{
  id: string;
  userId: string;     // FK User
  token: string;      // unique, stored in httpOnly cookie
  ipAddress: string?;
  userAgent: string?;
  expiresAt: Date;
  createdAt: Date;
}
```

#### `Client`
```typescript
{
  id: string;
  userId: string;     // FK User — ownership
  name: string;
  slug: string;       // url-friendly, unique per user
  cui: string?;       // CUI fiscal
  caen: string?;      // cod activitate
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `JournalLine`
```typescript
{
  id: string;
  clientId: string;       // FK Client
  importEventId: string;  // FK ImportEvent
  data: Date;
  year: number;           // denormalizat pentru query rapid
  month: number;          // denormalizat pentru query rapid
  ndp: string;            // numar document primar
  contD: string;          // cont debit (cu analitic: "401.00023")
  contDBase: string;      // cont debit sintetic: "401"
  contC: string;          // cont credit (cu analitic)
  contCBase: string;      // cont credit sintetic
  suma: Decimal;          // 18,2 precision
  explicatie: string;
  felD: string;           // tip document
  categorie: string?;
  cod: string?;
  validat: string?;
  tva: Decimal?;
  dedupHash: string?;     // MD5(data|contD|contC|suma|explicatie)
  deletedAt: Date?;       // soft-delete
}
```

**Indexuri**:
- `[clientId, year, month]` — pentru query-uri pe perioada
- `[clientId, deletedAt]` — pentru filtrare active vs sterse
- `[clientId, contDBase]`, `[clientId, contCBase]` — pentru filtrare pe cont
- `[clientId, dedupHash]` — pentru dedup rapid
- `[importEventId]` — pentru audit

#### `ImportEvent`
```typescript
{
  id: string;
  clientId: string;     // FK Client
  fileName: string;
  fileHash: string;     // SHA-256 al fisierului
  sourceFormat: string; // "saga" (momentan)
  entriesAdded: number;
  dateStart: Date?;
  dateEnd: Date?;
  status: string;       // "processing" | "ready"
  createdAt: Date;
}
```

#### `AuditEvent`
```typescript
{
  id: string;
  tenantId: string;       // clientId in majoritatea cazurilor
  actorId: string;        // userId
  actorType: string;      // "user" | "system"
  pipelineStage: string;  // "ingest" | "balance" | "export" | ...
  action: string;         // "create" | "update" | "delete" | ...
  entityType: string;     // "import_event" | "journal_line" | ...
  entityId: string;
  before: Json?;
  after: Json?;
  metadata: Json;
  checksum: string;       // SHA-256
  createdAt: Date;
}
```

## 5. Stratul de aplicatie (Next.js)

Costify este built pe **Next.js 15** cu **React 19**. Structura:

```
src/app/
├── (auth)/           - Pagini publice (login, register disabled)
├── (dashboard)/      - Pagini autenticate
│   ├── clients/      - Lista clienti
│   ├── [slug]/       - Pagina client cu tabs
│   ├── reports/      - Rapoarte globale (TBD)
│   ├── costi/        - Chat full-page
│   ├── docs/         - Documentatia (aici citesti acum)
│   └── internal/     - Pagini interne (doar pentru whitelist)
└── api/              - API routes
    ├── login/        - POST
    ├── logout/       - POST
    ├── import/       - POST (upload jurnal)
    ├── journal/      - GET (paginated), delete
    ├── balance/      - GET (calcul live)
    └── chat/         - POST (Costi conversatii)
```

### Server Components vs Client Components

Costify foloseste extensiv **React Server Components**:

- Listele de clienti, balanta, CPP, KPI-urile sunt **render-uite pe server** — datele sunt fetched direct din DB
- Componenti interactivi (chat, grid virtualizat, modaluri) sunt **client components** cu `"use client"`

Aceasta arhitectura:
- **Reduce bundle-ul JS** trimis la browser
- **Securizeaza logica de business** pe server
- **Performanta mai buna** pentru primul render

## 6. Stack-ul tehnic complet

| Layer | Technology |
|-------|-----------|
| Limbaj | TypeScript (strict mode) |
| Runtime | Node.js 22+ |
| Framework | Next.js 15 |
| Frontend | React 19 + TailwindCSS |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Auth | Custom (bcrypt + session cookies) |
| AI | Claude (Anthropic API) |
| Testing | Vitest (unit + integration) |
| Deploy | Docker + Kubernetes (k3s) |
| Hosting | Hetzner Cloud (ARM servers) |
| Registry | Self-hosted Docker registry |
| Analytics | Umami (self-hosted, cookie-less) |
| SSL | cert-manager + Let's Encrypt |

## 7. Infrastructura de deploy

Productia ruleaza pe:

- **Hetzner cax21** — server ARM, 4 core, 8GB RAM, in Nuremberg
- **k3s** — distributie Kubernetes lightweight
- **PostgreSQL 16** — in cluster, cu volume persistent
- **Docker registry** — privat, la `registry.costify.ro`
- **cert-manager** — certificate SSL automate via Let's Encrypt
- **Umami** — analytics privacy-first, la `analytics.costify.ro`

Deploy-urile se fac via `devops/deploy.sh`:
1. Build Docker image for ARM64
2. Push la registry privat
3. Apply k8s manifests
4. Rolling restart deployment
5. Verify rollout status

## 8. De ce aceste alegeri

### De ce TypeScript strict

Pentru ca banii sunt seriosi. O eroare la calcul poate insemna o factura fiscala gresita. Sistemul de tipuri captureaza multe erori la compile time.

### De ce Next.js

Pentru ca:
- Server components fac securitatea naturala (logica pe server)
- File-based routing simplifica navigarea
- Performanta out-of-the-box
- Bun ecosystem pentru forms, UI, SSR

### De ce PostgreSQL

Pentru ca:
- ACID strict (important pentru date financiare)
- Indexuri avansate (partial, functional, GIN)
- Row-level security disponibil (viitor)
- JSONB pentru audit events
- Performanta excelenta pana la milioane de randuri

### De ce Kubernetes

Pentru ca:
- Rolling updates fara downtime
- Secret management integrat
- Auto-restart la erori
- Scaling orizontal cand va fi nevoie
- Portabilitate intre cloud providers

## 9. Scaling roadmap

### Current (beta)
- Single server Hetzner ARM
- Single PostgreSQL instance
- ~3 utilizatori, ~10 firme, ~50K intrari

### Phase 1 (public launch)
- Read replicas PostgreSQL
- Redis cache pentru balanta
- CDN pentru static assets
- Multiple replicas app
- ~500 utilizatori, ~5000 firme, ~10M intrari

### Phase 2 (scale)
- PostgreSQL cluster (Patroni)
- Sharding per user cand e necesar
- Background jobs cu BullMQ
- Full audit log separat in hot/cold storage
- ~10K utilizatori, ~100K firme, ~100M intrari

### Phase 3 (enterprise)
- Multi-region
- Dedicated deployments per enterprise customer
- Hardware security modules pentru chei
- SOC2 compliance

## Urmatori pasi

- [Principiul jurnal-centric](./principiul-jurnal-centric.md) — de ce jurnalul e sursa de adevar
- [Calculul balantei](./calcul-balanta.md) — algoritmul pas cu pas
- [Calculul CPP](./calcul-cpp.md) — structura OMFP 1802
- [Securitate si izolare](./securitate-izolare.md) — cum protejam datele
