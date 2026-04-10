# Bilantul contabil

Daca [Cont Profit si Pierdere](./cont-profit-si-pierdere.md) este "filmul" — ce s-a intamplat intr-o perioada — atunci **bilantul contabil** este "fotografia": ce ai si ce datorezi la un moment fix in timp, de obicei la 31 decembrie.

Acest articol explica structura bilantului si cum sa-l interpretezi. Costify nu produce inca bilantul oficial pentru ANAF, dar din balanta de verificare poti citi toate cifrele necesare.

## Definitie

> Bilantul contabil este un document care prezinta, la un moment dat, **patrimoniul** firmei: ce detine (active), de unde a venit finantarea (pasive), si valoarea proprie (capitalul propriu).

Cuvinte cheie:
- **La un moment dat** — bilantul are o data specifica, de obicei sfarsitul anului fiscal (31 decembrie). Spre deosebire de CPP care acopera o perioada.
- **Patrimoniu** — toate bunurile si datoriile firmei, exprimate in bani.
- **Echilibru** — bilantul este "balansa", deci doua parti egale: ACTIV = PASIV.

## Ecuatia fundamentala

```
ACTIV = PASIV + CAPITAL PROPRIU
```

Sau, mai intuitiv:

```
Ce detii  =  Ce datorezi  +  Cat e al tau
```

De ce trebuie sa fie egale? Pentru ca toate bunurile firmei (activul) au fost finantate fie prin imprumuturi (datorii catre furnizori, banci, stat — pasivul), fie prin contributia proprietarului (capital propriu).

Daca ai cumparat un laptop de 5.000 RON:
- **Activ** creste cu 5.000 (laptopul)
- **Pasiv sau capital propriu** creste cu 5.000 (de unde au venit banii? credit, datorie, sau capital propriu)

Echilibrul se mentine mereu.

## Structura bilantului

```
ACTIV
A. ACTIVE IMOBILIZATE
   I. Imobilizari necorporale (brevete, marci, software)
   II. Imobilizari corporale (cladiri, terenuri, masini)
   III. Imobilizari financiare (investitii pe termen lung)

B. ACTIVE CIRCULANTE
   I. Stocuri (materii prime, marfuri, produse finite)
   II. Creante (clienti, debitori)
   III. Investitii pe termen scurt
   IV. Casa si conturi la banci (5121, 5311, etc.)

C. CHELTUIELI IN AVANS

   TOTAL ACTIV = A + B + C

PASIV
D. CAPITAL PROPRIU
   I. Capital social
   II. Prime de capital
   III. Rezerve din reevaluare
   IV. Rezerve
   V. Profit reportat
   VI. Profit/pierdere a exercitiului curent

E. PROVIZIOANE

F. DATORII
   I. Datorii pe termen lung (credite >1 an)
   II. Datorii pe termen scurt
      - Furnizori (401, 404)
      - Salarii datorate (421)
      - Asigurari sociale (431x)
      - TVA si alte impozite (4423, 444, 446)
      - Credite pe termen scurt (5191)
   III. Venituri in avans

   TOTAL PASIV = D + E + F
```

**Verificare**: TOTAL ACTIV = TOTAL PASIV. Daca nu, e o eroare.

## De unde vin cifrele

Bilantul se construieste **din balanta de verificare** la sfarsitul perioadei. Pentru fiecare cont:

- Daca soldul este pe **debit** → contul apare in **ACTIV**.
- Daca soldul este pe **credit** → contul apare in **PASIV** sau **CAPITAL**.

Exceptii:
- **Conturile bifunctionale** (B) — pot aparea in ambele parti, in functie de sold.
- **Contul 121** — daca e profit (sold creditor), apare in capital propriu pe pozitia "Profit a exercitiului". Daca e pierdere (sold debitor), apare cu minus.
- **Conturile 281x (amortizari)** — apar in activ ca **scadere** din imobilizari (valoarea de bilant = valoarea bruta - amortizarea).

## Exemplu simplificat

O firma la 31 decembrie 2025:

```
ACTIV
  A. Imobilizari
     2131  Echipamente tehnologice            25.000
     2812  Amortizari echipamente              -8.000   ← scade
     Total imobilizari nete                   17.000

  B. Active circulante
     371   Marfuri in stoc                    12.000
     4111  Clienti                            18.500
     5121  Banca                              22.000
     5311  Casa                                  500
     Total active circulante                  53.000

  TOTAL ACTIV                                 70.000

PASIV
  D. Capital propriu
     1012  Capital social                     10.000
     117   Profit reportat                    25.000
     121   Profit exercitiu curent            13.500
     Total capital propriu                    48.500

  F. Datorii
     401   Furnizori                          15.000
     421   Salarii datorate                    4.000
     4423  TVA de plata                        2.500
     Total datorii                            21.500

  TOTAL PASIV                                 70.000

VERIFICARE: ACTIV = PASIV → 70.000 = 70.000 ✓
```

