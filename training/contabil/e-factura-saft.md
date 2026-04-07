# e-Factura, e-Transport, SAF-T — Romanian Digital Tax Compliance

Baze legale: **OUG nr. 120/2021** (e-Factura), **OUG nr. 41/2022** (e-Transport), **OPANAF nr. 1783/2021** / **OMFP nr. 3781/2019** (SAF-T / D406).

Technical and operational reference for Costify's integration with Romania's digital tax infrastructure. Updated for **2025-2026** obligations.

---

## RO e-Factura

### Legal Basis
- **OUG 120/2021** — initial implementation
- **OG 13/2024** — consolidare obligativitate, eliminare dublu regim (hârtie + electronic) de la 1 iul 2024, regim sancționator
- **Modificări 2025** — extindere la B2C (toate facturile cu locul în România), e-TVA pre-completat
- OMFP for technical specifications (CIUS-RO versioning)

### Scope (2025-2026)
- **B2B (business to business)**: **Mandatory** for all transactions between Romanian established entities
- **B2G (business to government)**: **Mandatory** since 2022
- **B2C (business to consumer)**: **Mandatory from 2025** for all invoices with place of supply in Romania (extindere semnificativă față de etapele anterioare)
- **Cross-border**: e-Factura is required for all invoices with place of supply in Romania; intra-EU and export invoices follow specific rules

**Key 2024 change (OG 13/2024)**: Eliminated dual regime (paper + electronic) from 1 July 2024. Consolidated mandatory transmission, clarified deadlines, strengthened penalty regime.

### How It Works
```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│ Supplier │────>│ ANAF e-Factura│────>│  Buyer   │
│ (emitent)│     │   Platform   │     │(destinat)│
└──────────┘     └──────────────┘     └──────────┘
     │                  │                    │
     │  1. Upload XML   │                    │
     │  (max 5 days     │                    │
     │   from issue)    │                    │
     │                  │  2. Validate &     │
     │                  │     assign index   │
     │                  │                    │
     │                  │  3. Available in   │
     │                  │     buyer's SPV    │
     │                  │                    │
     │  4. Download     │                    │  4. Download
     │     confirmation │                    │     invoice
```

### XML Format
Based on **CIUS-RO** (Core Invoice Usage Specification for Romania), derived from European standard **EN 16931**.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ID>FV-2024-001234</cbc:ID>
  <cbc:IssueDate>2024-03-15</cbc:IssueDate>
  <cbc:DueDate>2024-04-15</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>

  <!-- Supplier -->
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RO12345678</cbc:CompanyID>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>SC Example SRL</cbc:RegistrationName>
        <cbc:CompanyID>J40/1234/2020</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <!-- Buyer -->
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>RO87654321</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingCustomerParty>

  <!-- Line Items -->
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">10</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="RON">1000.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>Servicii consultanta IT</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>21</cbc:Percent>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
  </cac:InvoiceLine>

  <!-- Tax Total -->
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="RON">210.00</cbc:TaxAmount>
  </cac:TaxTotal>

  <!-- Monetary Total -->
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="RON">1000.00</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="RON">1210.00</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="RON">1210.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>
```

### Invoice Type Codes (InvoiceTypeCode)
| Code | Type | Romanian |
|------|------|----------|
| 380 | Commercial invoice | Factura comerciala |
| 381 | Credit note | Nota de creditare (storno) |
| 384 | Corrective invoice | Factura corectiva |
| 389 | Self-billed invoice | Autofactura |
| 751 | Invoice information for accounting | Informatie factura |

### Tax Category Codes
| Code | Meaning | TVA Rate |
|------|---------|----------|
| S | Standard rate | 21% or 11% (din 1 iul 2025; anterior 19%/9%/5%) |
| Z | Zero rated | 0% (exports, intra-EU) |
| E | Exempt | No TVA |
| AE | Reverse charge | Taxare inversa |
| K | Intra-community supply | 0% |
| G | Export | 0% |
| O | Outside scope | N/A |

**Important change (1 iulie 2025)**: The former 5% and 9% rates have been abrogated and replaced by a single 11% reduced rate. The standard rate increased from 19% to 21%. The old 9% rate is retained only as a transitional exception for certain housing deliveries until 31 July 2026. Update all XML generation to use current rates. See `constante-fiscale-2026.md` for definitive rates.

### ANAF API Integration
- **Upload endpoint**: `https://api.anaf.ro/prod/FCTEL/rest/upload`
- **Download endpoint**: `https://api.anaf.ro/prod/FCTEL/rest/descarcare`
- **Status check**: `https://api.anaf.ro/prod/FCTEL/rest/stareMesaj`
- **Authentication**: OAuth2 via SPV certificate
- **Response**: XML with upload index (index de incarcare)

