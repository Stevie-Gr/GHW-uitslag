# Financiën in de Uitslagen-app

Deze uitbreiding draait lokaal op de vertrouwde pc. Open index.html in dezelfde browser waarin je de bestaande administratie gebruikt. Laat de bijbehorende JS- en CSS-bestanden in dezelfde map staan.

## Beginnen

1. Log in als hoofdbeheerder. Open **Financiën**.
2. Kies het kalenderjaar en vul bij **Begroting instellen** het totaal in dat voor het concours beschikbaar is (of zet het in cel D2 van de jaarplanning).
3. Kies **Jaarplanning downloaden**, vul aan, en **Jaarplanning uploaden**. Daarmee staan wedstrijden, agenda-gegevens, begrote bedragen en tarieven in de app.
4. Op de wedstrijddag: startpagina → **Wedstrijd van vandaag** → invoer. Alleen wie níet betaald heeft markeer je.
5. Maak regelmatig een JSON-back-up via **Back-up downloaden**.

## Wat de app bijhoudt

Financiën is bewust klein gehouden: één scherm met drie dingen.

- **Resultaat**: bovenaan groot en gekleurd (groen = over, rood = tekort), met daaronder het rekenstaatje: + Begroting vereniging · + Extra bijdrage · + Inleg vissers · + Losse inleg series · − Uitgaven (prijzengeld en kosten) · = Resultaat. *Inleg* rekent de app zelf uit: deelnemers uit de uitslagen × tarief, min wie nog niet betaald heeft; losse inleg in series staat apart. *Uitgaven* is per wedstrijd het uitbetaalde prijzengeld (standaard de prijzenpot = inleg + begroot) en per uitgave het uitgegeven bedrag (standaard begroot). Het resultaat geldt voor het hele jaar: wat nog komt telt als begroot. Onder het staatje: *Begroot t/m vandaag* en *heel jaar*.
- **Lijst van wedstrijden en uitgaven** met datum, vorm, water, lotingplek, tijden, inleg, begroot en uitgegeven (vet als je het zelf hebt ingevuld). Een serie staat als één regel op de datum van haar eerste wedstrijd; de wedstrijden zitten erachter.
- **Nog niet betaald**: wie nog moet betalen, met bedrag en knop *Alsnog betaald*. Bij series ook hoeveel vissers nog *serie of los* moeten kiezen.

Per post zie je Inleg · Begroot · Prijzenpot · Uitbetaald · Verschil en kun je begroot en uitbetaald/uitgegeven aanpassen. *Uitbetaald* staat vooringevuld met de prijzenpot; laat je het gelijk, dan volgt het de inleg en het begrote bedrag automatisch. Bij een koppelwedstrijd kies je of de inleg per koppel of per persoon telt. Extra, niet-begrote uitgaven (bijv. een reparatie) zet je erin als Overige uitgave met Begroot 0 en het uitgegeven bedrag; extra inkomsten (bijv. een extra bijdrage van de vereniging) bij *Begroting instellen* onder Extra bijdragen. Een post laten vervallen kan alleen zonder uitslag.

## Betalingen: iedereen betaalt, tenzij anders

- Wie in een uitslag staat telt als betaald tegen het tarief van de wedstrijd. Er zijn geen betaalvinkjes om te zetten.
- Bij **Koppel** en **Gescheiden koppel** is de inleg per koppel (uit de koppelindeling van de uitslag); een visser die alleen vist betaalt het volle koppeltarief.
- Uitzonderingen noteer je bij de invoer (deelnemerslijst, paneel *Inschrijfgeld*) of bij de wedstrijd in Financiën: **Nog niet betaald**. Ze verschijnen in de kaart *Nog niet betaald*.
- Iedereen met invoerrechten mag dit zetten; bedragen en begroting blijven alleen zichtbaar voor wie toegang tot Financiën heeft.

## Series

