# Brik - web app comande

App statica per gestione comande di ristorante/bar, pronta per GitHub Pages. Usa HTML, CSS e JavaScript moderno; Firebase gestisce login, ruoli, database e realtime nel piano gratuito.

## File

- `index.html`: interfaccia login, inserimento comande, board cucina/amministratore e area di stampa.
- `styles.css`: layout responsive e CSS `@media print` per ricevute da 58 mm.
- `app.js`: logica Firebase Auth, Firestore realtime, carrello, stati ordine, Web Serial ESC/POS e fallback `window.print()`.
- `firestore.rules`: regole di sicurezza per ruoli e visibilita delle comande.
- `firebase-seed.json`: dati iniziali da copiare in Firestore.

## Configurazione Firebase gratuita

1. Crea un progetto su [Firebase](https://console.firebase.google.com/).
2. Vai in `Build > Authentication > Sign-in method` e abilita `Email/Password`.
3. Vai in `Authentication > Users` e crea gli utenti staff usando email tecniche:
   - cameriere: `mario@brik.local`
   - cucina/admin: `cucina@brik.local`
4. Copia gli UID degli utenti appena creati.
5. Vai in `Build > Firestore Database`, crea il database in modalita production.
6. Apri `Rules`, incolla il contenuto di `firestore.rules` e pubblica.
7. Crea manualmente queste collection:
   - `profiles`
   - `menu_items`
   - `orders`
8. In `profiles`, crea un documento per ogni utente. L'ID documento deve essere l'UID Firebase dell'utente:
   - `username`: `mario`
   - `display_name`: `Mario`
   - `role`: `waiter`
   - per cucina/admin usa `role`: `admin`
9. In `menu_items`, crea i documenti indicati in `firebase-seed.json`, oppure usa il menu fallback gia presente nell'app.
10. Vai in `Project settings > General > Your apps`, crea una Web App e copia la configurazione Firebase.
11. Apri `app.js` e sostituisci il blocco `firebaseConfig` con quello fornito da Firebase.

## Login ricordato dal browser

L'app usa Firebase Auth con persistenza `LOCAL`: dopo il primo login, sullo stesso browser e dominio l'utente resta autenticato anche chiudendo e riaprendo il sito. L'accesso viene cancellato solo premendo `Esci` o pulendo i dati del browser.

I campi del form hanno anche `autocomplete="username"` e `autocomplete="current-password"`, quindi Chrome/Safari/Edge possono salvare username e password nel password manager.

## Stampante termica

L'app supporta due modalita:

1. `Web Serial`: funziona soprattutto su Chrome/Edge desktop o Android con stampanti USB/seriali compatibili ESC/POS. Premi `Stampante`, scegli il dispositivo, poi `Invia e stampa`.
2. Fallback browser: se Web Serial non e disponibile o non e collegato, l'app usa `window.print()` con formato stretto da scontrino.

Per molte stampanti Bluetooth POS classiche, il supporto browser dipende dal modello e dal sistema operativo. Se Web Serial non la vede, usa la stampa nativa del browser oppure collega la stampante via USB/seriale.

## Pubblicazione su GitHub Pages

1. Crea un repository GitHub, per esempio `brik-comande`.
2. Carica questi file nella root del repository.
3. Vai in `Settings > Pages`.
4. In `Build and deployment`, scegli `Deploy from a branch`.
5. Seleziona branch `main` e cartella `/root`.
6. Apri l'URL generato da GitHub Pages.

Comandi tipici da questa cartella:

```bash
git add .
git commit -m "Create Brik orders app with Firebase"
git remote add origin https://github.com/TUO_UTENTE/brik-comande.git
git push -u origin main
```

## Pubblicazione alternativa su Firebase Hosting

Se vuoi usare Firebase anche per hosting, oltre che per Auth e Firestore:

```bash
npx firebase-tools login
npx firebase-tools use --add
npx firebase-tools deploy --only hosting,firestore:rules
```

Il file `firebase.json` e gia configurato per pubblicare questa cartella come sito statico.

## Uso quotidiano

- Cameriere: login, seleziona tavolo, aggiunge articoli, note, `Invia e stampa`.
- Cucina/Admin: login, vede tutte le comande in realtime, stampa o aggiorna stato: `In corso`, `Pronta`, `Servita`.
- Menu: modifica la collection `menu_items` da Firebase. Gli articoli con `active = false` non compaiono.

## Fonti Firebase

- [Firebase Auth state persistence](https://firebase.google.com/docs/auth/web/auth-state-persistence)
- [Cloud Firestore realtime listeners](https://firebase.google.com/docs/firestore/query-data/listen)
- [Firebase Web setup](https://firebase.google.com/docs/web/setup)
- [Firebase Hosting quickstart](https://firebase.google.com/docs/hosting/quickstart)
