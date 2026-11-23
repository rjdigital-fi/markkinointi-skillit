# RJ Digitalin skillit

Ilmaisia skillejä Claude Codeen ja muihin tekoälyagentteihin, jotka osaavat lukea skillejä. Skilli on ohje, jonka mukaan agentti tekee työn vaihe vaiheelta. Tein nämä omaan käyttööni ja jaan ne, koska samalla menetelmällä pääsee alkuun kuka tahansa.

In English: [README.en.md](README.en.md)

## Avainsanatutkimus

Skilli tekee avainsanatutkimuksen yhdestä aiheesta oikealla datalla ja palauttaa raportin, jonka pohjalta voitte päättää, mitä sivuja teette ja mihin mainosbudjetti kannattaa laittaa.

Raportissa on:

- aihekartta, josta näkee aiheen haarat yhdellä silmäyksellä
- hakusanat ryhmiteltyinä: hakumäärä, klikkaushinta, kilpailu ja hakuaikomus
- pääsanan kausivaihtelu 12 kuukaudelta
- ehdotus budjetin jaosta ryhmien kesken
- mitä tekoäly vastaa ostajan kysymyksiin, mitä hakuja se tekee ja mihin lähteisiin se nojaa
- mitä Googlen tulossivulla näkyy: tekoälykatsaus, "Muut kysyvät myös" ja kärkitulokset

Menetelmä on sama kuin oppaassani [Avainsanatutkimus](https://rjdigital.fi/oppaat/avainsanatutkimus). Valmis esimerkki: [examples/aurinkopaneelit/report.md](examples/aurinkopaneelit/report.md).

### Valitkaa datalähde itse

Skilli ei ole sidottu yhteen työkaluun. Käyttäkää sitä, mikä teillä on jo käytössä. Agentti katsoo alussa, mitä on kytketty, kertoo, mihin kukin lähde riittää, ja kysyy, mitä käytetään. Lähteitä voi yhdistää: hakumäärät esimerkiksi Semrushista ja tekoälyn vastaukset Clorosta. Excel-tiedostoja skilli ei lue, joten viekää tiedot CSV-muodossa.

| Lähde | Mitä siitä saa | Miten kytketään |
| --- | --- | --- |
| SEO-työkalut: Semrush, Ahrefs, SE Ranking, Moz, Mangools, Ubersuggest, Serpstat, SISTRIX, Keywords Everywhere | hakusanat, hakumäärät, klikkaushinnat | työkalun oma MCP, rajapinta tai CSV-vienti |
| DataForSEO | kaikki raportin osat | rajapinnan tunnukset tai MCP, mukana valmis skripti |
| Mainosalustat: Google Keyword Planner, Google Ads -rajapinta, Microsoft Advertising | hakusanat, hakumäärät, hintahaarukka tai hintaehdotus | CSV-vienti, rajapinta tai MCP |
| Tulossivurajapinnat: SearchApi, SerpApi, HasData, Serper, Bright Data | Googlen tulossivut ja Googlen tekoälyvastaukset | MCP tai rajapinta |
| Tekoälynäkyvyyden työkalut: Cloro, Peec AI, Profound, Otterly, LLM Pulse, Nightwatch ja muut | tekoälyjen vastaukset lähteineen ja mainittuine brändeineen | MCP, rajapinta tai vienti |
| Jokin muu | sen mukaan, mitä työkalu antaa | agentti lukee työkalun kuvauksen ja sovittaa kentät |

Pakollisia ovat vain hakusanat ja hakumäärät. Jos lähteestä ei saa tekoälyn vastauksia tai tulossivuja, ne osat jäävät raportista pois ja agentti sanoo sen.

Mitä on testattu: DataForSEO kokonaan oikealla ajolla marraskuussa 2026. Muiden työkalujen tuonti on testattu mallitiedostoilla, jotka on rakennettu kunkin työkalun sarakkeiden ja kenttien nimillä. Testit ovat mukana, ja ne voi ajaa komennolla `node tests/run.mjs`. Jokaista työkalua en ole ajanut oikealla tilillä. Työkalut myös muuttavat vientejään, joten tuonti tulostaa aina, mitkä kentät se löysi ja mitkä jäivät löytymättä. Kertokaa [issuessa](https://github.com/rjdigital-fi/skills/issues), jos jokin ei toimi.

### Asennus

Claude Codessa:

```
/plugin marketplace add rjdigital-fi/skills
/plugin install rjdigital@rjdigital-fi
```

Tai ilman pluginia: kopioikaa kansio `skills/avainsanatutkimus` omaan `~/.claude/skills/`-kansioonne.

Skriptit tarvitsevat Node.js-version 18 tai uudemman. Muita asennuksia ei tarvita.

### Käyttö

Kirjoittakaa Claude Codessa esimerkiksi:

```
Tee avainsanatutkimus aiheesta aurinkopaneelit. Asennamme paneeleita omakotitaloihin Tampereella ja Turussa. Budjetti on 1 000 euroa kuukaudessa.
```

Tai kutsukaa suoraan: `/rjdigital:avainsanatutkimus`.

Agentti käy läpi kuusi vaihetta: lähteen valinta, aihekartta, hakumäärät ja hinnat, ryhmittely ja hakuaikomus, tekoälyn kysymykset ja lopuksi raportti. Se kysyy teiltä ne asiat, jotka vain te tiedätte: mitä myytte, mitä ette myy ja millä alueella.

Tulos tallentuu kansioon `avainsanatutkimus/<aihe>/`: `report.md` on raportti ja `keywords.csv` koko hakusanalista taulukkolaskentaan.

### Hyvä tietää

- Hakumäärät ovat lähteen arvioita. Eri työkalut antavat samalle hakusanalle eri luvun, joten vertailkaa lukuja saman lähteen sisällä.
- Maksullisissa lähteissä haut kuluttavat krediittejä tai rahaa. Agentti kertoo arvion ennen ensimmäistä hakua ja toteutuneen kulun lopuksi. Esimerkkiraportin haut maksoivat DataForSEO:ssa yhteensä noin 0,15 dollaria.
- Rajapinnan avaimet pidetään ympäristömuuttujissa tai MCP-yhteydessä. Niitä ei kirjoiteta keskusteluun eikä tiedostoihin.
- Budjetin jako on lähtökohta, joka lasketaan hakumääristä, klikkaushinnoista ja hakuaikomuksesta. Oikea mainosdata tarkentaa sen ensimmäisten viikkojen jälkeen.

## Tekijä

Joonas Rotko, [RJ Digital](https://rjdigital.fi). Teen hakukoneoptimointia, tekoälynäkyvyyttä ja hakumainontaa.

## Lisenssi

MIT. Saatte käyttää, muokata ja jakaa vapaasti.