Een serie heeft één begroot bedrag en vier tarieven: los, los AOW, hele serie, hele serie AOW.

- Bij de eerste uitslag van een serie kies je per visser **Serie** of **Los** (rood tot gekozen; ook te doen bij de serie in Financiën).
- **Serie**: het serietarief staat open tot je *Serie betaald* aanvinkt; dat geldt voor alle wedstrijden van de serie. Altijd het volledige tarief, ook bij late instroom of bij overstap van los naar serie.
- **Los**: telt per wedstrijd als betaald tegen het losse tarief; uitzondering *Nog niet betaald*.
- **AOW**: vinkje *AOW-tarief* bij de visser in vissersbeheer. De app kiest dan zelf het AOW-tarief; bij de naam staat een AOW-label.

Geen deelbetalingen en geen betaalwijze: de app registreert begroot, inleg (automatisch), uitbetaald en wie nog moet betalen.

## Overgang op 17-09-2026

Bij de eerste start na deze versie zijn alle eerdere betaalvinkjes, deelnamekeuzes, afrekeningen en bijlagen gewist (afgesproken "schoon beginnen"). Uitslagen, wedstrijden, begroting, tarieven en viswateren zijn ongewijzigd.

## Jaarplanning downloaden, invullen en terug uploaden

De knop **Jaarplanning downloaden** maakt telkens een nieuw Excel-bestand met de actuele, niet vervallen planning uit de app. Ook wijzigingen die rechtstreeks in de agenda of bij Financiën zijn opgeslagen, komen terug. Het bestand heeft twee bladen: **Jaarplanning** (het invulblad) en **Viswateren** (standaardwaarden per water). Bovenaan het invulblad staan het jaar (B2), het jaarbudget (D2) en het meegenomen bedrag (F2); ingevulde waarden worden bij upload overgenomen. Laat de kolomkoppen op rij 7 staan en begin op rij 8.

Kolommen: Vorm, Wedstrijdnaam / omschrijving, Serie, Datum, Einddatum, Viswater, Locatie loting, Lotingtijd, Starttijd, Eindtijd, Hengeltype, Begroot, Inleg los / per wedstrijd, Inleg hele serie, Inleg hele serie AOW, Inleg los AOW en Uitbetaald / uitgegeven.