## Cum citesti un bilant

### Pasul 1: Total activ vs total pasiv

Trebuie sa fie egale. Daca nu, eroare in jurnal sau in calcul.

### Pasul 2: Marime relativa a activelor

- **Imobilizari mari** → firma a investit in echipamente, cladiri. Tipic pentru productie sau servicii care necesita active fixe.
- **Stocuri mari** → firma de comert sau productie cu rotatie lenta.
- **Creante mari** → firma de servicii care vinde pe termen, sau magazin care nu e platit la timp.
- **Cash mare** → firma cu lichiditate buna, fie pentru ca face profit, fie pentru ca a luat credite.

### Pasul 3: Structura pasivului

- **Capital propriu mare** (>50% din pasiv) → firma stabila, cu finantare proprie.
- **Datorii mari** (>50%) → firma cu levier ridicat, depinde de creditori si furnizori.
- **Datorii pe termen lung** → credite la banci, OK daca sunt la dobanzi rezonabile.
- **Datorii pe termen scurt mari** → presiune de plata, risc de cash crisis.

### Pasul 4: Capital propriu pozitiv vs negativ

**Capitalul propriu pozitiv** = firma valoreaza ceva pentru proprietar. Daca vinzi firma maine, primesti aproximativ aceasta suma.

**Capitalul propriu negativ** = firma datoreaza mai mult decat detine. Asta inseamna **insolventa tehnica**. In Romania, daca ramai cu capital propriu negativ doi ani la rand, ai obligatia legala sa convocci AGA si sa decizi: capitalizare suplimentara, fuziune sau dizolvare.

### Pasul 5: Cifre vs anul anterior

Bilantul se compara cu cel de la finalul anului anterior:

- **Imobilizari cresc** → ai investit (good if profitable, bad if frozen capital)
- **Stocuri cresc disproportionat** → marfa nu se vinde
- **Creante cresc** → clientii nu mai platesc la timp
- **Datorii cresc** → te indatorezi
- **Capital propriu creste** → firma e profitabila (sau ai facut aport)

## Diferenta intre bilant si CPP

Multi confunda cele doua. Iata o tabela rezumativa:

| Aspect | Bilant | CPP |
|---|---|---|
| **Ce arata** | Patrimoniul (active si pasive) | Performanta (venituri si cheltuieli) |
| **Moment** | La o data fixa (ex: 31.12.2025) | Pentru o perioada (ex: ian-dec 2025) |
| **Tipul** | "Fotografie" | "Film" |
| **Conturi** | Clasele 1-5 | Clasele 6-7 |
| **Rezultatul cheie** | Capital propriu | Profit/pierdere |
| **Periodicitate** | De obicei anual | Lunar, trimestrial, anual |

CPP-ul arata cum s-a creat profitul. Bilantul arata unde a ramas (sau unde s-a pierdut).

## De ce nu produce Costify bilantul oficial

Bilantul oficial (formularul de bilant ANAF, anexa la D101) are **format strict** cu zeci de randuri numerotate, sub-grupari, comparatii cu anul precedent, note explicative. Necesita munca atenta de mapare cont-la-rand.

Costify deocamdata se concentreaza pe **operare zilnica** (jurnal, balanta, CPP, KPI). Pentru depunere oficiala, foloseste Saga C sau o solutie dedicata raportarilor ANAF.

In iteratii viitoare, vom adauga si bilantul oficial — toate datele sunt deja in jurnal si in catalog, este doar munca de mapare si export PDF.

## Bilant conform IFRS vs OMFP

In Romania exista doua reglementari paralele:

1. **OMFP 1802** — pentru majoritatea firmelor (SRL-uri obisnuite, IMM-uri).
2. **IFRS / OMFP 2844** — pentru companii mari listate la bursa, banci, asiguratori.

Diferenta principala in bilant: IFRS clasifica activele si pasivele dupa **lichiditate** (cele mai lichide intai), in timp ce OMFP 1802 le clasifica dupa **natura** (imobilizari, apoi circulante).

Costify suporta doar OMFP 1802 in versiunea curenta. Pentru IFRS, ar trebui adaugat un alt format de raportare.

## Urmatori pasi

- [Cont Profit si Pierdere](./cont-profit-si-pierdere.md) — celalalt raport financiar major
- [Balanta de verificare](./balanta-de-verificare.md) — sursa direct a cifrelor din bilant
- [Tipuri de conturi: A, P, B](./tipuri-conturi-apb.md) — cum decid daca un cont e activ sau pasiv
- [Glosar](./glosar.md) — definitii rapide pentru termenii financiari