### Penalties
| Violation | Fine (RON) |
|-----------|-----------|
| Not uploading invoice to e-Factura (legal entities) | 5,000 - 10,000 |
| Not uploading invoice to e-Factura (PFA/individuals) | 2,500 - 5,000 |
| Late upload (after 5 working days) | Warning first, then fines |

---

## RO e-Transport

### Legal Basis
- **OUG asociată cu 2022** (nr. exact necesită verificare MO — în practică se referă la OUG 41/2022)
- OMFP / OPANAF for technical specifications
- Modificări ulterioare 2023-2025 privind extinderea sferei de aplicare

### Scope
Mandatory for road transport of:
- **High fiscal risk goods**: alcohol, tobacco, vegetables, clothing, footwear, construction materials
- **Goods above threshold**: Generally goods worth > 500 RON or weight > 500 kg per transport

### How It Works
```
1. Before transport begins:
   - Declare transport in ANAF system
   - Receive UIT (Unique Identification of Transport) code

2. During transport:
   - UIT code must accompany goods (printed or digital)
   - GPS monitoring devices for certain categories

3. At destination:
   - Confirm receipt in system
   - Reconcile with e-Factura
```

### UIT Code
- Unique alphanumeric identifier
- Generated by ANAF system upon declaration
- Valid for the specific transport route and goods
- Must be on transport documents

### Penalties
| Violation | Fine (RON) |
|-----------|-----------|
| Transport without UIT | 10,000 - 50,000 + confiscation risk |
| Incorrect transport declaration | 5,000 - 10,000 |
| Missing GPS device (when required) | 10,000 - 50,000 |

---

## SAF-T Romania (D406)

### Legal Basis
- OMFP 3781/2019
- OPANAF for technical specifications and schemas

### Scope & Timeline
| Taxpayer Category | Mandatory Since |
|---|---|
| Large taxpayers (contribuabili mari) | January 2022 |
| Medium taxpayers (contribuabili mijlocii) | January 2023 |
| **Small taxpayers (contribuabili mici)** | **2025** |
| **Non-profit organizations** | Depinde de încadrare ANAF și activitate economică |

**2025 update**: Starting 2025, **small taxpayers** are obligated to file SAF-T (D406). For ONG-uri, obligația depinde de încadrarea ca contribuabil (mare/mijlociu/mic) și de existența activității economice. Every Costify tenant must be SAF-T capable.

### Filing Frequency
- **Monthly**: For entities filing monthly D300 (TVA)
- **Quarterly**: For entities filing quarterly
- **Deadline**: Same as D300 deadline (25th of following month/quarter)

### SAF-T Structure (D406 Sections)

