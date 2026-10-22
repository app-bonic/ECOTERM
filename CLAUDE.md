# ECOTERM – upute i kontekst za Claude

Repozitorij firme ECOTERM (grijanje, hlađenje, dizalice topline, centralne klime).
Ova datoteka čuva kontekst rada da se može nastaviti u novoj sesiji (npr. Claude na PC-u).

## Korisnik i način rada

- Korisnik piše hrvatski (opušteno, ponekad kajkavski). **Odgovaraj na hrvatskom**, jednostavno i bez žargona.
- Korisnik nije programer – daj korake koje može izravno slijediti (Windows), bez pretpostavki o alatima.
- **Ne commitaj i ne pushaj bez izričitog odobrenja.** Pull request otvaraj samo kad ga korisnik traži.
  Grana `main` je živa web stranica (GitHub Pages) – na nju ništa ne ide bez dogovora.
- Tekstovi u aplikaciji, komentari u kodu i commit poruke su na hrvatskom.

## Sadržaj repozitorija

1. **Web stranica** (korijen: `index.html`, `css/`, `js/`, `assets/`) – statična stranica za GitHub Pages,
   bez builda. Podaci firme su u `js/config.js`. Vidi `README.md`.
2. **ECOTERM Gradilišta** (`gradilista/`) – web aplikacija nalik WhatsAppu: umjesto razgovora s ljudima
   svako gradilište ima svoj chat s fotografijama, komentarima i statusom radova. Vidi `gradilista/README.md`.

## ECOTERM Gradilišta – kako je napravljeno

- **Server:** Node.js + Express 5 (`gradilista/server.js`), ovisnosti: `express`, `multer`, `qrcode`, `mysql2`.
- **Baza** (`gradilista/db.js`): lokalno ugrađeni `node:sqlite` (Node 22+, datoteka `data/gradilista.db`),
  na hostingu MySQL/MariaDB (`DB_CLIENT=mysql`). Isti SQL za obje baze – zato su vremena milisekunde (BIGINT),
  upsert se radi kao SELECT pa UPDATE/INSERT, tablica pročitanog je `site_reads` (`reads` je rezervirana riječ u MySQL-u).
  Tablice se naprave same pri pokretanju. Ako mijenjaš shemu, mijenjaj OBA bloka u `SCHEMA` (sqlite i mysql).
- **Frontend:** `gradilista/public/` – čisti HTML/CSS/JS bez builda. Cijela aplikacija je u `app.js`
  (usmjeravanje preko hasha: `#/g/<id>` gradilište, `#/ljudi` ljudi i uređaji). Sav korisnički tekst prolazi kroz `esc()`.
  Nakon izmjene CSS/JS povećaj `?v=` u `public/index.html`.
- **Boje/stil** preuzeti iz web stranice (`--ink #16202e`, `--green #2e8b3e`, `--blue`, `--red`, fontovi Archivo + Inter).

### Prijava (bez lozinki)

- Prvi voditelj: dok nema korisnika, prijava kodom iz `SETUP_CODE` (ili nasumični kod ispisan u log).
- Ostali: voditelj napravi **QR pozivnicu** (`POST /api/invites`) → osoba skenira → `/pozivnica/<token>` →
  „Prijavi ovaj uređaj“. Pozivnica vrijedi 48 h, jednokratna je; u bazi se čuva samo SHA-256 hash tokena.
- Uređaj dobije httpOnly kolačić `gradiliste_uredaj` (5 godina); tablica `devices`. Uklanjanje uređaja = odjava.
- Pozivnica s `userId` dodaje novi uređaj postojećoj osobi.
- Uloge: `admin` (u sučelju „Voditelj“: gradilišta, status, ljudi) i `radnik` (čita i šalje poruke/fotografije).

### API (sve pod `/api`)

`GET /me`, `POST /setup`, `GET|POST /invites/:token[/accept]`, `POST /invites`, `POST /logout`,
`GET /people`, `PATCH /people/:id` (uloga/aktivnost), `DELETE /devices/:id`,
`GET|POST /sites`, `PATCH /sites/:id`, `GET /sites/:id/messages?after=<id>`, `POST /sites/:id/messages`
(multipart: `image`, `thumb`, `body` – ili JSON `{body}`), `POST /sites/:id/read`.
Fotografije su na `/uploads/...` i vide ih samo prijavljeni uređaji.

### Ostale odluke

- Nove poruke stižu **pollingom** (svake 4 s, popis gradilišta svakih 8 s) – namjerno, jer dijeljeni hosting
  (cPanel/Passenger) često ne podržava WebSocket.
- Fotografije se smanjuju u pregledniku prije slanja (1600 px + sličica 480 px, JPEG) – štedi mobilne podatke.
- Novi korisnik ne vidi stare poruke kao nepročitane (broje se samo poruke nakon njegova `created_at`).
- Hosting: korisnik ima web hosting s Node.js i bazom. Upute za cPanel „Setup Node.js App“ u `gradilista/README.md`.

## Pokretanje i testiranje

```bash
cd gradilista
npm install
npm start                      # http://localhost:3000, SQLite
```

MySQL lokalno: `DB_CLIENT=mysql DB_USER=... DB_PASSWORD=... DB_NAME=... npm start`.

Automatski test cijelog tijeka u pregledniku (voditelj na računalu + radnik na mobitelu, QR prijava,
fotografije, status, uklanjanje uređaja): `gradilista/test/e2e.js` – upute na vrhu datoteke.
Prototip je tim testom provjeren i na SQLite i na MariaDB.

## Stanje i sljedeći koraci

Gotovo: prototip (chat po gradilištima, fotografije, status, podaci o investitoru, QR prijava uređaja,
upravljanje ljudima i uređajima, PWA manifest za „Dodaj na početni zaslon“).

Nije još napravljeno (prijedlozi korisniku, čeka se njegov odabir):
- objava na hosting korisnika (pitati koji je hosting pa dati točne korake)
- push obavijesti na mobitel za nove poruke (treba service worker + Web Push, HTTPS)
- pristup radnika samo određenim gradilištima (sada svi vide sva)
- zadaci s kvačicom, utrošeni materijal, sati rada po gradilištu
- service worker za rad bez signala (slanje fotografija kad se veza vrati)
