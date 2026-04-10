# Audit si trasabilitate

In contabilitate, **trasabilitatea** este un principiu fundamental: pentru orice cifra dintr-un raport, trebuie sa poti urmari pana la documentul original care a generat-o. Daca un inspector ANAF intreaba "de ce ai aici 12.500 lei la 401?", trebuie sa poti arata exact ce facturi compun aceasta suma, cand au fost introduse, de cine, si ce s-a schimbat de-a lungul timpului.

Costify implementeaza un sistem de **audit append-only** care inregistreaza fiecare schimbare semnificativa, cu garantie criptografica de integritate.

## Principiile sistemului de audit

1. **Fiecare schimbare este inregistrata** — nu exista exceptii. Daca datele se schimba in DB, exista un audit record.
2. **Audit records sunt append-only** — nu se pot modifica si nu se pot sterge. Niciodata.
3. **Audit-ul retine before si after** — diff-ul complet, nu doar "ceva s-a schimbat".
4. **Audit-ul este interogabil** — orice inspector poate urmari orice intrare de la incarcare initiala la raport final.
5. **Audit-ul are stocare separata** — propriul tabel, propriile politici de retentie (minim 7 ani pentru date financiare romanesti, 10 ani in Costify).

## Schema audit_event

```typescript
model AuditEvent {
  id            String   @id @default(cuid())
  tenantId      String           // contextul utilizatorului
  actorId       String           // cine a facut schimbarea
  actorType     String           // 'user' | 'system' | 'scheduler'
  pipelineStage String           // ingest, classify, journal, balance, etc
  action        String           // create, update, delete, recalculate
  entityType    String           // transaction, balance, rule, etc
  entityId      String
  before        Json?            // starea inainte (null pentru create)
  after         Json?            // starea dupa (null pentru delete)
  metadata      Json             // context: IP, file hash, source, etc
  checksum      String           // SHA-256 anti-tampering
  createdAt     DateTime @default(now())
}
```

Coloana cheie este `checksum`: hash criptografic SHA-256 al continutului. Asta permite **detectia de manipulare**: daca cineva modifica direct in DB campul `before` sau `after`, hash-ul nu mai corespunde si un job de verificare detecteaza problema.

## Cand se creeaza audit records

Costify inregistreaza audit events la urmatoarele momente:

### Import jurnal
```
action: "create"
entityType: "import_event"
metadata: {
  fileName: "jurnal-decembrie-2025.xlsx",
  fileHash: "sha256:abc123...",
  entriesAdded: 1547,
  dateRange: "2025-12-01..2025-12-31",
  duplicatesSkipped: 23
}
```
Pentru fiecare import, salvam: numele fisierului, hash-ul lui (asa stim daca cineva uploadeaza acelasi fisier de doua ori), cate intrari noi au fost adaugate, si intervalul de date.

### Stergere date istorice (soft delete)
```
action: "delete"
entityType: "journal_lines_batch"
metadata: {
  startDate: "2025-09-01",
  count: 423,
  reason: "user-initiated correction",
  confirmationToken: "STERGE"
}
before: { entries: [...] }   // snapshot complet al intrarilor sterse
```
Cand utilizatorul corecteaza date istorice prin "Sterge date", **toate intrarile afectate sunt salvate in `before`**. Daca trebuie sa recuperezi date, ai snapshot-ul.

### Login / logout
```
action: "login"
entityType: "session"
metadata: {
  ipAddress: "188.27.x.x",
  userAgent: "Mozilla/5.0...",
  success: true
}
```
Conform GDPR si bunelor practici de securitate, audit-am autentificarile. Asta ajuta in caz de incident: poti vedea cine s-a logat in cont, de unde, cand.

### Modificari de mapari
Cand contabilul editeaza manual numele unui cont analitic in tabul "Plan de Conturi" (in viitor), salvam:
```
action: "update"
entityType: "client_account"
entityId: "401.00023"
before: { customName: "Furnizor Diversi", source: "saga_import" }
after: { customName: "Orange Romania SA", source: "user_edit" }
```

## Calculul checksum-ului

```typescript
function computeChecksum(event: AuditEvent): string {
  const canonical = JSON.stringify({
    tenantId: event.tenantId,
    actorId: event.actorId,
    pipelineStage: event.pipelineStage,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    before: event.before,
    after: event.after,
    metadata: event.metadata,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
```

