# RJ Digitalin skillit

Ilmaisia skillejä Claude Codeen ja muihin tekoälyagentteihin, jotka osaavat lukea skillejä. Skilli on ohje, jonka mukaan agentti tekee työn vaihe vaiheelta. Tein nämä omaan käyttööni ja jaan ne, koska samalla menetelmällä pääsee alkuun kuka tahansa.

In English: [README.en.md](README.en.md)

## Avainsanatutkimus

Skilli tekee avainsanatutkimuksen yhdestä aiheesta oikealla datalla ja palauttaa raportin, jonka pohjalta voitte päättää, mitä sivuja teette ja mihin mainosbudjetti kannattaa laittaa.

Raportissa on:

- aihekartta, josta näkee aiheen haarat yhdellä silmäyksellä
- hakusanat ryhmiteltyinä: hakumäärä, klikkaushinta, kilpailu ja hakuaikomus
- pääsanan kausivaihtelu 12 kuukaudelta
- ehdotus budjetin jaosta ryhmien kesken, euroina antamanne budjettihaarukan mukaan
- mitä tekoäly vastaa ostajan kysymyksiin, mitä hakuja se tekee ja mihin lähteisiin se nojaa
- mitä Googlen tulossivulla näkyy: tekoälykatsaus, "Muut kysyvät myös" ja kärkitulokset
- oman sivustonne tilanne, jos annatte Search Consolen tai Bing Webmaster Toolsin datan: missä ryhmissä sivusto jo näkyy, missä ei vielä ja mitkä hakusanat ovat sijoilla 5–15

