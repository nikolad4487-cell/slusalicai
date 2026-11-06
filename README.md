# Slušalica AI Studio

Besplatan lokalni uređivač titlova i lyric videa. React + TypeScript + Vite, bez prijave, backenda i plaćenih API-ja. Hrvatsko sučelje i dva uređivača s dijeljenim vremenskim oznakama.

## Instalacija i pokretanje

Node.js 22.12+ ili 24 LTS i npm:

```sh
npm ci
npm run dev
```

Ako npm nema dozvolu za zadani cache: `npm ci --cache /tmp/slusalica-npm-cache`.

```sh
npm test
npm run build
```

## Radni postupak

1. Učitajte MP3/WAV i Suno SRT ili LRC u kartici Titlovi. TXT dobiva **približno**, ravnomjerno raspoređene oznake. Provjerite vremena u sekundama i tekst svakog stiha; klik na broj stiha premotava audio. VTT je također podržan.
2. U odjeljku Poveži engleski prijevod zalijepite jedan prijevod po stihu. Jednaki brojevi redaka automatski se povezuju; kod različitih brojeva ručno odaberite ili uredite prijevod svakog stiha. Vremena su zajednička i značenje se ne mijenja. HR/EN prekidač mijenja uređivač i pregled. SRT/LRC/VTT izvoze se za trenutačno odabrani jezik.
3. U Izgledu odaberite omjer, jedan od šest stilova, font, boje, obrub, sjenu, animaciju i pozadinu. Dodajte JPG/PNG/WEBP ili lokalni MP4. Pozadinski video je bez zvuka i ponavlja se; zvuk dolazi iz pjesme. Predugi stihovi se prelamaju i po potrebi vodoravno sažimaju u najviše 2–3 retka.
4. Vizualizator koristi Web Audio AnalyserNode: stvarne frekvencije za stupce/krug i vremenski signal za waveform/pulsirajuću liniju. Ne generira nasumične podatke. Radi nakon početka reprodukcije.
5. Izvoz: odaberite HR/EN, 720p/1080p i WebM/MP4. Canvas captureStream (30 fps) + Web Audio MediaStreamDestination spajaju isti audio sat i trenutak crtanja teksta. MediaRecorder snima video u stvarnom vremenu; pjesma se vraća na početak. Držite karticu aktivnom, ne zaključavajte uređaj. Izvoz troši CPU/GPU, memoriju i bateriju. Pregledajte rezultat prije preuzimanja. Ponovite za drugi jezik.
6. Projekti: Spremi projekt čuva metapodatke i medije u IndexedDB-u. Izvoz cijelog projekta uključuje medije u JSON (base64, veća datoteka i potrošnja memorije). Uvoz vraća projekt. Kvota pohrane ovisi o pregledniku. Za važne projekte preuzmite kopiju. Vlastiti stilovi čuvaju se u localStorageu.

## Lokalni AI (opcionalan)

Kartica AI tekst koristi `@huggingface/transformers` i višejezični model `onnx-community/whisper-tiny` u zasebnom workeru. Prva uporaba traži internet za javne modelne datoteke (Hugging Face/CDN) i ONNX runtime; nema API ključeva ni slanja audija. Model i runtime mogu zauzimati stotine MB. CPU/WASM je zadani način; WebGPU je izbor samo kada ga preglednik izlaže. Dekodiranje, resampling na 16 kHz mono i prepoznavanje rade lokalno. Model daje približne oznake segmenata, ne pouzdane oznake riječi. Pjevanje, instrumentalna glazba i hrvatski mogu biti slabo prepoznati. Originalni tekst zamjenjuje prepoznate retke samo ako je broj isti; to **nije forced alignment**. Kod različitog broja redaka ostaje dostupan za ručni rad. Greške učitavanja, nedostatak memorije i nedostupni GPU prikazuju se u statusu. Prekinuti zadatak zaustavlja worker. Automatski prijevod nije ugrađen; engleski tekst dostavlja korisnik.

## MP4 bez podrške u pregledniku

