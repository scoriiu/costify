# Securitate si izolare

Costify gestioneaza date financiare reale ale firmelor reale. O scurgere de date sau o problema de izolare ar putea expune cifrele unui client catre alti utilizatori — sau, in cel mai rau caz, catre internet. Acest articol descrie mecanismele prin care platforma protejeaza datele.

## Modelul de amenintari

Inainte sa vorbim de solutii, sa enumeram **ce vrem sa prevenim**:

| Amenintare | Vector | Impact |
|---|---|---|
| Scurgere intre tenanti | Bug in cod care lasa un user sa vada datele altui user | Critic — expunere de date financiare |
| Acces neautorizat | Sesiune furata, parola compromisa | Critic — acces complet la cont |
| Escaladare de privilegii | RBAC bypass | Mare — actiuni neautorizate |
| Injectie SQL | Query-uri ne-parametrizate | Critic — data breach |
| XSS (cross-site scripting) | Input ne-sanitizat afisat in UI | Mare — furt de sesiune |
| CSRF | Cereri de modificare fara token | Mediu — actiuni neautorizate |
| Tampering audit | Modificare directa in DB | Mare — pierdere de trasabilitate |
| DDoS | Flood de requesturi | Mediu — degradare serviciu |
| Furnizor compromis | Dependinta cu vulnerabilitate | Mare — execution arbitrar |
| Insider malicious | Operator cu acces la productie | Critic — breach masiv |

## Izolarea multi-tenant

**Modelul**: fiecare utilizator (contabil) are propriul portofoliu de clienti (firme). Datele unui contabil nu trebuie sa fie vizibile altui contabil — niciodata, in niciun caz.

**Cum implementam asta**:

### Nivel 1: Filtrare la nivel de aplicatie

Fiecare query DB include `userId` in WHERE:

```typescript
const clients = await prisma.client.findMany({
  where: { userId: ctx.userId, active: true },
});
```

`userId` vine din contextul de sesiune injectat la middleware. **Nu este optional** — endpoints-urile primesc userId-ul ca prim parametru, iar serviciile il propaga prin toata stiva.

Daca cineva uita sa puna `userId` in WHERE, query-ul intoarce **toti** clientii din DB. De aceea avem...

### Nivel 2: Verificare in test suite

Avem teste de integration care verifica boundary-ul:

```typescript
it("user A cannot see user B clients", async () => {
  await prisma.client.create({ data: { userId: userA, name: "Alpha SRL" } });
  await prisma.client.create({ data: { userId: userB, name: "Beta SRL" } });

  const aResult = await listClients(userA);
  const bResult = await listClients(userB);

  expect(aResult.map(c => c.name)).toEqual(["Alpha SRL"]);
  expect(bResult.map(c => c.name)).toEqual(["Beta SRL"]);
});
```

### Nivel 3 (in plan): Row-Level Security PostgreSQL

In productia curenta, ne bazam pe nivelele 1 si 2. Pentru iteratii viitoare, vom adauga **PostgreSQL Row-Level Security** ca a treia bariera:

```sql
ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Client"
  FOR ALL
  USING ("userId" = current_setting('app.user_id')::text);
```

Cu RLS activat, **chiar daca aplicatia are un bug** si trimite un query fara filtru `userId`, DB-ul aplica filtrarea automat. Defense in depth.

## Autentificare

### Sesiuni cu cookie httpOnly

Cand utilizatorul face login, generam un token random (32 bytes) si il stocam intr-o sesiune in DB:

```typescript
const token = randomBytes(32).toString("hex");
await prisma.session.create({
  data: { userId, token, expiresAt: addDays(now, 7) },
});

cookieStore.set("sid", token, {
  httpOnly: true,
  secure: true,                          // doar HTTPS
  sameSite: "lax",                       // protectie CSRF
  path: "/",
  maxAge: 7 * 24 * 60 * 60,
});
```

Caracteristicile cheie:
- **httpOnly**: cookie-ul nu poate fi citit din JavaScript, deci atacurile XSS nu pot fura token-ul.
- **secure**: cookie-ul este trimis doar peste HTTPS. Pe HTTP simplu, browser-ul il refuza (cum am descoperit dureros pe productie cand am uitat sa setam HTTPS redirect).
- **sameSite=lax**: protejeaza impotriva CSRF — cookie-ul nu se trimite pe POST-uri cross-origin.
- **expirare 7 zile**: sesiunea moare automat dupa 7 zile de inactivitate. Re-login necesar.

### Hashing parola cu Argon2

Parolele utilizatorilor sunt stocate hash-uite cu **Argon2id**, algoritmul recomandat de OWASP:

```typescript
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,    // 64 MB
  timeCost: 3,
  parallelism: 1,
});
```

Argon2 este rezistent la atacuri GPU si ASIC. Spre deosebire de bcrypt (care e bazat pe CPU), Argon2 forteaza cantitati mari de RAM, ceea ce face brute-force-ul exponential mai scump.

### Forta bruta protection

Dupa 5 incercari esuate, contul este blocat temporar (5 minute). Aceasta protectie nu e implementata inca in versiunea curenta — e in plan.

