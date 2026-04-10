# Corecteaza date istorice

Uneori ai nevoie sa corectezi date istorice in Costify — fie pentru ca ai gasit o greseala, fie pentru ca contabilul a facut modificari in Saga care trebuie reflectate. Acest articol iti arata cum sa o faci corect.

## Cand ai nevoie

Scenariile tipice:

- **Contabilul a gasit o eroare** intr-o perioada trecuta si a corectat-o in Saga
- **Au aparut intrari noi** pentru o luna deja importata (de exemplu, facturi primite cu intarziere)
- **S-au modificat sume sau conturi** pentru intrari existente
- **Doresti sa re-importezi** intreaga perioada de la o anumita data
- **Ai importat gresit un fisier** (alt client, alta perioada)

## Principiul de baza: soft-delete + reimport

Corectarea datelor istorice se face in **doi pasi**:

```
1. Stergere soft a intrarilor pe perioada afectata
   │
   ▼
2. Reimport cu datele corecte din Saga
```

Costify foloseste **soft-delete** — intrarile nu sunt sterse fizic, doar marcate cu `deletedAt = now`. Ele dispar din calcule (balanta, CPP, KPI) dar raman in baza de date pentru audit. Aceasta abordare garanteaza:

- **Trasabilitate** — auditul complet ramane intact
- **Reversibilitate** — in cazuri rare, echipa Costify poate sa "restaureze" intrari sterse
- **Conformitate legala** — pastram datele 10 ani chiar daca utilizatorul "le sterge"

## Procedura

### Pasul 1: Deschide modalul de stergere

In pagina clientului, apasa pe menu-ul **"..."** (trei puncte) din coltul dreapta sus, langa butonul "Upload Jurnal". Selecteaza **"Sterge date istorice"**.

Se deschide un modal cu un formular.

### Pasul 2: Selecteaza data de la care sa stergi

Alege **data de inceput** — toate intrarile de la aceasta data inclusiv, pana in prezent, vor fi sterse.

De exemplu:
- Daca selectezi `1 decembrie 2025`, toate intrarile din decembrie 2025, ianuarie 2026, februarie 2026 etc. vor fi sterse
- Daca selectezi `1 ianuarie 2025`, tot anul 2025 si mai recent este sters
- Daca selectezi `1 ianuarie 2020`, practic stergi tot jurnalul

**Nu poti sterge doar o luna din mijloc** (de exemplu, doar februarie 2025). Motivul: balanta este un calcul cumulativ — stergerea doar a unei luni din mijloc ar lasa soldurile in stari inconsistente. Trebuie sa stergi **pana in prezent** ca sa poti re-importa corect.

### Pasul 3: Verifica previzualizarea

Costify numara cate intrari vor fi sterse si iti arata:

```
Date: de la 1 decembrie 2025 pana in prezent
Intrari afectate: 2.456
```

Verifica ca numarul e ceea ce te astepti. Daca pare prea mare sau prea mic, revizuieste data de start.

### Pasul 4: Confirma cu cuvant-cheie

Pentru a preveni stergeri accidentale, trebuie sa **tastezi manual** cuvantul `STERGE` in campul de confirmare. Paste (Ctrl+V) este **blocat** — trebuie sa tastezi caracter cu caracter.

Cand ai tastat corect, butonul "Sterge" devine activ (rosu). Apasa-l.

### Pasul 5: Stergerea se executa

In ~1-2 secunde, toate intrarile afectate sunt marcate `deletedAt = now`. Se creeaza un audit event cu:

- Numarul de intrari sterse
- Data de la care s-a sters
- Snapshot-ul complet al datelor sterse (pentru recuperare)
- Utilizatorul care a facut operatia
- Timestamp-ul exact

### Pasul 6: Reimporteaza datele corecte

Acum poti face un import nou cu datele corecte:

1. Exporta din nou din Saga, incluzand perioada sterilasa
2. Upload fisier in Costify
3. Costify va vedea ca toate intrarile sunt "noi" (pentru ca cele vechi sunt soft-deleted) si le va adauga
4. Balanta si CPP sunt recalculate automat

## Ce se intampla cu hash-urile la reimport

O intrebare naturala: "daca am sters intrari cu hash X si acum reimport, Costify le va vedea ca noi sau ca duplicate?"

**Raspuns: ca NOI.** Motivul:

```sql
-- Interogarea de dedup verifica doar intrarile active
SELECT dedupHash FROM JournalLine
WHERE clientId = ? AND deletedAt IS NULL
```

Intrarile cu `deletedAt IS NOT NULL` sunt ignorate in dedup. Deci dupa soft-delete + reimport, ai in DB:
- **Intrarile vechi** cu `deletedAt = <data stergerii>` (invizibile in calcule)
- **Intrarile noi** cu `deletedAt = NULL` (active, contribuie la calcule)

Ambele versiuni coexista in DB pentru audit. Doar cele noi sunt folosite in rapoarte.

