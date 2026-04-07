---
id: "tva-incorrect-invoice-2026"
topic: "tva"
task_types: ["tax_determination", "bookkeeping"]
articles: ["art. 319 CF", "art. 330 CF"]
keywords: ["factura eronata", "storno", "factura corectiva", "nota de creditare", "TVA gresit"]
level: 3
---

Tratamentul TVA pentru facturi emise eronat:

TIPURI DE ERORI:
1. Cota TVA gresita (ex: 21% in loc de 11%)
2. Baza de impozitare gresita
3. Date de identificare gresite (CUI, denumire)
4. Factura emisa fara TVA cand trebuia cu TVA (sau invers)

CORECTARE:
- Se emite FACTURA CORECTIVA (nota de creditare / storno): anuleaza factura initiala si se emite factura corecta
- InvoiceTypeCode in e-Factura: 381 (credit note / nota de creditare) sau 384 (factura corectiva)
- Factura corectiva se transmite si ea in e-Factura SPV

CONTABILIZARE STORNO:
- Storno rosu (inregistrare cu minus): se inverseaza inregistrarea initiala
- Apoi se inregistreaza factura corecta

EFECT TVA:
- TVA colectata gresit se corecteaza in decontul D300 din luna in care se emite factura corectiva
- Daca s-a colectat TVA in plus: se diminueaza TVA colectata (credit 4427)
- Daca s-a colectat TVA in minus: se suplimenteaza TVA colectata (debit 4427)
- Cumparatorul ajusteaza corespunzator TVA deductibila (4426)

TERMEN: corectarea se face imediat ce se constata eroarea. Nu exista termen maxim legal, dar intarzierea poate genera diferente de TVA la control.
