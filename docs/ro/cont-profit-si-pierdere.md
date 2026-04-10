# Cont Profit si Pierdere

Cont Profit si Pierdere (CPP) — sau, in jargon, "P&L" de la "Profit and Loss" — este raportul care raspunde la **cea mai importanta intrebare** a oricarei firme: **am castigat sau am pierdut bani in aceasta perioada?**

Acest articol explica structura CPP-ului, ce inseamna fiecare sectiune, si cum sa-l interpretezi.

## Definitie

> Contul de Profit si Pierdere este un document de sinteza care prezinta veniturile, cheltuielile si rezultatul (profit sau pierdere) al unei firme pentru o perioada determinata.

In esenta: aduna toate veniturile, scade toate cheltuielile, si obtine profitul (sau pierderea).

Spre deosebire de **bilant** — care e o "fotografie" la un moment dat — **CPP este un "film"** care arata ce s-a intamplat intr-un interval de timp (luna, trimestru, an).

## Structura standard OMFP

CPP-ul oficial in Romania, conform OMFP 1802, are aceasta structura:

```
A. VENITURI DIN EXPLOATARE
   - Cifra de afaceri neta
     - Productia vanduta
     - Venituri din vanzarea marfurilor
     - Reduceri comerciale acordate
   - Variatia stocurilor
   - Productia realizata pentru scopuri proprii
   - Alte venituri din exploatare

B. CHELTUIELI DE EXPLOATARE
   - Cheltuieli cu materiile prime si materialele consumabile
   - Alte cheltuieli materiale
   - Alte cheltuieli externe (energie, apa)
   - Cheltuieli privind marfurile
   - Cheltuieli cu personalul
     - Salarii si indemnizatii
     - Asigurari sociale
   - Cheltuieli cu amortizarea, ajustarile pentru depreciere
   - Cheltuieli cu prestatiile externe
   - Alte cheltuieli de exploatare

C. PROFITUL/PIERDEREA DIN EXPLOATARE = A - B

D. VENITURI FINANCIARE
   - Venituri din interese de participare
   - Venituri din alte investitii
   - Venituri din dobanzi
   - Alte venituri financiare

E. CHELTUIELI FINANCIARE
   - Cheltuieli privind dobanzile
   - Pierderi din creante legate de participatii
   - Cheltuieli din diferente de curs valutar
   - Alte cheltuieli financiare

F. PROFITUL/PIERDEREA FINANCIARA = D - E

G. PROFITUL/PIERDEREA BRUT(A) = C + F

H. IMPOZITUL PE PROFIT (sau impozit micro)

I. PROFITUL/PIERDEREA NET(A) = G - H
```

In Costify, structura simplificata este:

```
VENITURI DIN EXPLOATARE       (toate conturile clasa 7 cu cppGroup=VENITURI_EXPLOATARE)
CHELTUIELI DIN EXPLOATARE     (toate conturile clasa 6 cu cppGroup=CHELTUIELI_EXPLOATARE)
REZULTAT DIN EXPLOATARE       = venituri exploatare - cheltuieli exploatare

VENITURI FINANCIARE           (cppGroup=VENITURI_FINANCIARE)
CHELTUIELI FINANCIARE         (cppGroup=CHELTUIELI_FINANCIARE)
REZULTAT FINANCIAR            = venituri financiare - cheltuieli financiare

REZULTAT BRUT                 = rezultat exploatare + rezultat financiar
IMPOZIT PE PROFIT             (conturile cu special=profit_tax sau micro_tax)
REZULTAT NET                  = rezultat brut - impozit
```

Fiecare sectiune are un header, o lista de conturi, si un total.

## Diferenta intre exploatare si financiar

**Activitatea de exploatare** = activitatea principala a firmei. Daca esti restaurant, exploatare = mancare vanduta si ingrediente cumparate. Daca esti firma de IT, exploatare = servicii prestate si cheltuieli cu salariati/utilitati.