Menetelmä on sama kuin oppaassani [Avainsanatutkimus](https://rjdigital.fi/oppaat/avainsanatutkimus).

Raportti tulee dioina yhtenä HTML-tiedostona. Alla on kaksi diaa esimerkkiraportista, koko esimerkki on kansiossa [examples/aurinkopaneelit](examples/aurinkopaneelit/).

[![Esimerkkiraportin aihekartta: aihe keskellä ja hakusanaryhmät ympärillä](examples/aurinkopaneelit/kuvat/dia-02.png)](examples/aurinkopaneelit/)

[![Esimerkkiraportin budjetin jako ryhmille euroina](examples/aurinkopaneelit/kuvat/dia-06.png)](examples/aurinkopaneelit/)

Esimerkin hakudata on oikeaa, mutta yritys, budjetti ja painot ovat keksittyjä: kuvitteellinen esimerkki.

### Valitkaa datalähde itse

Skilli ei ole sidottu yhteen työkaluun. Käyttäkää sitä, mikä teillä on jo käytössä. Agentti katsoo alussa, mitä on kytketty, kertoo, mihin kukin lähde riittää, ja kysyy, mitä käytetään. Lähteitä voi yhdistää: hakumäärät esimerkiksi Semrushista ja tekoälyn vastaukset Clorosta. Excel-tiedostoja skilli ei lue, joten viekää tiedot CSV-muodossa.

| Lähde | Mitä siitä saa | Miten kytketään |
| --- | --- | --- |
| SEO-työkalut: Semrush, Ahrefs, SE Ranking, Moz, Mangools, Ubersuggest, Serpstat, SISTRIX, Keywords Everywhere | hakusanat, hakumäärät, klikkaushinnat | työkalun oma MCP, rajapinta tai CSV-vienti |
| DataForSEO | kaikki raportin osat | rajapinnan tunnukset tai MCP, mukana valmis skripti |
| Mainosalustat: Google Keyword Planner, Google Ads -rajapinta, Microsoft Advertising | hakusanat, hakumäärät, hintahaarukka tai hintaehdotus | CSV-vienti, rajapinta tai MCP |
| Tulossivurajapinnat: SearchApi, SerpApi, HasData, Serper, Bright Data | Googlen tulossivut ja Googlen tekoälyvastaukset | MCP tai rajapinta |
| Tekoälynäkyvyyden työkalut: Cloro, Peec AI, Profound, Otterly, LLM Pulse, Nightwatch ja muut | tekoälyjen vastaukset lähteineen ja mainittuine brändeineen | MCP, rajapinta tai vienti |
| Oman sivuston data: Google Search Console, Bing Webmaster Tools (valinnainen) | millä hakusanoilla sivusto jo näkyy, millä sijalla ja millä sivulla | MCP, rajapinta tai CSV-vienti |
| Jokin muu | sen mukaan, mitä työkalu antaa | agentti lukee työkalun kuvauksen ja sovittaa kentät |

Pakollisia ovat vain hakusanat ja hakumäärät. Jos lähteestä ei saa tekoälyn vastauksia tai tulossivuja, ne osat jäävät raportista pois ja agentti sanoo sen.

Search Console ja Bing Webmaster Tools ovat valinnaisia. Agentti kysyy niistä alussa. Niiden luvut ovat sivuston omia lukuja, joten ne pidetään erillään markkinan hakumääristä ja näytetään raportissa omassa osiossaan.

Mitä on testattu: DataForSEO kokonaan oikealla ajolla marraskuussa 2026. Muiden työkalujen tuonti on testattu mallitiedostoilla, jotka on rakennettu kunkin työkalun sarakkeiden ja kenttien nimillä. Testit ovat mukana, ja ne voi ajaa komennolla `node tests/run.mjs`. Search Consolen ja Bing Webmaster Toolsin tuonti on testattu samalla tavalla mallitiedostoilla. Jokaista työkalua en ole ajanut oikealla tilillä. Työkalut myös muuttavat vientejään, joten tuonti tulostaa aina, mitkä kentät se löysi ja mitkä jäivät löytymättä. Kertokaa [issuessa](https://github.com/rjdigital-fi/skills/issues), jos jokin ei toimi.

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
Tee avainsanatutkimus aiheesta aurinkopaneelit. Asennamme paneeleita omakotitaloihin Tampereella ja Turussa. Budjetti on 1 000–2 000 euroa kuukaudessa.
```

Tai kutsukaa suoraan: `/rjdigital:avainsanatutkimus`.

Agentti käy työn läpi vaiheittain: lähteen valinta, aihekartta, hakumäärät ja hinnat, ryhmittely ja hakuaikomus, tekoälyn kysymykset, oman sivuston tilanne ja lopuksi raportti. Se kysyy teiltä ne asiat, jotka vain te tiedätte: mitä myytte, mitä ette myy ja millä alueella.

Tulos tallentuu kansioon `avainsanatutkimus/<aihe>/`: `report.html` on raportti dioina (avautuu selaimessa ja tulostuu PDF:ksi), `report.md` sama raportti tekstinä ja `keywords.csv` koko hakusanalista taulukkolaskentaan.

### Hyvä tietää

- Hakumäärät ovat lähteen arvioita. Eri työkalut antavat samalle hakusanalle eri luvun, joten vertailkaa lukuja saman lähteen sisällä.
- Maksullisissa lähteissä haut kuluttavat krediittejä tai rahaa. Agentti kertoo arvion ennen ensimmäistä hakua ja toteutuneen kulun lopuksi. Esimerkkiraportin haut maksoivat DataForSEO:ssa yhteensä noin 0,15 dollaria.
- Rajapinnan avaimet pidetään ympäristömuuttujissa tai MCP-yhteydessä. Niitä ei kirjoiteta keskusteluun eikä tiedostoihin.
- Budjetin jako on lähtökohta, joka lasketaan hakumääristä, klikkaushinnoista ja hakuaikomuksesta. Oikea mainosdata tarkentaa sen ensimmäisten viikkojen jälkeen.
- Agentti kysyy aina alustavan budjettihaarukan. Raportti on euroissa: jos lähteen klikkaushinnat ovat dollareissa, ne muunnetaan Euroopan keskuspankin viitekurssilla, ja kurssi päivämäärineen näkyy raportissa.

## Tekoälynäkyvyys

Skilli selvittää, mainitseeko tekoäly yrityksenne, kun ostaja pyytää suositusta. Agentti kysyy ostajan kysymykset ChatGPT:ltä, Geminiltä, Googlen AI Modelta ja halutessanne Perplexityltä, lukee vastaukset ja tekee niistä raportin.

Raportissa on:

- taulukko kysymyksistä ja tekoälyistä: missä vastauksissa yrityksenne mainitaan ja missä oma sivustonne on lähteenä
- näkyvyys tekoälyittäin
- yritykset, jotka tekoäly nimeää samoihin kysymyksiin
- sivustot, joihin vastaukset nojaavat
- lainaukset siitä, mitä yrityksestänne sanottiin
- mistä tulos syntyy: pikatarkistus kolmesta työalueesta eli teknisestä pohjasta, sisällöstä ja maininnoista muualla. Agentti lukee sivustonne etusivun, robots.txt-tiedoston ja sivukartan sekä enintään kymmenen vastausten lähdesivua. Tarkistus on ilmainen ja suuntaa antava.
- menetelmä: kysymykset, ajokerrat ja tuloksen rajat

Alla on kaksi diaa esimerkkiraportista, koko esimerkki on kansiossa [examples/ilmalampopumput](examples/ilmalampopumput/).

[![Esimerkkiraportin taulukko: kysymykset riveillä, tekoälyt sarakkeissa](examples/ilmalampopumput/kuvat/dia-2.png)](examples/ilmalampopumput/)

[![Esimerkkiraportin lista yrityksistä, jotka tekoäly nimeää](examples/ilmalampopumput/kuvat/dia-4.png)](examples/ilmalampopumput/)

Esimerkin yritykset, sivustot ja vastaukset ovat keksittyjä: kuvitteellinen esimerkki.

Nopean kolmen kysymyksen version voi kokeilla selaimessa: [tekoälynäkyvyyden testi](https://rjdigital.fi/tekoalynakyvyys-testi). Skilli on sama asia laajempana: kysymyksiä on niin monta kuin tarvitaan, ja jokainen kysytään useaan kertaan.

### Datalähde

Tärkeintä on, että vastaukset tulevat oikeista sovelluksista verkkohaku päällä ja lähteet mukana.

| Lähde | Miten kytketään |
| --- | --- |
| DataForSEO | rajapinnan tunnukset ympäristömuuttujissa, mukana valmis skripti. Yksi vastaus maksaa noin 0,004 dollaria (Perplexity noin 0,007). |
| Tekoälynäkyvyyden työkalut: Cloro, Peec AI, Profound, Otterly ja muut | MCP, rajapinta tai vienti. Vastaukset tuodaan skriptillä `answers.mjs`. |
| Tulossivurajapinnat: SerpApi, SearchApi, HasData | Googlen AI Mode ja tekoälykatsaukset, tuodaan samalla skriptillä |
| Jokin muu | vastaus JSON- tai tekstitiedostona, agentti sovittaa kentät |

Mitä on testattu: DataForSEO oikealla ajolla marraskuussa 2026 (ChatGPT, Gemini ja AI Mode). Muiden työkalujen tuonti on testattu mallitiedostoilla, ei oikeilla tileillä. Tuonti tulostaa aina, mitä se löysi.

### Käyttö

```
Kartoita tekoälynäkyvyys yritykselle Esimerkki Oy, esimerkki.fi. Asennamme ilmalämpöpumppuja omakotitaloihin Tampereen seudulla.
```

Tai kutsukaa suoraan: `/rjdigital:tekoalynakyvyys`. Asennus on sama kuin yllä, kansio on `skills/tekoalynakyvyys`.

Agentti ehdottaa kysymykset, ja te muokkaatte ne sellaisiksi, kuin asiakkaanne ne kirjoittaisi. Ennen hakua agentti kertoo hinnan. Tulos tallentuu kansioon `tekoalynakyvyys/<yritys>/`.

### Hyvä tietää

- Tulos on tilannekuva. Tekoäly vastaa samaan kysymykseen eri kerroilla eri tavalla, joten jokainen kysymys kysytään 2–3 kertaa. Pienellä kysymysmäärällä alle noin 10 prosenttiyksikön muutos on satunnaisvaihtelua.
- Pitäkää kysymykset samoina, jos haluatte verrata tulosta myöhemmin. Uudet kysymykset ovat uusi lähtötaso.
- Kysymykset lähetetään tekoälyille ilman yrityksen nimeä.
- "Mainittu" tarkoittaa, että yrityksen nimi on vastauksen tekstissä. "Lähteenä" tarkoittaa, että tekoäly nojasi yrityksen sivustoon. Ne lasketaan erikseen.
- Skripti poimii vastauksista yritysten nimiä, ja agentti lukee vastaukset ja varmistaa, mitkä nimistä ovat oikeasti kilpailijoita.

### Kiitokset

Menetelmässä on ideoita avoimista projekteista: ostopolun mukainen kysymysjoukko, toistetut ajot ja varoitus pienistä muutoksista ([geo-visibility-skill](https://github.com/thevibegarage/geo-visibility-skill)), maininnan ja pelkän lähdelinkin erottaminen ([oneglanse](https://github.com/oneglanse/oneglanse)) ja kaksivaiheinen nimien tunnistus ([elmo](https://github.com/elmohq/elmo)). Koodi on omaa.

## Oma ilme

Kaikki työkalut ja raportit saa muuttaa oman brändin näköisiksi: oma teema, omat fontit ja omat värit. Kummassakin skillissä ilme on yhdessä tiedostossa, `brand.json` (`skills/avainsanatutkimus/brand.json` ja `skills/tekoalynakyvyys/brand.json`): nimi, logo, fontti ja värit. Työkansioon kopioitu `brand.json` ohittaa skillin oman, joten eri asiakkaille voi tehdä eri ilmeen. Pyytäkää agenttia vaihtamaan ilme, vaikka antamalla verkkosivunne osoite, niin se tekee sen puolestanne.

Tekoälynäkyvyyden raportti näyttää yritysten, lähdesivustojen ja tekoälyjen kuvakkeet. Ne haetaan Googlen kuvakepalvelusta, kun raportti avataan. Kuvakkeet saa pois asetuksella `"icons": false`.

## Tekijä

Joonas Rotko, [RJ Digital](https://rjdigital.fi). Teen hakukoneoptimointia, tekoälynäkyvyyttä ja hakumainontaa.

## Lisenssi

MIT. Saatte käyttää, muokata ja jakaa vapaasti.