Hash-ul este **determinist**: aceleasi date dau acelasi hash. Daca cineva schimba un singur caracter in `before`, hash-ul difera complet (avalanche effect SHA-256).

## Detectia de manipulare

Periodic (recomandare: zilnic, in productie cu un cron job), un task de verificare scaneaza audit events si recalculeaza checksum-urile:

```typescript
async function verifyAuditIntegrity() {
  const events = await prisma.auditEvent.findMany();
  const tampered: string[] = [];

  for (const event of events) {
    const expected = computeChecksum(event);
    if (event.checksum !== expected) {
      tampered.push(event.id);
    }
  }

  if (tampered.length > 0) {
    alertAdmin({
      type: "AUDIT_TAMPER_DETECTED",
      eventIds: tampered,
      severity: "critical",
    });
  }
}
```

In productia Costify, acest job inca nu ruleaza ca cron — dar logica de verificare este implementata si testata. Vezi `tests/unit/modules/audit/checksum.test.ts`.

## Stocare append-only la nivel de DB

Pentru a garanta append-only nu doar prin codul aplicatiei, ci si la nivelul DB-ului, recomandarea este:

```sql
-- Userul aplicatiei (costify_app) are doar SELECT + INSERT pe audit_event
GRANT SELECT, INSERT ON audit_event TO costify_app;

-- Migratiile ruleaza cu un user separat (costify_migrate) care are mai multe drepturi
-- DAR niciodata UPDATE sau DELETE pe audit_event
```

Asta inseamna ca **chiar daca aplicatia are un bug si incearca sa modifice un audit record, DB-ul refuza**. Append-only nu e doar o conventie, e o constrangere hardware.

In productia curenta Costify nu am implementat aceasta separare (rulam cu un singur user de DB pentru simplitate), dar e in plan pentru iteratii viitoare cand adaugam SOC 2 / ISO 27001 compliance.

## Retentie

Pentru date financiare romanesti, legea cere pastrare minim **10 ani** dupa exercitiul fiscal curent. Costify retine audit events 10 ani in baza activa, apoi le poate arhiva in cold storage (S3 Glacier sau echivalent).

Pentru sesiuni de login, retentia este 30 de zile. Pentru schimbari operationale (import, delete), 10 ani — la fel ca jurnalul propriu-zis.

## De ce e important pentru contabil

Daca esti contabil cu portofoliu de clienti si folosesti Costify pentru zeci de firme, audit-ul te protejeaza:

1. **Cand un client te intreaba de ce o cifra arata diferit fata de luna trecuta** → poti arata exact ce s-a schimbat: ce import a adus diferenta, ce intrari au fost sterse si reuploadate, cine a facut modificarea.

2. **Cand un inspector ANAF intreaba** → poti urmari orice cifra de pe declaratia D101 / D394 pana la documentul justificativ original (factura, chitanta, extras bancar).

3. **Cand ai erori** (uploadul gresit, stergeri accidentale) → ai snapshot-uri complete in `before`/`after`. Recuperarea e posibila chiar daca datele "live" sunt corupte.

4. **Cand trebuie sa demonstrezi practica diligenta** → log-urile de schimbari sunt evidenta legala ca ai facut munca corect.

## Tooluri de interogare

Costi AI poate accesa audit events prin tool-ul (in dezvoltare) `get_audit_history(client_name, entity_id)`. Asta inseamna ca poti intreba:

> "Costi, ce s-a schimbat pe contul 401.00023 de la inceputul lui decembrie?"

si va lista toate audit events relevante: importuri, stergeri, modificari manuale, cu data si actorul fiecareia.

## Ce NU face audit-ul

- **Nu este versionare** — daca vrei sa vezi exact cum arata balanta in fiecare zi, trebuie un sistem de snapshots separat. Audit-ul retine doar **schimbarile**, nu starile complete.
- **Nu este rezerva de backup** — pentru recuperare in caz de pierdere completa de DB, ai nevoie de backup-uri PostgreSQL clasice.
- **Nu inregistreaza citirea** — daca cineva doar deschide tabul Balanta, nu salvam nimic. Audit-ul este pentru **schimbari**, nu pentru access logging (acela e in nginx/traefik).

## Urmatori pasi

- [Securitate si izolare](./securitate-izolare.md) — alte mecanisme de protectie a datelor
- [Arhitectura platformei](./arhitectura-platformei.md) — locul auditului in arhitectura generala
- [Corecteaza date istorice](./corecteaza-date-istorice.md) — fluxul de stergere si re-import vazut din UI