## HTTPS si HSTS

Toata traficul Costify este pe HTTPS. Pentru a forta asta:

1. **Traefik HTTPS redirect** — orice request pe HTTP primeste un 308 Permanent Redirect catre HTTPS.
2. **HSTS header** — `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`. Asta spune browser-ului "pentru urmatorul an, NU mai incerca HTTP la costify.ro, mergi direct pe HTTPS".

Ambele sunt configurate in `devops/ingress.yaml` ca middleware-uri Traefik.

## Validarea input-ului

Toate inputurile sunt validate cu **Zod schemas**. Niciun string nesanitizat ajunge in service layer:

```typescript
const importSchema = z.object({
  clientId: z.string().cuid(),
  fileName: z.string().min(1).max(255),
  fileContent: z.instanceof(Buffer),
});

export async function importJournal(input: unknown) {
  const validated = importSchema.parse(input);  // arunca daca nu e valid
  // ... continua cu date validate
}
```

Beneficiile:
- **Cod fara `any`** — TypeScript stie tipurile reale dupa validare.
- **Erori clare** — daca input-ul e invalid, primim un mesaj concret despre ce e greșit.
- **Defense in depth** — chiar daca frontend-ul are bug, backend-ul refuza date corupte.

## Protectia impotriva SQL injection

Folosim **Prisma ORM** care **intotdeauna** parametrizeaza query-urile. Niciun string nu este concatenat in SQL. Exemplu:

```typescript
// SAFE — Prisma parametrizeaza userId-ul
await prisma.client.findMany({ where: { userId: ctx.userId } });
```

Niciodata:
```typescript
// UNSAFE — am scrie raw SQL cu user input
await prisma.$queryRawUnsafe(`SELECT * FROM Client WHERE userId = '${ctx.userId}'`);
```

In codul Costify, nu folosim `$queryRawUnsafe` nicaieri. Daca cineva incearca, code review-ul respinge.

## Headers de securitate

Productia Costify trimite urmatoarele headers la fiecare request:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
```

- **HSTS** — descris mai sus.
- **X-Content-Type-Options: nosniff** — previne MIME-type confusion.
- **X-Frame-Options: DENY** — Costify nu poate fi incarcat intr-un iframe (protectie clickjacking).
- **Referrer-Policy** — limitam ce informatii leak-uim cand userii navigheaza catre alte site-uri.

In plan: **Content-Security-Policy** stricta. Necesita testare atenta cu Next.js si script-urile inline.

## Secrete si API keys

Niciun secret nu este in cod. Toate parolele, API keys, certificatele sunt in Kubernetes Secrets:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: costify-secrets
  namespace: costify
data:
  DATABASE_URL: <base64>
  ANTHROPIC_API_KEY: <base64>
  SESSION_SECRET: <base64>
```

Aplicatia citeste secretele ca variabile de mediu la runtime. Daca developer-ul greseste si pune o cheie in cod, **gitleaks** (rulat in CI) detecteaza si blocheaza commit-ul.

## Backup si recovery

PostgreSQL face backup zilnic catre un volum persistent separat. In iteratiile viitoare, backup-ul va fi si in S3 (regiune diferita) cu encryption-at-rest.

Pentru recovery: avem documentat un runbook in `docs/architecture.md` care explica pas cu pas cum sa restaurezi DB-ul dintr-un snapshot.

## Audit si trasabilitate

Pentru detalii despre cum log-uim modificarile si cum garantam integritatea log-urilor, vezi [Audit si trasabilitate](./audit-si-trasabilitate.md).

## Ce NU acoperim inca

Sa fim onesti — Costify este un produs in dezvoltare activa. Lista de "in plan" pentru securitate include:

- **MFA (2FA)** — second factor pentru autentificare. In plan pentru iteratii apropiate.
- **PostgreSQL RLS** — al treilea nivel de izolare la nivel de DB. In plan.
- **Penetration testing extern** — recomandare anuala. Nu am facut inca.
- **SOC 2 Type II** — certificare formala. Pentru cand vom avea trafic enterprise.
- **Bug bounty program** — incurajeaza cercetatorii sa raporteze vulnerabilitati. Pentru cand avem suficient trafic.
- **Incident response runbook** — pasi clari pentru gestionarea unei brese. Schita exista, completarea e in plan.

Pentru un produs early-stage cu o baza mica de utilizatori si fara conformitate reglementata, nivelul actual este rezonabil. Pentru enterprise sau healthcare, ar fi insuficient.

## Raportarea problemelor de securitate

Daca descoperi o problema de securitate in Costify, te rugam sa scrii direct la `solomon.coriiu@nisindo.com` in loc sa deschizi un issue public. Vom raspunde in 48 de ore si vom rezolva problema inainte de orice disclosure.

## Urmatori pasi

- [Audit si trasabilitate](./audit-si-trasabilitate.md) — log-uri inviolabile
- [Arhitectura platformei](./arhitectura-platformei.md) — contextul general
- [Costi AI — tool use si scoping](./costi-ai.md) — cum acceseaza AI-ul datele in siguranta