- **Verplicht per regel zijn alleen Vorm, Datum en Viswater of Naam.** Laat je de naam leeg, dan maakt de app hem uit vorm en water: *Koppel Spui*, *Individueel Binnenmaas*; bij een serie *Winterserie · Spui*. De datum staat in de app altijd naast de naam. Alles anders mag leeg blijven en staat dan in de app als "nog invullen". Regels zonder Vorm worden overgeslagen en gemeld; zo kun je twijfelgevallen laten staan.
- **Herkenning** van bestaande wedstrijden gaat op datum + vorm + water (bij twee op één dag ook starttijd of naam), pas daarna op naam. Een wedstrijd hernoemen in Excel is daardoor veilig. Wil je een bestaande naam als "Spui koppel 1" kwijt: maak de naam leeg, de app zet dan *Koppel Spui* (zichtbaar als wijziging in de controle).
- **Vorm**: Individueel, Koppel, Gescheiden koppel, Serie of Overige uitgave. Alleen wedstrijdvormen vullen de agenda. **Hengeltype**: Vaste stok of Vrij, of leeg.
- **Serie**: elke wedstrijd één regel met eigen viswater en lotingplek. De serienaam staat in de kolom Serie; de wedstrijdnaam mag leeg blijven, de app noemt de wedstrijd dan "Winterserie · Spui" (of zonder water "Winterserie - wedstrijd 3" op volgorde van datum). Een serie heeft 3 tot 6 verschillende datums.
- **Bedragen bij een serie** (Begroot en de vier tarieven: Inleg los / per wedstrijd = los normaal, Inleg los AOW, Inleg hele serie, Inleg hele serie AOW) vul je op één willekeurige regel van de serie in, of op alle regels gelijk. Begroot is de eenmalige verenigingsbijdrage voor de hele serie. Een serie zonder ingevulde datums wordt overgeslagen totdat de datums bekend zijn.
- **Inleg los / per wedstrijd** is bij een gewone wedstrijd de inleg per persoon (bij Koppel en Gescheiden koppel per koppel; schrijf “5 pp” als het bij een koppelwedstrijd toch per persoon is) en bij een serie het losse tarief per wedstrijd. **Uitbetaald / uitgegeven** vul je alleen in als het afwijkt van de prijzenpot (wedstrijd/serie) of het begrote bedrag (uitgave); bij een serie op de regel met de andere bedragen. Ontbreekt de kolom in een ouder bestand, dan blijven de ingevulde bedragen in de app staan. **Inleg hele serie AOW** en **Inleg los AOW** zijn de tarieven voor vissers met AOW binnen een serie. Het AOW-tarief wordt toegepast bij vissers met het vinkje *AOW-tarief* in vissersbeheer.
- **Viswateren**: laat je lotingplek of tijden leeg, dan vult de upload ze aan uit het blad Viswateren. Een ingevulde waarde op de wedstrijdregel wint altijd. Wijzigingen in het blad Viswateren worden in de app overgenomen; beheren kan ook via **Viswateren** in Financiën. De tabel is eenmalig voorgevuld uit de bestaande agenda (per water de meest gebruikte waarden).
- Bij overige uitgaven vul je vorm, omschrijving, Begroot en eventueel een datum in.
- Bedragen zijn eurobedragen zonder formules. Datums mogen Excel-datums of dd-mm-jjjj zijn. Tijden: 08:00 of 8.00.
- Bij fouten toont de app **alle** fouten tegelijk met blad, rij, kolom en melding. Er wordt dan niets gewijzigd; verbeter en upload opnieuw. Oudere downloads met de kolommen Soort en Wedstrijdvorm blijven leesbaar.

**Voorvulling.** Voor een jaar zonder wedstrijden bevat de download een voorstel op basis van het vorige jaar: dezelfde wedstrijden met vorm, water, lotingplek, tijden en bedragen, maar zonder datums (gele regels). Voor 2026 worden bovendien de regels uit **Begroting 2026.xlsx** toegevoegd (bestand `finance-begroting-2026.js`): het Begroot-bedrag wordt bij bestaande wedstrijden gezet op vorm + water in datumvolgorde ("Spui koppel 1" = eerste koppelwedstrijd op het Spui), anders op naam; regels die niet herkend worden, staan onderaan zonder datum. Koppel die in de controle aan een bestaande wedstrijd (de regel neemt dan datum en gegevens over), vul een datum in, of laat Vorm leeg om ze over te slaan. Het totaal (2.435 euro) staat als jaarbudget in D2 als er nog geen jaarbudget is.

De app bewaart automatisch een koppeling in een verborgen kolom. Je hoeft geen codes in te vullen. Kopieer je een regel om een nieuwe wedstrijd te maken, maak dan de verborgen kolom _Koppeling leeg; de controle meldt dit anders. Zonder koppeling herkent de app bestaande posten aan naam en datum, of een unieke naam. Bij twijfel (zelfde datum, ontbrekende datum of gelijkende naam als een post die niet meer in het bestand staat) kies je in de controle of de rij nieuw is of bij die bestaande post hoort.

Voor upload zie je alle verschillen, inclusief jaarbudget en viswateren. Vink gewenste wijzigingen aan; wijzigingen binnen één serie worden samen verwerkt. Regels met een probleem (bijvoorbeeld zonder datum) staan rood en kunnen pas na oplossen worden overgenomen. Een ontbrekende post blijft standaard behouden. Je kunt per ontbrekende post kiezen om deze te laten vervallen en de reservering vrij te geven. Met bestaande uitslagen, betalingen of afrekeningen wordt vervallen geblokkeerd.