**Activitatea financiara** = ce face firma cu banii ei pe piata financiara: dobanzi incasate de la depozite, dobanzi platite la credite, castiguri/pierderi din curs valutar, dividende incasate de la alte firme.

Distinctia este importanta pentru ca:
- **Rezultat din exploatare** arata cat de bine merge **business-ul propriu-zis**.
- **Rezultat financiar** arata cat de bine sunt **gestionati banii**.

O firma poate avea profit din exploatare (business-ul merge), dar pierdere financiara (a luat un credit prea scump). Sau invers: pierdere din exploatare (business-ul nu merge), dar profit financiar (a investit bine in depozite). Ambele situatii sunt importante de analizat separat.

## Exemplu concret

O firma mica de servicii IT in luna decembrie 2025:

```
VENITURI DIN EXPLOATARE
  704  Venituri din servicii prestate    45.000,00
  708  Venituri activitati diverse        2.500,00
  Total venituri din exploatare          47.500,00

CHELTUIELI DIN EXPLOATARE
  605  Cheltuieli energie si apa            850,00
  611  Cheltuieli intretineri si reparatii  300,00
  612  Cheltuieli chirii sediu            3.500,00
  624  Cheltuieli cu transportul             200,00
  625  Cheltuieli deplasari                  450,00
  626  Cheltuieli telefon, internet          280,00
  627  Cheltuieli servicii bancare            45,00
  628  Alte cheltuieli servicii              500,00
  641  Cheltuieli cu salariile           18.000,00
  6451 Cheltuieli CAS angajator           4.050,00
  6452 Cheltuieli somaj                     360,00
  6453 Cheltuieli CASS                    1.260,00
  6811 Cheltuieli amortizari                550,00
  Total cheltuieli din exploatare        30.345,00

REZULTAT DIN EXPLOATARE                  17.155,00 (profit)

VENITURI FINANCIARE
  766  Venituri din dobanzi                  35,00
  Total venituri financiare                 35,00

CHELTUIELI FINANCIARE
  666  Cheltuieli privind dobanzile        1.200,00
  Total cheltuieli financiare            1.200,00

REZULTAT FINANCIAR                        -1.165,00 (pierdere)

REZULTAT BRUT                            15.990,00

691  Impozit pe profit (16%)              2.558,40

REZULTAT NET                             13.431,60
```

Citire rapida:
- **Business-ul merge bine**: profit din exploatare 17.155 RON.
- **Costuri financiare cresc**: pierdere financiara de 1.165 RON, probabil din dobanzi la un credit.
- **Profit brut decent**: 15.990 RON dupa scaderea pierderii financiare.
- **Impozit standard**: 16% din profit (regimul de profit, nu micro).
- **Profit net final**: 13.431,60 RON — banii care raman dupa toate cheltuielile si impozitele.

## CPP lunar vs anual

CPP-ul poate fi calculat pentru orice perioada:

- **CPP lunar** — doar luna selectata. Util pentru monitoring constant.
- **CPP cumulat de la inceputul anului** — de la 1 ianuarie pana la finalul lunii alese. Util pentru a vedea tendinta anuala.
- **CPP anual** — toata anul. Obligatoriu, depus la ANAF cu D101.

In Costify, CPP-ul este calculat **pana la finalul lunii selectate**, cumulativ de la 1 ianuarie. Daca alegi decembrie 2025, primesti CPP-ul intregii ani 2025. Daca alegi iunie 2025, primesti CPP-ul perioadei ianuarie-iunie 2025.

## Citirea unui CPP

### Pasul 1: Verifica venitul total

Cifra de afaceri (suma tuturor veniturilor din exploatare) este **prima** cifra pe care trebuie sa o vezi. Reprezinta volumul total al activitatii.

Compara cu:
- **Cifra de afaceri din anul anterior** — creste sau scade?
- **Targets setate** la inceputul anului — esti pe drumul cel bun?