```xml
<AuditFile>
  <Header>
    <!-- Company identification, period, software info -->
  </Header>

  <MasterFiles>
    <GeneralLedgerAccounts>
      <!-- Complete chart of accounts used -->
    </GeneralLedgerAccounts>
    <Customers>
      <!-- All customers with CUI, name, address -->
    </Customers>
    <Suppliers>
      <!-- All suppliers with CUI, name, address -->
    </Suppliers>
    <TaxTable>
      <!-- TVA rates and tax codes used -->
    </TaxTable>
    <Products>
      <!-- Products/services catalog (optional) -->
    </Products>
    <PhysicalStock>
      <!-- Inventory quantities and values (annual) -->
    </PhysicalStock>
    <Owners>
      <!-- Shareholders/owners information -->
    </Owners>
    <Assets>
      <!-- Fixed asset register (annual) -->
    </Assets>
  </MasterFiles>

  <GeneralLedgerEntries>
    <!-- ALL journal entries for the period -->
    <Journal>
      <Transaction>
        <TransactionID>NC-2026-001234</TransactionID>
        <Period>03</Period>
        <TransactionDate>2026-03-15</TransactionDate>
        <Description>Factura vanzare servicii</Description>
        <Line>
          <AccountID>4111</AccountID>
          <DebitAmount>1210.00</DebitAmount>
        </Line>
        <Line>
          <AccountID>704</AccountID>
          <CreditAmount>1000.00</CreditAmount>
        </Line>
        <Line>
          <AccountID>4427</AccountID>
          <CreditAmount>210.00</CreditAmount>
        </Line>
      </Transaction>
    </Journal>
  </GeneralLedgerEntries>

  <SourceDocuments>
    <SalesInvoices>
      <!-- All issued invoices with details -->
    </SalesInvoices>
    <PurchaseInvoices>
      <!-- All received invoices with details -->
    </PurchaseInvoices>
    <Payments>
      <!-- All payments made/received -->
    </Payments>
    <MovementOfGoods>
      <!-- Inventory movements (if applicable) -->
    </MovementOfGoods>
  </SourceDocuments>
</AuditFile>
```

### Key Data Requirements

#### GeneralLedgerAccounts (Plan de Conturi)
For each account:
- AccountID (e.g., "5121")
- AccountDescription (e.g., "Conturi la banci in lei")
- AccountType: "Activ" / "Pasiv" / "Bifunctional"
- OpeningDebitBalance / OpeningCreditBalance
- ClosingDebitBalance / ClosingCreditBalance

#### Customers / Suppliers
For each:
- CompanyID (CUI)
- RegistrationNumber (J number)
- Name
- Address (full, structured)
- BankAccount (IBAN)
- Contact information

#### GeneralLedgerEntries (Journal Entries)
For each transaction:
- Unique ID
- Date
- Period (month)
- Description
- Source document reference
- Each line: AccountID, DebitAmount or CreditAmount
- Tax information if applicable

#### Sales/Purchase Invoices
For each invoice:
- Invoice number and date
- Supplier/Customer ID
- Line items with: description, quantity, unit price, amount, tax rate, tax amount
- Payment terms
- Currency

### Validation Rules
ANAF validates SAF-T files against:
1. **Schema validation** -- XML structure matches XSD schema
2. **Cross-referencing** -- Totals match between sections
3. **Consistency** -- Opening balances match previous period closing
4. **Completeness** -- All required fields populated
5. **Tax reconciliation** -- TVA in SAF-T matches D300

### Penalties
| Violation | Fine (RON) |
|-----------|-----------|
| Non-filing of D406 | 1,000 - 5,000 (initially warning) |
| Late filing | 500 - 3,500 |
| Incomplete/incorrect data | 500 - 3,500 |

---

## RO e-TVA (Pre-completed VAT Return)

### How It Works
```
1. ANAF collects data from:
   - e-Factura (sales and purchase invoices)
   - e-Transport (goods movements)
   - SAF-T (D406) submissions
   - Customs declarations (imports/exports)
   - Intra-EU transaction reports (D390)

2. ANAF pre-fills D300 (VAT return) with:
   - TVA colectata (output VAT) from issued invoices
   - TVA deductibila (input VAT) from received invoices
   - Intra-EU acquisitions/deliveries
   - Import VAT

3. Taxpayer reviews and:
   - Accepts pre-filled data OR
   - Adjusts with explanations for differences
   - Files final D300

4. ANAF flags discrepancies for potential audit
```

