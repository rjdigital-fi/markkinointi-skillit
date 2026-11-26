# Esimerkki: brändi, kohderyhmä ja yrityskonteksti

Tältä yrityskonteksti-skillin tulos näyttää. Varsinainen tulos on kolme tekstitiedostoa ja `brand.json`. Raportti on niistä tehty diaesitys, josta omistaja näkee yhdellä lukemisella, mitä yrityksestä on kirjattu ja mikä on vielä auki. Raportti on yksi HTML-tiedosto, joka avautuu selaimessa ja tulostuu PDF:ksi dia kerrallaan.

**Kuvitteellinen esimerkki.** Kuuranta IT Oy, sen henkilöt, hinnat, luvut ja asiakkaiden lauseet ovat keksittyjä. Yritys myy IT-ulkoistusta ja tietoturvapalveluita 20–250 hengen yrityksille. Esimerkki näyttää tiedostojen rakenteen ja merkinnät: 58 tietoa on vahvistettu, 12 on päätelty ja 10 on auki.

Tiedostot:

- [tilanne.md](tilanne.md): millainen yritys on kyseessä ja miten skillit sovitetaan siihen. Agentti kirjoittaa sen ensin siitä, mitä se jo tietää.
- [yritys.md](yritys.md): mitä yritys myy, kenelle, mihin hintaan, miksi siltä ostetaan ja mitä se ei lupaa.
- [kohderyhma.md](kohderyhma.md): kenelle ei myydä, asiakasryhmät ja asiakkaan omat sanat.
- [brandi.md](brandi.md): äänen säännöt esimerkkilauseineen, sanasto, puhuttelu ja ulkoasun käyttö.
- [kuvataulu.html](kuvataulu.html): kuvataulu, josta omistaja valitsi numeroilla hyvät kuvat ja kuvat, joita ei käytetä. Valinnat ovat tiedostossa [raw/images.json](raw/images.json) ja kuvat kansiossa `raw/images/`.
- [brand.json](brand.json): nimi, fontti ja värit muodossa, jonka muut skillit lukevat.
- [status.json](status.json): tarkistuksen tulos.
- [report.html](report.html): raportti dioina. Ladatkaa tiedosto ja avatkaa se selaimessa.
- [report.md](report.md): sama raportti tekstinä.

Raportti on yrityksen omissa väreissä, koska se lukee ilmeen tiedostosta `brand.json`.

## 1. Kansi

![Kansi: yrityksen nimi ja neljä lukua, vahvistetut, päätellyt, avoimet ja valmiit tiedostot](kuvat/dia-1.png)

## 2. Mitä yrityksestä tiedetään varmasti

![Kolme korttia: jokaisen tiedoston tila, omistaja ja viimeisin lukupäivä](kuvat/dia-2.png)

## 3. Yritys lyhyesti

![Taulukko yrityksen perustiedoista, jokaisella rivillä merkintä ja lähde](kuvat/dia-3.png)

## 4. Tarjooma ja hinnat

![Taulukko palveluista, kohderyhmistä ja hinnoista](kuvat/dia-4.png)

## 5. Miksi meiltä ostetaan

![Taulukko erottavista asioista ja todisteista, joita saa käyttää](kuvat/dia-5.png)

## 6. Mihin asiakas vertaa ja pääviestit

![Lista vaihtoehdoista, joihin asiakas vertaa, ja kolme pääviestiä](kuvat/dia-6.png)

## 7. Mitä ei luvata eikä tehdä

![Lista asioista, joita ei luvata eikä tehdä](kuvat/dia-7.png)

## 8. Vastaväitteet ja vastaukset

![Taulukko vastaväitteistä ja vastauksista, yksi vastaus auki](kuvat/dia-8.png)

## 9. Kenelle ei myydä

![Lista asiakkaista, joille yritys ei myy](kuvat/dia-9.png)

## 10. Ryhmä 1

![Taulukko ensimmäisestä asiakasryhmästä: kuka, mikä laukaisee tarpeen, budjetti, mikä kaataa kaupan](kuvat/dia-10.png)

## 11. Ryhmä 2

![Taulukko toisesta asiakasryhmästä, kaksi kohtaa auki](kuvat/dia-11.png)

## 12. Asiakkaan omat sanat

![Asiakkaiden omia lauseita lähteineen sekä parhaat ja huonoimmat asiakkaat](kuvat/dia-12.png)

## 13. Ääni

![Kolme äänen sääntöä: mitä sääntö tarkoittaa, mitä ei, ja oikea esimerkkilause](kuvat/dia-13.png)

## 14. Sanasto

![Taulukko sanoista, joita käytetään ja joita ei käytetä](kuvat/dia-14.png)

## 15. Puhuttelu ja muoto

![Lista puhuttelun ja muodon säännöistä](kuvat/dia-15.png)

## 16. Ulkoasu

![Taulukko väreistä, fontista ja logosta: missä käytetään ja missä ei](kuvat/dia-16.png)

## 17. Kuvat

![Kuusi riviä kuvien käytöstä: hyvät kuvat, mitä ei käytetä, mistä kuvat tulevat, tekoälykuvat ja kuvasääntö](kuvat/dia-17.png)

## 18. Kuvat: omistajan valinnat

![Kuusi kuvaa kuvataululta: kolme hyvää, kaksi joita ei käytetä ja yksi, josta omistaja ei osannut sanoa](kuvat/dia-18.png)

## 19. Värit ja fontti

![Värimallit, fonttinäyte ja tekstin kontrasti](kuvat/dia-19.png)

## 20. Nämä kysytään seuraavaksi

![Lista avoimista kysymyksistä tiedostoittain](kuvat/dia-20.png)

## 21. Nämä kysytään seuraavaksi, jatkuu

![Loput kymmenestä avoimesta kysymyksestä](kuvat/dia-21.png)

## 22. Kolme tiedostoa, yksi paikka

![Ohje tiedostojen käyttöön ja lista tiedostoista](kuvat/dia-22.png)

## Kuvataulu

Kuvataulu on oma sivunsa, jonka omistaja avaa selaimessa. Agentti kerää kuvat verkkosivulta tai kansiosta, jättää logot ja pikkukuvat pois ja näyttää lähes samanlaiset kuvat kerran. Omistaja vastaa numeroilla, ja kuvasääntö kirjoitetaan valinnoista. Esimerkin kuvat ovat tätä esimerkkiä varten piirrettyjä.

![Kuvataulu: kuusi numeroitua kuvaa ja ohje vastata kolmena numerolistana](kuvat/kuvataulu.png)