### Pasul 2: Verifica marja de exploatare

```
Marja exploatare (%) = Rezultat exploatare / Venituri exploatare * 100
```

Aceasta procentaje iti spune cat din fiecare leu de venit ramane dupa cheltuielile operationale. Marje tipice:

| Industrie | Marja exploatare normala |
|---|---|
| Comert (retail) | 2-5% |
| Restaurante | 5-10% |
| Servicii | 15-25% |
| IT | 20-40% |
| Software (SaaS) | 30-60% |

Daca marja ta este mult sub media industriei, ai o problema de cost sau de pret.

### Pasul 3: Verifica structura cheltuielilor

Care sunt cele mai mari cheltuieli? In firmele de servicii, **salariile** sunt de obicei 50-70% din total. In comert, **marfurile** sunt 80%+. In productie, **materiile prime** + **salariile**.

Daca structura ta arata diferit fata de industrie, este interesant: ori esti mai eficient (bun), ori ai o problema (rau).

### Pasul 4: Verifica rezultatul net

Rezultatul net este "ce ramane in buzunar". Daca:
- **>15% din venituri** → firma e foarte profitabila.
- **5-15%** → firma e sanatoasa.
- **0-5%** → firma supravietuieste, dar fragil.
- **negativ** → firma pierde bani. Trebuie schimbat ceva urgent.

## CPP-ul oficial vs CPP simplificat

CPP-ul oficial (formularul depus la ANAF cu D101) are **format specific** cu randuri numerotate (5a, 5b, 5c, etc.) si referinte la formularul de bilant. Costify nu produce inca formatul oficial — afisam o versiune simplificata, mai usor de citit.

Pentru declaratii ANAF, deocamdata recomandarea este: foloseste cifrele din Costify ca verificare, dar produce formularul oficial in Saga C sau alta solutie dedicata. In iteratii viitoare, vom adauga export oficial in Costify.

## CPP la microintreprinderi

Pentru firme microintreprindere (cu impozit pe venit, nu pe profit):

- **Impozitul** este 1% sau 3% din **veniturile** firmei (nu din profit).
- In CPP, contul folosit este **698** (Cheltuieli cu impozitul pe venit microintreprindere), nu 691.
- **Rezultatul net** = Rezultat brut - Impozit micro.

In catalogul Costify, contul 698 are flag-ul `special: micro_tax`, deci este tratat exact ca 691 — apare separat in CPP intre rezultatul brut si rezultatul net.

## Limita microintreprinderii

In 2025, plafonul cifrei de afaceri pentru microintreprindere este:
- **500.000 EUR** — peste, trecere obligatorie la regim de profit (16%).
- Plus alte conditii (numar angajati, tipuri de venituri).

Daca esti aproape de plafon, **monitorizeaza CPP-ul lunar** ca sa stii cand sa pregatesti tranzitia. Costify iti da CPP-ul actualizat la fiecare import, deci ai vizibilitate continua.

## Ce nu vezi in CPP

- **Cash flow** — CPP-ul iti spune profitul, nu cati bani ai in cont. Poti avea profit dar fara cash (clienti neplatitori).
- **Bilantul** — CPP-ul nu iti spune ce active ai sau cat datorezi. Pentru asta ai nevoie de [bilantul](./bilantul.md).
- **Detaliile pe client/produs** — CPP-ul agregheaza pe natura cheltuielilor, nu pe centre de profit. Pentru analiza pe client/produs ai nevoie de contabilitate de gestiune (clasa 9), care e optionala.

## Urmatori pasi

- [Calculul CPP](./calcul-cpp.md) — algoritmul tehnic in Costify
- [Analizeaza Cont Profit si Pierdere](./analizeaza-cpp.md) — ghid practic pentru tabul CPP
- [Bilantul contabil](./bilantul.md) — celalalt raport financiar important
- [Intelege KPI-urile](./intelege-kpi.md) — indicatorii care complementeaza CPP
