# ECOTERM – web stranica

Statična web stranica (HTML + CSS + JS, bez builda) za ECOTERM – grijanje, hlađenje, dizalice topline i centralne klime.

## 1. Upiši podatke firme

Otvori **`js/config.js`** i promijeni telefon, e-mail, područje rada i radno vrijeme.
Ti podaci se sami ubace u zaglavlje, kontakt sekciju, gumb „Nazovite nas" i obrazac.

Obrazac za upit otvara e-mail program posjetitelja s već ispunjenom porukom na adresu iz `config.js`
(GitHub Pages nema server pa se ne može slati izravno).

Prije objave još pregledaj tekstove u `index.html` (npr. da firma zaista radi pomoć oko subvencija i servis tuđih uređaja).

## 2. Objava na GitHub Pages

1. Na github.com napravi novi repozitorij, npr. `ecoterm-web` (Public).
2. Iz ove mape:

   ```bash
   git init
   git add .
   git commit -m "ECOTERM web stranica"
   git branch -M main
   git remote add origin https://github.com/KORISNIK/ecoterm-web.git
   git push -u origin main
   ```

3. Na GitHubu: **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
4. Za minutu–dvije stranica je na `https://KORISNIK.github.io/ecoterm-web/`.

### Vlastita domena (ecoterm.hr)

1. U Settings → Pages → Custom domain upiši `ecoterm.hr` (GitHub stvori datoteku `CNAME`).
2. Kod registrara domene postavi DNS:
   - `A` zapisi za `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` za `www` → `KORISNIK.github.io`
3. Kad se DNS propagira, uključi **Enforce HTTPS**.

> Pažnja: ecoterm.hr trenutno pokazuje na WordPress – promjena DNS-a ga zamjenjuje ovom stranicom.

## Lokalni pregled

```bash
python -m http.server 5310
```

pa otvori http://localhost:5310