WebM se nikad ne preimenuje u MP4. Native MP4 koristi se isključivo kad ga MediaRecorder prijavi podržanim. Pouzdana besplatna alternativa: na računalu instalirajte [FFmpeg](https://ffmpeg.org/download.html), preuzmite WebM i u njegovoj mapi izvršite:

```sh
ffmpeg -i video.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart video.mp4
```

Ovo je stvarna lokalna konverzija, ne obrada na poslužitelju. Potreban je FFmpeg s libx264 encoderom. Kartica Izvoz sadrži istu naredbu.

## Preglednici i ograničenja

- Preporuka: aktualni desktop Chrome/Edge. WebM VP9/VP8 + Opus ovise o MediaRecorder codecima. MP4 ovisi o OS-u i pregledniku; aplikacija ga provjerava pri izvozu.
- Firefox: osnovni editor i WebM; WebGPU i AI podrška variraju.
- Safari/iOS: audio/video codec, MediaRecorder i canvas capture podrška variraju; MP4 može raditi gdje WebM ne radi. AI može premašiti dostupnu memoriju. Uređaj može ograničiti snimanje u pozadini.
- HTTPS je potreban za WebGPU izvan localhosta. WebGPU podrška nije jamstvo da će model stati u memoriju; ručno odaberite CPU ako prijavi grešku.
- Izvoz 1080p i duge pjesme zahtijevaju snažniji uređaj i memoriju. Izlaz je kodiran u stvarnom vremenu pa usporavanja mogu uzrokovati ispuštene kadrove. Nema obećanja preciznog karaoke isticanja riječi: to je označena aproksimacija retka.
- Prikaz vremenske trake i sinkronizacija izravno koriste audio vrijeme. Preklapajuće oznake dopuštene su u editoru; pregled prikazuje prvi aktivni stih. Neispravne oznake blokiraju izvoz.
- Nema cloud sinkronizacije. Mediji se nikada namjerno ne prenose. Za osnovni rad nakon učitavanja stranice nije potrebna mreža. AI prvo preuzima model; pristup javnom fontu nije nužan (sistemski fallback).

## Vercel Hobby

Repozitorij povežite s Vercelom, framework **Vite**, build `npm run build`, output `dist`, install `npm ci`. Nema Functions, serverskih tajni, baze ni Supabasea. HTTPS se dobiva automatski. Hobby je primjeren osobnoj nekomercijalnoj uporabi prema aktualnim Vercel uvjetima; hosting nije objavljen samom izgradnjom projekta.

## Provjere

`npm test`: parseri i izvoz, dijeljena vremena prijevoda, validacija projekta i canvas renderer. `npm run build`: stroga TypeScript provjera i produkcijski bundle. Funkcionalne provjere preglednika trebaju uključiti MP3/WAV, SRT/LRC, oba jezika, lokalno spremanje i stvaran video sa zvukom; dostupnost GPU-a i svake kombinacije codeca zahtijeva konkretan uređaj.

### Funkcionalni test u Chromiumu

Uz pokrenut `npm run dev`, pokrenite `npm run test:browser`. Test koristi `/usr/bin/chromium`; drugu putanju možete zadati varijablom `CHROMIUM_PATH`. Učitava generirani WAV i SRT, uređuje i prevodi titlove, preuzima SRT, sprema/otvara IndexedDB projekt, izvozi stvarni video sa zvukom, provjerava prijenos cijelog projekta i mobilni izgled. Artefakti se pišu u `/tmp/slusalica-*`.

`.npmrc` koristi službenu ONNX opciju za izostavljanje **serverskih CUDA** binarnih paketa. Preglednički WASM/WebGPU time se ne isključuje; npm provjera integriteta ostaje uključena. Aktualni npm 11 može ispisati upozorenje o prilagođenoj opciji, ali instalacija je provjerena.

## Rezultat provjera u ovom okruženju

- Ponovljena čista instalacija `npm ci`, TypeScript i produkcijski build: prolaze.
- 7 automatiziranih testova: prolaze (SRT, LRC, ponovljene oznake/offset, TXT, HR/EN izvoz, vremenske oznake, validacija projekta).
- Chromium, razvojni i produkcijski paket: prolaze funkcionalni testovi WAV/MP3, SRT/LRC, uređivanja, prijevoda, preuzimanja, IndexedDB-a, cijelog projekta s medijima, slike pozadine i mobilnog prikaza.
- Stvarni WebM: FFprobe potvrđuje VP9 + Opus, 1280 × 720 / 4 s i 1080 × 1920 / 2 s. FFmpeg potvrđuje da audio nije tih; lokalna konverzija daje H.264 + AAC MP4. Ovo su kratki testni mediji, ne jamstvo performansi na svim uređajima i dugim pjesmama.
- AI worker u produkcijskom paketu pokreće se i prikazuje stvarnu grešku preuzimanja. Mrežna politika cloud okruženja odbila je Hugging Face zahtjev (403). Zato uspješno prepoznavanje modelom **nije potvrđeno** u ovom okruženju. Potrebni modelni hostovi dodani su u nacrt postavki, ali spremanje nacrta ne primjenjuje promjene automatski. U normalnom pregledniku pristup modelima ovisi o korisnikovoj mreži.
- Vercel konfiguracija pripremljena je u `vercel.json`; javni deployment nije izvršen. Fizički Safari/iOS, WebGPU inference i sve kombinacije native MP4 codeca nisu provjereni.