## Exemple de scenarii

### Scenariu 1: Corectare de suma

**Problem**: Contabilul a descoperit ca o factura din februarie 2025 a fost inregistrata cu suma gresita (ar fi trebuit 1234 RON, nu 1243 RON).

**Rezolvare**:

1. Contabilul corecteaza in Saga C
2. Exporti din Saga tot istoricul
3. In Costify, deschizi clientul si apesi "Sterge date istorice"
4. Selectezi data `1 februarie 2025`
5. Apas, confirmi cu STERGE — se sterg ~400 intrari
6. Upload noul fisier — Costify importeaza toate cele 400 + eventuale intrari noi adaugate dupa februarie
7. Balanta arata acum cifrele corecte

### Scenariu 2: Intrari lipsa adaugate retroactiv

**Problem**: Contabilul primeste o factura din noiembrie 2025 cu intarziere (in aprilie 2026). Vrea sa o inregistreze in luna corespunzatoare.

**Rezolvare**:

1. Contabilul inregistreaza in Saga cu data reala (noiembrie 2025)
2. Exporti din Saga
3. In Costify, apesi Upload Jurnal (fara sa stergi nimic)
4. Costify detecteaza automat intrarea noua (hash nou) si o adauga
5. Balanta pe noiembrie 2025 se actualizeaza

In acest caz **nu este nevoie de soft-delete** — pentru ca nu s-a modificat nimic existent, doar s-a adaugat.

### Scenariu 3: Import gresit de fisier

**Problem**: Ai incarcat gresit fisierul Firmei X in clientul Firma Y.

**Rezolvare**:

1. In clientul Firma Y, apesi "Sterge date istorice"
2. Selectezi cea mai veche data posibila (ex: `1 ianuarie 2020`) — sterge tot jurnalul
3. Confirmi cu STERGE
4. Jurnalul e acum gol (intrarile sunt in DB dar soft-deleted)
5. Incarci fisierul corect pentru Firma Y

### Scenariu 4: Migrare intre clienti

**Problem**: Ai creat doi clienti in Costify pentru aceeasi firma (prin greseala) si vrei sa consolidezi totul intr-unul singur.

**Rezolvare actuala**:

1. Pe clientul "greșit", "Sterge date istorice" de la cea mai veche data
2. Exporta din Saga tot istoricul firmei
3. Incarca in clientul "corect"
4. Lasa clientul greșit in lista (momentan nu ai cum sa-l stergi)

**Mai bine**: contactaza echipa Costify, vom sterge clientul duplicat complet din DB.

## Audit trail

Fiecare stergere creeaza un `AuditEvent` complet:

```json
{
  "id": "evt_xxx",
  "tenantId": "client_xxx",
  "actorId": "user_xxx",
  "actorType": "user",
  "pipelineStage": "ingest",
  "action": "delete",
  "entityType": "journal_lines_bulk",
  "entityId": "",
  "before": null,
  "after": null,
  "metadata": {
    "fromDate": "2025-12-01T00:00:00.000Z",
    "deletedCount": 2456,
    "sampleEntries": [
      { "data": "2025-12-01", "contD": "5121", "contC": "4111", "suma": 1250.00 },
      // ... primele 10 pentru snapshot
    ]
  },
  "checksum": "sha256_hash",
  "createdAt": "2026-04-10T14:30:00.000Z"
}
```

Checksum-ul SHA-256 garanteaza ca record-ul nu poate fi modificat ulterior. Chiar daca cineva ar avea acces la DB si ar modifica un audit record, check-ul periodic ar detecta alterarea.

## Limitari cunoscute

- **Granularitate** — nu poti sterge doar o luna specifica, doar "de la data X pana in prezent"
- **Fara "Undo"** — odata confirmata stergerea, nu exista buton de undo. Trebuie reimport.
- **Fara recuperare UI** — intrarile soft-deleted nu pot fi "restaurate" din interfata. Necesita interventie manuala in DB de catre echipa Costify.
- **Nu sterge audit events** — audit events sunt append-only, nu pot fi sterse niciodata.

## Ce se intampla daca faci stergere gresita

Daca ai sters accidental perioada greșita:

1. **Nu intra in panica** — datele nu sunt pierdute, doar marcate ca soft-deleted
2. **Contacteaza echipa Costify** — putem sa "unsoft-delete" manual in DB
3. **Sau reimporta** — daca ai o copie recenta a XLSX din Saga, reimportul readuce toate intrarile (sub forma de intrari "noi" cu `deletedAt = NULL`)

Cazul al doilea este cel mai simplu si rapid.

## Urmatori pasi

- [Importa jurnalul din Saga C](./importa-jurnal.md) — fluxul normal de import
- [Deduplicarea la reimport](./deduplicare-import.md) — cum functioneaza dedup-ul
- [Audit si trasabilitate](./audit-si-trasabilitate.md) — cum functioneaza audit trail-ul