### Discrepancy Categories
| Type | Description | Risk Level |
|------|-------------|------------|
| Facturi lipsa | Invoices in buyer's records but not seller's e-Factura | High |
| Sume diferite | Amount differences between seller and buyer | Medium |
| TVA incorect | Wrong TVA rate applied | Medium |
| Furnizor inactiv | Purchase from inactive taxpayer | High |
| Depasire termen | Late invoice upload | Low |

---

## Costify Integration Architecture

### Data Flow for Digital Compliance
```
┌─────────────────────────────────────────────────┐
│                  COSTIFY                         │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Ingestion│──│ Journal  │──│ Export Engine  │ │
│  │ Pipeline │  │ Ledger   │  │               │ │
│  └──────────┘  └──────────┘  └───────┬───────┘ │
│                                       │         │
│       ┌───────────────────────────────┤         │
│       │           │           │       │         │
│  ┌────▼───┐  ┌───▼────┐ ┌───▼───┐ ┌─▼──────┐ │
│  │e-Factura│  │  D300  │ │ D406  │ │e-Trans │ │
│  │  XML   │  │  XML   │ │ XML   │ │  API   │ │
│  └────┬───┘  └───┬────┘ └───┬───┘ └──┬─────┘ │
└───────┼──────────┼──────────┼────────┼────────┘
        │          │          │        │
   ┌────▼──────────▼──────────▼────────▼────┐
   │          ANAF SYSTEMS                   │
   │  e-Factura │ SPV │ D300 │ D406 │ e-Tr │
   └────────────────────────────────────────┘
```

### Required Costify Capabilities
1. **e-Factura XML generation** -- for every sales invoice
2. **e-Factura XML parsing** -- for incoming purchase invoices
3. **ANAF API integration** -- upload/download/status check
4. **D300 computation** -- monthly TVA return from journal entries
5. **D406 SAF-T export** -- complete accounting data in SAF-T XML
6. **e-Transport declarations** -- for applicable goods
7. **Discrepancy detection** -- match internal records with ANAF data
8. **Certificate management** -- ANAF SPV digital certificates per tenant

### Data Mapping: Costify Transaction -> e-Factura Line
```typescript
interface CostifyToEFactura {
  // Costify internal
  transactionId: string
  journalEntryId: string
  contDebitor: string      // e.g., "4111"
  contCreditor: string     // e.g., "704" and "4427"

  // e-Factura mapping
  invoiceNumber: string
  invoiceDate: Date
  supplierCUI: string
  buyerCUI: string
  lineItems: {
    description: string
    quantity: number
    unitCode: string       // UN/ECE Recommendation 20
    unitPrice: number
    lineAmount: number     // net
    taxCategory: 'S' | 'Z' | 'E' | 'AE' | 'K' | 'G' | 'O'
    taxPercent: number     // 21, 11, 9 (transitional), 0
    taxAmount: number
  }[]
  totalNet: number
  totalTax: number
  totalGross: number
  currency: string
  paymentTerms: string
  paymentMeans: string     // Bank transfer, cash, etc.
  bankAccount: string      // IBAN
}
```

### Data Mapping: Costify -> SAF-T D406
```typescript
interface CostifyToSAFT {
  // Header
  companyName: string
  companyCUI: string
  companyJNumber: string
  fiscalYear: number
  period: number          // month (1-12)
  softwareName: 'Costify'
  softwareVersion: string

  // Master files from tenant configuration
  chartOfAccounts: AccountDefinition[]
  customers: CustomerMaster[]
  suppliers: SupplierMaster[]
  taxCodes: TaxCodeDefinition[]
  fixedAssets: FixedAssetRegister[]  // annual only

  // Transactional data from journal
  journalEntries: JournalEntry[]     // ALL entries for period
  salesInvoices: SalesInvoice[]
  purchaseInvoices: PurchaseInvoice[]
  payments: PaymentRecord[]
}
```
