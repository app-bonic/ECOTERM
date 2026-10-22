# ECOTERM Gradilišta

Aplikacija nalik WhatsAppu, ali umjesto razgovora s ljudima svako **gradilište** ima svoj „chat“:
fotografije s mobitela, komentari, status radova (u pripremi / u tijeku / završeno) i podaci o
investitoru. Radnici se prijavljuju **skeniranjem QR koda**, a aplikacija zatim pamti njihov uređaj.

- Node.js (Express) + MySQL/MariaDB na hostingu (lokalno SQLite, bez instalacije)
- Frontend bez builda (HTML + CSS + JS u `public/`)
- Na mobitelu se može dodati na početni zaslon (radi kao aplikacija)

## Lokalno pokretanje

Potreban je Node.js 22 ili noviji (lokalno koristi ugrađeni SQLite).

```bash
cd gradilista
npm install
npm start
```

Otvori http://localhost:3000. Pri prvom pokretanju server u konzoli ispiše
**kod za prvo postavljanje**. Njime se prijavljuje prvi voditelj.

Za probu s mobitelom u istoj Wi-Fi mreži otvori `http://IP-RAČUNALA:3000`, pa će i QR kodovi
voditi na tu adresu.

## Kako se dodaju radnici

1. Voditelj: izbornik **⋮ → Ljudi i uređaji → Dodaj osobu** (ime + uloga) → **Napravi QR kod**.
2. Radnik skenira QR kod kamerom mobitela i klikne **Prijavi ovaj uređaj**.
3. Uređaj ostaje prijavljen (kolačić vrijedi 5 godina). QR kod vrijedi 48 sati i može se iskoristiti samo jednom.

Postojećoj osobi novi uređaj (npr. računalo u uredu) dodaje se gumbom **+ Uređaj (QR)**.
Izgubljen mobitel: **Ukloni** uz taj uređaj. Osoba koja odlazi: **Deaktiviraj** (odjavljuje sve njene uređaje).

Uloge:
- **Voditelj**: otvara i uređuje gradilišta, mijenja status, dodaje ljude i uređaje.
- **Radnik**: vidi sva gradilišta, šalje fotografije i komentare.

## Objava na hosting (cPanel „Setup Node.js App“ ili slično)

1. **Napravi MySQL bazu** (cPanel → MySQL Databases): bazu, korisnika i lozinku, pa korisniku daj sva prava na bazu.
2. **Prenesi mapu `gradilista/`** na hosting (bez `node_modules/`, `data/` i `uploads/`), npr. u `~/gradilista`.
3. **Setup Node.js App → Create Application**:
   - Node.js version: 18 ili novija
   - Application root: `gradilista`
   - Application URL: npr. poddomena `gradilista.ecoterm.hr`
   - Application startup file: `server.js`
4. Dodaj **varijable okoline** (Environment variables):

   | Varijabla      | Vrijednost                                   |
   |----------------|----------------------------------------------|
   | `DB_CLIENT`    | `mysql`                                      |
   | `DB_HOST`      | `localhost`                                  |
   | `DB_NAME`      | ime baze                                     |
   | `DB_USER`      | korisnik baze                                |
   | `DB_PASSWORD`  | lozinka baze                                 |
   | `SETUP_CODE`   | tajni kod za prvog voditelja (izmisli ga)    |
   | `PUBLIC_URL`   | `https://gradilista.ecoterm.hr` (za QR kodove) |
   | `UPLOAD_DIR`   | (neobavezno) mapa za fotografije, zadano `uploads/` |

5. Klikni **Run NPM Install**, zatim **Restart**.
6. Otvori adresu aplikacije, upiši ime i `SETUP_CODE`. Ti si prvi voditelj.
7. Uključi **HTTPS** (cPanel → SSL/TLS Status → AutoSSL). Bez HTTPS-a mobiteli ne nude instalaciju na početni zaslon.

Tablice u bazi naprave se same pri prvom pokretanju.

### Sigurnosna kopija

Sve je u dva dijela: **baza** (cPanel → Backup ili phpMyAdmin → Export) i mapa **`uploads/`** s fotografijama.

## Struktura

```
server.js          API, prijava uređaja, QR pozivnice, upload slika
db.js              SQLite (lokalno) / MySQL (hosting) i tablice
public/index.html  ljuska aplikacije
public/app.js      cijela aplikacija u pregledniku
public/app.css     izgled
```

Fotografije se prije slanja smanje u pregledniku (do 1600 px, plus mala sličica), tako da slanje
s gradilišta ne troši puno mobilnih podataka. Nove poruke stižu automatski (provjera svakih nekoliko sekundi).
