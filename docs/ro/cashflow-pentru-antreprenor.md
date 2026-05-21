# Cashflow pentru antreprenor

Ghid pentru tine, patronul firmei. Iti explic ce vezi pe pagina `/firma` si ce inseamna fiecare numar.

---

## Cine vede ce

**Contabilul tau** introduce facturile in programul lui de contabilitate (Saga, WinMentor, etc.), apoi le incarca in Costify. Lunar, **publica** o "fotografie" a firmei.

**Tu**, in calitate de patron, vezi acea fotografie pe `/firma`. Cifrele sunt cele pe care le-a vazut si contabilul, doar ca sunt traduse intr-un limbaj usor de inteles: in loc de "contul 4111.01 sold debitor 23.451 lei" vezi "NOLICH SRL iti datoreaza 23.451 lei".

**Nimic nu se inventeaza.** Daca exista o diferenta intre ce vezi tu si ce zice contabilul, vorbiti — datele sunt aceleasi, doar limbajul difera.

---

## Pagina principala — `/firma`

Cand intri prima data, vezi 6 sectiuni mari, in ordinea utilitatii:

### 1. Banner sus

:::mockup published-banner
:::

Iti spune ce luna vezi si cine ti-a publicat-o. Daca contabilul lucreaza pe corectii si nu a republicat inca, vei vedea "necesita re-publicare" — cifrele sunt valabile, dar au modificari ulterioare in jurnal.

### 2. KPI cards — 4 numere mari

:::mockup kpi-cards
:::

- **Bani in casa si banca** — cat ai DISPONIBIL acum. Suma soldurilor conturilor 512x (banca) + 531x (casa).
- **De primit de la clienti** — cati bani iti datoreaza clientii (facturi emise dar neincasate). Suma conturilor 4111 cu sold debitor.
- **De platit furnizorilor** — cati bani datorezi tu (facturi primite dar neplatite). Suma conturilor 401 cu sold creditor.
- **Profit anul acesta** — venituri - cheltuieli cumulat din ianuarie pana in luna publicata. Verde = pozitiv, rosu = negativ.

### 3. "Comparat cu aceeasi luna anul trecut"

Mic strip cu 4 metrici (Vanzari, Cheltuieli, Profit, Cash la final) comparate cu acelasi tip de luna acum un an. Vezi rapid: aprilie 2026 vs aprilie 2025.

:::mockup yoy-strip
:::

Apare doar daca exista date din anul trecut pentru aceeasi luna. Sageata verde = mai bine, rosie = mai slab.

### 4. "Cati bani iti ajung" + "Cate salarii poti plati"

Doua carduri side-by-side care raspund la intrebari fundamentale:

:::mockup runway-salary
:::

- **Cati bani iti ajung** — daca nu mai intra venituri, cati ani/luni de operare poti acoperi cu banii din cont la ritmul actual de cheltuieli.
- **Cate salarii poti plati** — banii din cont impartiti la nota lunara de salarii. Cate luni de salarii poti onora din cash-ul de azi.

Culoare:
- Verde (confortabil) — peste 6 luni
- Galben (atentie) — 3-6 luni
- Rosu (critic) — sub 3 luni

### 5. "Unde s-au dus banii" + "De unde au venit banii"

Doua bare orizontale care arata pe ce s-au cheltuit banii (clasa 6) si de unde au venit (clasa 7) in luna respectiva.

:::mockup expense-breakdown
:::

:::mockup revenue-breakdown
:::

Sub-categoriile (cele indentate cu `›`) apar doar daca contabilul a decompus o categorie mai mare.

### 6. Top cheltuieli ale lunii

Lista cu top 10 cheltuieli individuale (cele mai mari plati), in ordine descrescatoare. Iti spune EXACT pe ce furnizor sau cont s-a dus cea mai mare suma.

:::mockup top-expenses
:::

### 7. "Pe linii de business" (doar daca firma ta are verticale activate)

Daca contabilul a configurat verticale (de exemplu pentru QHM21: Outsourcing, Recruitment, Coworking), aici vezi cat aduce si cat cheltuieste fiecare separat.

:::mockup vertical-breakdown
:::

"Toata firma" e fallback pentru cheltuieli si venituri pe care contabilul nu le-a impartit pe linii specifice (de exemplu salariul de la contabilitate, comisioane bancare).

### 8. Cine iti datoreaza / Cui datorezi

Doua tabele cu top 15 parteneri:
- **Clienti neincasati** — cine iti datoreaza si cat
- **Furnizori neplatiti** — cine si cat datorezi

Util pentru decizii: "trebuie sa-l sun pe X sa-mi plateasca", "trebuie sa achit Y saptamana asta".

### 9. Bani pe care i-ai luat din firma

Sumar al dividendelor distribuite si neridicate, avansurilor din trezorerie nedecontate, sumelor depuse de tine ca asociat. Util ca sa stii cu cat esti "expus" personal in firma.

### 10. Semnale

Sectiunea finala arata 3-6 observatii relevante:
- "Firma e pe plus, marja 12%"
- "Clientii intarzie cu platile — iti datoreaza de 2x mai mult decat datorezi tu"
- "TVA de plata e mare, scadent pe 25"
- ...

Sunt insight-uri automate calculate din cifre. Le vezi din prima si stii pe ce sa pui accent in discutia cu contabilul.

---

## Pagina "Istoric"

Click pe **Istoric** in meniul de sus. Vezi cronologic ce a facut contabilul tau cu datele firmei in ultimele luni — fiecare publicare, fiecare import nou de jurnal, fiecare redenumire de cont. Util ca sa stii cand au aparut noile cifre si ce s-a schimbat.

---

## Intrebari frecvente

### De ce nu vad luna asta?

Contabilul tau publica explicit fiecare luna dupa ce verifica cifrele. Pana publica, luna nu apare. Vorbeste cu el daca dureaza.

### De ce s-a schimbat o cifra de la o vizita la alta?

Contabilul a republicat luna respectiva — probabil dupa o corectie sau dupa ce a primit documente intarziate. Pagina "Istoric" iti arata cand.

### De ce vad cifre din aprilie cand am date noi in mai?

Contabilul are nevoie de citeva zile la finalul lunii ca sa primeasca toate documentele, sa le inregistreze in Saga, apoi sa publice in Costify. E normal sa vezi luna in urma cu 1-2 saptamani.

### Cifrele nu corespund cu cele pe care le am eu in cap

Vorbeste cu contabilul. Datele din Costify sunt cele pe care le are el in evidenta. Daca exista o diferenta intre ce vezi tu si realitatea operationala (de exemplu, ai uitat sa-i trimiti o factura), contabilul corecteaza la urmatorul import.

### Pot sa modific eu ceva pe pagina asta?

Nu. Pagina ta este READ-ONLY pentru ca cifrele trebuie sa fie identice cu evidentele contabile depuse la ANAF. Daca vrei o modificare, vorbeste cu contabilul.

### Vreau sa vad un grafic pe X luni / o categorie noua / un raport custom

Spune-i contabilului ce vrei. El poate:
- Crea categorii noi (de exemplu *Marketing online* separat de *Servicii externe*)
- Activa verticale daca firma ta are mai multe linii de business
- Genera rapoarte si exporturi pentru cazuri specifice

---

## Cati mei date sunt vechi?

Vezi data publicarii in banner-ul de sus. Daca a trecut peste o luna fara o noua publicare, intreaba contabilul.

---

*Vezi si: [Ghid pentru contabil](/docs/cashflow-pentru-contabil), [Exemplu QHM21](/docs/cashflow-exemplu-qhm21)*