Planningwijzigingen behouden uitslagen, openstaande markeringen en seriekeuzes. Een gewijzigd tarief geldt voor wat nog openstaat. Een leeg Begroot bij een bestaande post zet die terug op "nog invullen". De wedstrijdvorm van een gestarte wedstrijd of het verplaatsen van een bestaande seriewedstrijd naar een andere serie wordt niet via deze import afgehandeld. Een hele serie hernoemen kan door alle bijbehorende rijen samen te wijzigen.

Een volgende download bevat de actuele planning uit de app, inclusief de overgenomen wijzigingen. De jaarplanning bevat geen betaalgegevens; die zitten alleen in de app en de JSON-back-up. In de openbare agenda verschijnt alleen het inschrijfgeld voor vissers, niet de verenigingsbijdrage.

## Uitvoer en back-ups

De jaarplanning-Excel is de enige uitvoer naast de volledige JSON-back-up (alleen hoofdbeheerder). Het Excel- en PDF-overzicht en de bijlagen (bonnen) zijn vervallen.

## Lokaal gebruik

Gegevens worden niet gedeeld tussen browsers, pc en mobiel. Het scherm past wel op mobiel formaat. De naam/code-login beschermt de bediening, maar biedt geen sterke beveiliging tegen iemand met toegang tot de browsergegevens. Gebruik deze versie op de afgesproken vertrouwde pc.

Online publiceren, gedeelde opslag en een koppeling met MijnHSV zijn uitgesteld. Het bestaande gedrag van de lokale agenda en uitslagen is niet omgezet naar online concept/publicatiebeheer.

## Controle voor ontwikkelaars

- `node finance-core.test.cjs`: schoon beginnen, betaald-tenzij, koppeleenheden, alleen-visser, serie kiezen/bevestigen, AOW-tarieven, los→serie, samenvatting begroot/werkelijk/over.
- `node finance-plan.test.cjs` en `node finance-plan-ui.test.cjs`: jaarplanning met twee bladen, weinig verplichte velden, seriebedragen op een willekeurige regel, automatische namen, viswater-standaardwaarden, budgetcellen, begrotingshints 2026, herkenning op datum/vorm/water, alle fouten tegelijk, oude kolomnamen, voorstel voor een volgend jaar.
- `node finance-ui.test.cjs` en `node finance-series-ui.test.cjs`: geïsoleerde Edge-tests (Playwright, eerst via npm, anders de lokaal gebundelde runtime) van startkaart, upload, kopregel, invoerpaneel, openstaand, werkelijk-bedrag, AOW-vinkje, migratie en series.
- `node finance-duplicates.test.cjs` en `node finance-duplicates-ui.test.cjs`: dubbele wedstrijden.

## Mogelijk dubbele wedstrijden controleren

Kies in Financiën **Dubbele wedstrijden controleren**. De app toont ongekoppelde agenda- en uitslagregels op dezelfde datum als mogelijke paren, zonder ze automatisch samen te voegen. Kies per paar **Koppelen · agenda als basis**, **Koppelen · uitslag als basis** of **Apart houden**. Bij een afwijkende wedstrijdvorm is alleen de uitslag als basis beschikbaar, zodat de bestaande deelnemersindeling behouden blijft. Bij conflicterende financiële bedragen, dubbele betalingen of verschillende series vraagt de app eerst die gegevens te controleren.

Na koppelen bevat de volgende jaarplanning één regel voor dat paar. Uitslagen, betalingen en bijlagen blijven behouden; de oorspronkelijke records blijven voor herstel in de volledige back-up beschikbaar. Download na de controle een nieuwe jaarplanning. Een eerder gedownload bestand kan nog oude koppelingen bevatten.

Controles: `node finance-duplicates.test.cjs` en `node finance-duplicates-ui.test.cjs`.
