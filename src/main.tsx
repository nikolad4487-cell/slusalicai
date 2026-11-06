import fixWebmDuration from "fix-webm-duration";
import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Headphones,
  Upload,
  Play,
  Pause,
  Download,
  Plus,
  Trash2,
  Save,
  FolderOpen,
  SlidersHorizontal,
  Type,
  AudioLines,
  Film,
  Languages,
  Sparkles,
  Check,
  ChevronRight,
  Music2,
  Monitor,
  LoaderCircle,
} from "lucide-react";
import { openDB } from "idb";
import { parse, serialize, download, uid, type Cue } from "./subtitles";
import {
  initial,
  presets,
  preset,
  validateProject,
  type Look,
  type Project,
} from "./model";
import { paint } from "./render";
import "./style.css";
const db = () =>
  openDB("slusalica-studio", 1, {
    upgrade(d) {
      d.createObjectStore("projects");
    },
  });
function App() {
  const [name, setName] = useState("Moja nova pjesma"),
    [lang, setLang] = useState<"hr" | "en">("hr"),
    [cues, setCues] = useState<Cue[]>([]),
    [look, setLook] = useState<Look>(initial),
    [tab, setTab] = useState("titlovi"),
    [audioBlob, setAudioBlob] = useState<Blob>(),
    [background, setBackground] = useState<Blob>(),
    [audioUrl, setAudioUrl] = useState(""),
    [duration, setDuration] = useState(0),
    [time, setTime] = useState(0),
    [playing, setPlaying] = useState(false),
    [translation, setTranslation] = useState(""),
    [original, setOriginal] = useState(""),
    [mapping, setMapping] = useState(false),
    [message, setMessage] = useState("Sve ostaje na vašem uređaju."),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [result, setResult] = useState(""),
    [resultName, setResultName] = useState(""),
    [resolution, setResolution] = useState("720"),
    [format, setFormat] = useState("webm"),
    [saved, setSaved] = useState<string[]>([]),
    [custom, setCustom] = useState<string[]>(() =>
      JSON.parse(localStorage.getItem("slusalica-styles") || "[]"),
    ),
    [waveform, setWaveform] = useState<number[]>([]);
  const audio = useRef<HTMLAudioElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    media = useRef<HTMLImageElement | HTMLVideoElement | null>(null),
    context = useRef<AudioContext | null>(null),
    analyser = useRef<AnalyserNode | null>(null),
    destination = useRef<MediaStreamAudioDestinationNode | null>(null),
    worker = useRef<Worker | null>(null),
    recorder = useRef<MediaRecorder | null>(null),
    recording = useRef(false),
    state = useRef({ time, cues, lang, look, name }),
    bgUrl = useRef("");
  state.current = { time, cues, lang, look, name };
  const update = (v: Partial<Look>) => setLook((s) => ({ ...s, ...v }));
  const notify = (e: unknown) =>
    setMessage(e instanceof Error ? e.message : String(e));
  function engine() {
    if (!audio.current) throw Error("Audio nije učitan.");
    if (!context.current) {
      const ctx = new AudioContext();
      context.current = ctx;
      const source = ctx.createMediaElementSource(audio.current);
      const a = ctx.createAnalyser();
      a.fftSize = 512;
      analyser.current = a;
      destination.current = ctx.createMediaStreamDestination();
      source.connect(a);
      a.connect(ctx.destination);
      a.connect(destination.current);
    }
    return context.current.resume();
  }
  async function loadAudio(file: Blob) {
    if (recording.current) return;
    setAudioBlob(file);
    setAudioUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(file);
    });
    setTime(0);
    setPlaying(false);
    setMessage("Audio je učitan. Dodajte SRT ili LRC titlove.");
    try {
      const ctx = new AudioContext();
      try {
        const b = await ctx.decodeAudioData(await file.arrayBuffer());
        const d = b.getChannelData(0);
        const size = Math.max(1, Math.floor(d.length / 160));
        setWaveform(
          Array.from({ length: 160 }, (_, i) => {
            let m = 0;
            for (
              let j = i * size;
              j < Math.min((i + 1) * size, d.length);
              j += 16
            )
              m = Math.max(m, Math.abs(d[j]));
            return m;
          }),
        );
        setDuration(b.duration);
      } finally {
        await ctx.close();
      }
    } catch {
      setMessage("Preglednik ne može dekodirati audio. Pokušajte WAV ili MP3.");
    }
  }
  async function loadBackground(file: Blob | undefined) {
    if (bgUrl.current) URL.revokeObjectURL(bgUrl.current);
    if (media.current instanceof HTMLVideoElement) media.current.pause();
    media.current = null;
    setBackground(file);
    if (!file) return;
    const url = URL.createObjectURL(file);
    bgUrl.current = url;
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.src = url;
      await new Promise<void>((res, rej) => {
        v.onloadeddata = () => res();
        v.onerror = () => rej(Error("Pozadinski video nije podržan."));
      });
      media.current = v;
    } else {
      const i = new Image();
      i.src = url;
      await i.decode();
      media.current = i;
    }
  }
  async function toggle() {
    try {
      await engine();
      if (audio.current!.paused) {
        await audio.current!.play();
        if (media.current instanceof HTMLVideoElement)
          await media.current.play();
      } else {
        audio.current!.pause();
        if (media.current instanceof HTMLVideoElement) media.current.pause();
      }
    } catch (e) {
      notify(e);
    }
  }
  function seek(t: number) {
    if (recording.current) return;
    const v = Math.max(0, Math.min(duration, t));
    if (audio.current) audio.current.currentTime = v;
    setTime(v);
    if (media.current instanceof HTMLVideoElement && media.current.duration)
      media.current.currentTime = v % media.current.duration;
  }
  useEffect(() => {
    let id = 0;
    const loop = () => {
      const c = canvas.current;
      if (c) {
        const [rw, rh] = state.current.look.ratio.split(":").map(Number);
        const base = Number(resolution),
          h = recording.current
            ? Math.round(rw < rh ? (base * rh) / rw : base)
            : Math.round((960 * rh) / rw),
          w = recording.current
            ? Math.round(rw < rh ? base : (base * rw) / rh)
            : 960;
        if (c.width !== w || c.height !== h) {
          c.width = w;
          c.height = h;
        }
        const data = analyser.current
            ? new Uint8Array(analyser.current.frequencyBinCount)
            : null,
          wave = analyser.current ? new Uint8Array(256) : null;
        if (data && wave) {
          analyser.current!.getByteFrequencyData(data);
          analyser.current!.getByteTimeDomainData(wave);
        }
        const s = state.current;
        paint(
          c.getContext("2d")!,
          w,
          h,
          audio.current?.currentTime ?? s.time,
          s.cues,
          s.lang,
          s.look,
          s.name,
          media.current,
          data,
          wave,
        );
        if (recording.current && audio.current)
          setProgress(
            (audio.current.currentTime / audio.current.duration) * 100,
          );
      }
      id = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(id);
  }, [resolution]);
  useEffect(() => {
    db()
      .then(async (d) => setSaved((await d.getAllKeys("projects")).map(String)))
      .catch(notify);
    return () => {
      worker.current?.terminate();
    };
  }, []);
  async function importSubs(file: File) {
    const text = await file.text();
    const parsed = parse(text, duration || 180);
    if (!parsed.length) {
      setMessage("Datoteka ne sadrži prepoznatljive titlove.");
      return;
    }
    setCues(parsed);
    setMessage(
      file.name.toLowerCase().endsWith(".txt")
        ? "TXT je raspoređen približno. Ručno ispravite vremena."
        : `Učitano ${parsed.length} stihova.`,
    );
  }
  function edit(id: string, v: Partial<Cue>) {
    setCues((cs) => cs.map((c) => (c.id === id ? { ...c, ...v } : c)));
  }
  const invalid = cues.some(
    (c) => !Number.isFinite(c.start + c.end) || c.start < 0 || c.end <= c.start,
  );
  function exportSubs(f: string, l = lang) {
    if (invalid) {
      setMessage("Ispravite neispravne vremenske oznake.");
      return;
    }
    download(
      new Blob([serialize(cues, l, f)], { type: "text/plain;charset=utf-8" }),
      `${name}_${l.toUpperCase()}.${f}`,
    );
  }
  function applyTranslation() {
    const lines = translation
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length !== cues.length) {
      setMapping(true);
      setMessage("Broj redaka se razlikuje. Odaberite prijevod za svaki stih.");
      return;
    }
    setCues((cs) => cs.map((c, i) => ({ ...c, en: lines[i] })));
    setMapping(false);
    setMessage("Prijevod je povezan s izvornim vremenskim oznakama.");
  }
  function project(): Project {
    return {
      version: 1,
      name,
      language: lang,
      cues,
      look,
      audio: audioBlob,
      background,
      original,
      output: { resolution, format },
    };
  }
  async function saveProject() {
    try {
      const d = await db();
      await d.put("projects", project(), name);
      setSaved((await d.getAllKeys("projects")).map(String));
      setMessage("Projekt i mediji spremljeni su u ovom pregledniku.");
    } catch (e) {
      notify(e);
    }
  }
  async function restore(p: Project) {
    if (!validateProject(p)) throw Error("Neispravan projekt.");
    audio.current?.pause();
    setName(p.name);
    setLang(p.language);
    setCues(p.cues);
    setLook(p.look);
    setOriginal(p.original);
    setResolution(p.output?.resolution ?? "720");
    setFormat(p.output?.format ?? "webm");
    if (p.audio) await loadAudio(p.audio);
    else {
      setAudioBlob(undefined);
      setAudioUrl("");
      setDuration(0);
      setWaveform([]);
    }
    await loadBackground(p.background);
    setMessage("Projekt je otvoren.");
  }
  async function pack() {
    try {
      const p = project();
      const base64 = async (b: Blob) =>
        await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = rej;
          r.readAsDataURL(b);
        });
      download(
        new Blob(
          [
            JSON.stringify({
              ...p,
              audio: p.audio ? await base64(p.audio) : null,
              background: p.background ? await base64(p.background) : null,
            }),
          ],
          { type: "application/json" },
        ),
        `${name}.slusalica.json`,
      );
    } catch (e) {
      notify(e);
    }
  }
  async function unpack(f: File) {
    try {
      const raw: Record<string, unknown> = JSON.parse(await f.text());
      if (!validateProject(raw)) throw Error("Nepodržan ili oštećen projekt.");
      const p: Project = { ...raw, audio: undefined, background: undefined };
      for (const key of ["audio", "background"] as const) {
        const value = (raw as Record<string, unknown>)[key];
        if (value) {
          if (
            typeof value !== "string" ||
            !/^data:(audio|video|image)\//.test(value)
          )
            throw Error("Neispravan medij u projektu.");
          p[key] = await (await fetch(value)).blob();
        }
      }
      await restore(p);
    } catch (e) {
      notify(e);
    }
  }
  async function exportVideo() {
    try {
      if (!audioBlob || !canvas.current || !audio.current)
        throw Error("Najprije učitajte audio.");
      if (invalid) throw Error("Ispravite vremenske oznake.");
      if (!("MediaRecorder" in window) || !canvas.current.captureStream)
        throw Error(
          "Ovaj preglednik ne podržava lokalno snimanje videa. Koristite Chrome ili Edge.",
        );
      const choices =
        format === "mp4"
          ? ["video/mp4;codecs=avc1.424028,mp4a.40.2", "video/mp4"]
          : [
              "video/webm;codecs=vp9,opus",
              "video/webm;codecs=vp8,opus",
              "video/webm",
            ];
      const mime = choices.find((m) => MediaRecorder.isTypeSupported(m));
      if (!mime)
        throw Error(
          "Format nije podržan. Odaberite WebM i zatim koristite lokalni FFmpeg postupak ispod.",
        );
      await engine();
      audio.current.pause();
      audio.current.currentTime = 0;
      if (media.current instanceof HTMLVideoElement) {
        media.current.currentTime = 0;
        await media.current.play();
      }
      recording.current = true;
      setBusy(true);
      setProgress(0);
      await new Promise<void>((r) =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
      );
      const video = canvas.current.captureStream(30),
        stream = new MediaStream([
          ...video.getVideoTracks(),
          ...destination.current!.stream.getAudioTracks(),
        ]);
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: Number(resolution) === 1080 ? 8000000 : 4000000,
      });
      recorder.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onerror = () => {
        setMessage("Izvoz nije uspio; uređaj možda nema dovoljno resursa.");
        rec.stop();
      };
      rec.onstop = async () => {
        const elapsed = (audio.current?.currentTime ?? 0) * 1000;
        setResultName(
          `${name}_${lang.toUpperCase()}.${mime.includes("mp4") ? "mp4" : "webm"}`,
        );
        recording.current = false;
        video.getTracks().forEach((t) => t.stop());
        audio.current?.pause();
        if (media.current instanceof HTMLVideoElement) media.current.pause();
        const rawBlob = new Blob(chunks, { type: mime });
        const blob = mime.includes("webm")
          ? await fixWebmDuration(rawBlob, elapsed, { logger: false })
          : rawBlob;
        setBusy(false);
        setResult((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(blob);
        });
        const completed = elapsed >= duration * 1000 - 150;
        setMessage(
          completed
            ? "Snimanje završeno. Pregledajte video prije preuzimanja."
            : "Snimanje prekinuto. Dostupan je djelomičan video.",
        );
        setProgress(completed ? 100 : elapsed / (duration * 10));
      };
      rec.start(1000);
      await audio.current.play();
      setMessage(
        "Izvoz traje koliko i pjesma. Držite ovu karticu otvorenom i aktivnom.",
      );
    } catch (e) {
      recording.current = false;
      recorder.current?.state === "recording" && recorder.current.stop();
      setBusy(false);
      notify(e);
    }
  }
  async function transcribe() {
    try {
      if (!audioBlob) throw Error("Učitajte audio za prepoznavanje.");
      setBusy(true);
      setProgress(0);
      setMessage(
        "Preuzimanje Whisper tiny modela (~100–200 MB). Audio ostaje lokalno.",
      );
      const ctx = new AudioContext();
      let buffer: AudioBuffer;
      try {
        buffer = await ctx.decodeAudioData(await audioBlob.arrayBuffer());
      } finally {
        await ctx.close();
      }
      const offline = new OfflineAudioContext(
        1,
        Math.ceil(buffer.duration * 16000),
        16000,
      );
      const src = offline.createBufferSource();
      src.buffer = buffer;
      src.connect(offline.destination);
      src.start();
      const samples = (await offline.startRendering()).getChannelData(0);
      worker.current?.terminate();
      const w = new Worker(new URL("./ai.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      w.onmessage = (e) => {
        const d = e.data;
        if (d.type === "progress") {
          setMessage("Lokalni AI: preuzimanje i obrada modela…");
          if (typeof d.value?.progress === "number")
            setProgress(d.value.progress);
        }
        if (d.type === "error") {
          setBusy(false);
          setMessage(
            `Lokalni AI nije dostupan: ${d.message}. Pokušajte CPU način ili uvezite SRT.`,
          );
        }
        if (d.type === "result") {
          const chunks = d.result.chunks || [];
          let lines = original.split("\n").filter((s) => s.trim());
          const result: Cue[] = chunks.map(
            (
              c: { timestamp: [number, number | null]; text: string },
              i: number,
            ) => ({
              id: uid(),
              start: c.timestamp[0] ?? 0,
              end: c.timestamp[1] ?? buffer.duration,
              hr: lang === "hr" ? c.text.trim() : "",
              en: lang === "en" ? c.text.trim() : "",
            }),
          );
          if (lines.length === result.length)
            result.forEach((c, i) => (c[lang] = lines[i]));
          setCues(result);
          setBusy(false);
          setProgress(100);
          setMessage(
            lines.length && lines.length !== result.length
              ? "Prepoznavanje završeno. Izvorni tekst ima različit broj redaka; ručno ga povežite."
              : "AI vremena su približna, posebno za pjevanje. Provjerite svaki stih.",
          );
        }
      };
      w.onerror = (e) => {
        setBusy(false);
        setMessage(`AI worker nije uspio: ${e.message}`);
      };
      const device = (document.getElementById("ai-device") as HTMLSelectElement)
        .value;
      w.postMessage({ samples, language: lang, device }, [samples.buffer]);
    } catch (e) {
      setBusy(false);
      notify(e);
    }
  }
  const active = cues.find((c) => time >= c.start && time < c.end);
  const fmt = (t: number) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const upload = (
    accept: string,
    fn: (f: File) => void,
    children: React.ReactNode,
  ) => (
    <label className="upload">
      {children}
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          if (e.target.files?.[0]) fn(e.target.files[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
  return (
    <div className="app">
      <aside>
        <a className="brand" href="#">
          <span className="brand-icon">
            <Headphones size={25} />
          </span>
          <span>
            slušalica<span className="ai">AI</span>
            <small>CREATOR STUDIO</small>
          </span>
        </a>
        <div className="workspace-label">RADNI PROSTOR</div>
        <button className="nav selected" onClick={() => setTab("titlovi")}>
          <Film size={19} /> Lyric video studio <span className="dot" />
        </button>
        <button className="nav" onClick={() => setTab("projekti")}>
          <FolderOpen size={19} /> Moji projekti{" "}
          <span className="count">{saved.length}</span>
        </button>
        <div className="side-bottom">
          <div className="local-icon">
            <Check size={17} />
          </div>
          <strong>Vaša glazba. Vaša privatnost.</strong>
          <p>
            Datoteke se obrađuju lokalno.
            <br />
            Bez prijave. Bez ograničenja kredita.
          </p>
          <span className="free-tag">100% BESPLATNO</span>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Radni prostor <ChevronRight size={14} />{" "}
            <span>Lyric video studio</span>
          </div>
          <span className="local-badge">
            <span /> Lokalna obrada
          </span>
        </header>
        <section className="page-head">
          <div>
            <div className="eyebrow">OD PJESME DO VIDEA</div>
            <h1>
              Vaša glazba, u prvom planu<span>.</span>
            </h1>
            <p>Stvorite titlove i lyric video koji se pamti.</p>
          </div>
          <div className="head-actions">
            <button onClick={saveProject} disabled={busy}>
              <Save size={16} /> Spremi projekt
            </button>
            <button className="primary" onClick={() => setTab("izvoz")}>
              <Download size={16} /> Izvezi video
            </button>
          </div>
        </section>
        <div className="project-strip">
          <Music2 size={19} />
          <input
            aria-label="Naziv pjesme"
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="project-chip">LOKALNI PROJEKT</span>
          <span className="strip-right">
            {duration ? fmt(duration) : "Audio nije učitan"}
          </span>
        </div>
        <div className="studio">
          <section className="editor card">
            <nav className="tabs">
              {[
                ["titlovi", Type, "Titlovi"],
                ["izgled", SlidersHorizontal, "Izgled"],
                ["zvuk", AudioLines, "Vizualizator"],
                ["ai", Sparkles, "AI tekst"],
                ["projekti", FolderOpen, "Projekti"],
                ["izvoz", Download, "Izvoz"],
              ].map(([id, Icon, label]) => (
                <button
                  aria-label={String(label)}
                  title={String(label)}
                  disabled={busy}
                  key={String(id)}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(String(id))}
                >
                  {React.createElement(Icon as typeof Type, { size: 16 })}
                  <span>{String(label)}</span>
                </button>
              ))}
            </nav>
            <fieldset disabled={busy} className="editor-body">
              {tab === "titlovi" && (
                <>
                  <div className="section-title">
                    <h2>Tekst koji prati svaki ton</h2>
                    <span>{cues.length} stihova</span>
                  </div>
                  <p className="muted">
                    Uvezite titlove ili dodajte vlastite stihove.
                  </p>
                  <div className="two-uploads">
                    {upload(
                      ".mp3,.wav,audio/mpeg,audio/wav",
                      (f) => void loadAudio(f),
                      <>
                        <Music2 size={23} />
                        <strong>
                          {audioBlob ? "Zamijeni pjesmu" : "Učitaj pjesmu"}
                        </strong>
                        <small>MP3 ili WAV</small>
                      </>,
                    )}
                    {upload(
                      ".srt,.lrc,.txt,.vtt",
                      (f) => void importSubs(f),
                      <>
                        <Upload size={23} />
                        <strong>Uvezi titlove</strong>
                        <small>SRT, LRC, VTT ili TXT</small>
                      </>,
                    )}
                  </div>
                  <div className="language-switch">
                    <button
                      className={lang === "hr" ? "chosen" : ""}
                      onClick={() => setLang("hr")}
                    >
                      HR <span>Hrvatski</span>
                    </button>
                    <button
                      className={lang === "en" ? "chosen" : ""}
                      onClick={() => setLang("en")}
                    >
                      EN <span>English</span>
                    </button>
                  </div>
                  <div className="cue-list">
                    {!cues.length && (
                      <div className="empty">
                        <Type size={26} />
                        <h3>Svaka pjesma ima svoju priču.</h3>
                        <p>Učitajte titlove i dajte joj mjesto na ekranu.</p>
                      </div>
                    )}
                    {cues.map((c, i) => (
                      <div
                        key={c.id}
                        className={`cue ${active?.id === c.id ? "current" : ""}`}
                      >
                        <button
                          className="cue-number"
                          onClick={() => seek(c.start)}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </button>
                        <div className="cue-content">
                          <div className="times">
                            <input
                              aria-label={`Početak stiha ${i + 1}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={c.start}
                              onChange={(e) =>
                                edit(c.id, { start: Number(e.target.value) })
                              }
                            />
                            <span>→</span>
                            <input
                              aria-label={`Kraj stiha ${i + 1}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={c.end}
                              onChange={(e) =>
                                edit(c.id, { end: Number(e.target.value) })
                              }
                            />
                            <small>sek</small>
                            {c.end <= c.start && <em>Neispravno vrijeme</em>}
                          </div>
                          <textarea
                            aria-label={`${lang === "hr" ? "Hrvatski" : "Engleski"} stih ${i + 1}`}
                            value={c[lang]}
                            placeholder={
                              lang === "en"
                                ? "Unesite engleski prijevod…"
                                : "Unesite stih…"
                            }
                            onChange={(e) =>
                              edit(c.id, { [lang]: e.target.value })
                            }
                          />
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Obriši stih"
                          onClick={() =>
                            setCues((cs) => cs.filter((x) => x.id !== c.id))
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="add-line"
                    onClick={() =>
                      setCues((cs) => [
                        ...cs,
                        {
                          id: uid(),
                          start: time,
                          end: Math.min(duration || time + 4, time + 4),
                          hr: "",
                          en: "",
                        },
                      ])
                    }
                  >
                    <Plus size={15} /> Dodaj stih
                  </button>
                  <details>
                    <summary>
                      <Languages size={16} /> Poveži engleski prijevod
                    </summary>
                    <p className="muted">
                      Jedan prevedeni redak po izvornom stihu. Značenje se ne
                      mijenja.
                    </p>
                    <textarea
                      value={translation}
                      onChange={(e) => setTranslation(e.target.value)}
                      placeholder="Ovdje zalijepite cijeli engleski prijevod"
                    />
                    <button onClick={applyTranslation} disabled={!cues.length}>
                      Poveži retke
                    </button>
                    {mapping &&
                      cues.map((c, i) => (
                        <label key={c.id}>
                          {i + 1}. {c.hr}
                          <select
                            value=""
                            onChange={(e) => edit(c.id, { en: e.target.value })}
                          >
                            <option value="">
                              Odaberite redak ({c.en || "nije povezan"})
                            </option>
                            {translation
                              .split("\n")
                              .filter(Boolean)
                              .map((l, j) => (
                                <option key={j} value={l}>
                                  {j + 1}. {l}
                                </option>
                              ))}
                          </select>
                          <textarea
                            aria-label={`Povezani prijevod ${i + 1}`}
                            value={c.en}
                            onChange={(e) => edit(c.id, { en: e.target.value })}
                          />
                        </label>
                      ))}
                  </details>
                  <div className="export-subs">
                    Preuzmi {lang.toUpperCase()} titlove{" "}
                    {["srt", "lrc", "vtt"].map((f) => (
                      <button
                        key={f}
                        disabled={!cues.length}
                        onClick={() => exportSubs(f)}
                      >
                        {f.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {tab === "izgled" && (
                <>
                  <h2>Vaš vizualni potpis</h2>
                  <p className="muted">Stil, kadar i pozadina vašeg videa.</p>
                  <label>
                    Omjer videa
                    <select
                      value={look.ratio}
                      onChange={(e) => update({ ratio: e.target.value })}
                    >
                      <option>16:9</option>
                      <option>9:16</option>
                      <option>1:1</option>
                    </select>
                  </label>
                  <div className="preset-grid">
                    {presets.map((p) => (
                      <button
                        key={p}
                        className={look.preset === p ? "chosen" : ""}
                        onClick={() => update(preset(p))}
                      >
                        <span>Aa</span>
                        {p}
                      </button>
                    ))}
                  </div>
                  {look.preset === "Karaoke" && (
                    <p className="notice">
                      Isticanje je aproksimacija kroz trajanje retka, nije
                      precizno po riječima.
                    </p>
                  )}
                  <label>
                    Font
                    <select
                      value={look.font}
                      onChange={(e) => update({ font: e.target.value })}
                    >
                      {[
                        "Arial",
                        "Georgia",
                        "Verdana",
                        "Times New Roman",
                        "Courier New",
                      ].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  {range("Veličina teksta", "size", 20, 100)}
                  {range("Položaj teksta (%)", "position", 10, 90)}
                  <label>
                    Boja teksta
                    <input
                      type="color"
                      value={look.color}
                      onChange={(e) => update({ color: e.target.value })}
                    />
                  </label>
                  <label>
                    Najviše redaka
                    <select
                      value={look.lines}
                      onChange={(e) =>
                        update({ lines: Number(e.target.value) })
                      }
                    >
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </label>
                  {(
                    [
                      ["bold", "Podebljanje"],
                      ["shadow", "Sjena"],
                      ["outline", "Obrub"],
                      ["animation", "Pojavljivanje i nestajanje"],
                      ["title", "Naziv pjesme na početku"],
                      ["logo", "Logo Slušalica AI"],
                      ["gradient", "Gradijent pozadine"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="check" key={key}>
                      <input
                        type="checkbox"
                        checked={look[key]}
                        onChange={(e) => update({ [key]: e.target.checked })}
                      />
                      {label}
                    </label>
                  ))}
                  <div className="color-row">
                    <label>
                      Pozadina
                      <input
                        type="color"
                        value={look.bg}
                        onChange={(e) => update({ bg: e.target.value })}
                      />
                    </label>
                    <label>
                      Druga boja
                      <input
                        type="color"
                        value={look.bg2}
                        onChange={(e) => update({ bg2: e.target.value })}
                      />
                    </label>
                  </div>
                  {upload(
                    "image/jpeg,image/png,image/webp,video/mp4",
                    (f) => void loadBackground(f).catch(notify),
                    <>
                      <Upload size={18} />{" "}
                      {background
                        ? "Zamijeni pozadinu"
                        : "Dodaj sliku ili MP4 pozadinu"}
                    </>,
                  )}
                  {background && (
                    <button onClick={() => void loadBackground(undefined)}>
                      Ukloni pozadinu
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const key = `Stil ${custom.length + 1}`;
                      localStorage.setItem(key, JSON.stringify(look));
                      const list = [...custom, key];
                      localStorage.setItem(
                        "slusalica-styles",
                        JSON.stringify(list),
                      );
                      setCustom(list);
                      setMessage("Vlastiti stil spremljen.");
                    }}
                  >
                    <Save size={16} /> Spremi vlastiti stil
                  </button>
                  {custom.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        try {
                          setLook({
                            ...initial,
                            ...JSON.parse(localStorage.getItem(s) || "{}"),
                          });
                        } catch (e) {
                          notify(e);
                        }
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </>
              )}
              {tab === "zvuk" && (
                <>
                  <h2>Glazba koju možete vidjeti</h2>
                  <p className="muted">
                    Vizualizator koristi stvarni audio signal. Pokrenite pjesmu
                    za pregled.
                  </p>
                  <label>
                    Vrsta
                    <select
                      value={look.visualizer}
                      onChange={(e) => update({ visualizer: e.target.value })}
                    >
                      <option value="none">Isključeno</option>
                      <option value="wave">Waveform</option>
                      <option value="bars">Audio bars</option>
                      <option value="circle">Circular visualizer</option>
                      <option value="pulse">Pulsirajuće linije</option>
                    </select>
                  </label>
                  <label>
                    Boja
                    <input
                      type="color"
                      value={look.visColor}
                      onChange={(e) => update({ visColor: e.target.value })}
                    />
                  </label>
                  {range("Veličina", "visSize", 5, 90)}
                  {range("Položaj (%)", "visPosition", 20, 95)}
                </>
              )}
              {tab === "ai" && (
                <>
                  <span className="beta">LOKALNI WHISPER</span>
                  <h2>Od zvuka do stihova</h2>
                  <p className="muted">
                    Besplatan Whisper tiny radi na vašem uređaju. Model se
                    preuzima s Hugging Facea; pjesma se ne šalje. Točnost kod
                    pjevanja i hrvatskog može biti ograničena.
                  </p>
                  <label>
                    Jezik audija
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as "hr" | "en")}
                    >
                      <option value="hr">Hrvatski</option>
                      <option value="en">Engleski</option>
                    </select>
                  </label>
                  <label>
                    Način obrade
                    <select id="ai-device" defaultValue="wasm">
                      <option value="wasm">
                        CPU / WASM (sporije, šira podrška)
                      </option>
                      <option value="webgpu" disabled={!("gpu" in navigator)}>
                        WebGPU {!("gpu" in navigator) && "— nije dostupan"}
                      </option>
                    </select>
                  </label>
                  <label>
                    Originalni tekst (neobavezno)
                    <textarea
                      rows={7}
                      value={original}
                      onChange={(e) => setOriginal(e.target.value)}
                      placeholder="Jedan stih po retku"
                    />
                  </label>
                  <p className="notice">
                    Izvorni tekst zamjenjuje AI retke samo kada se broj redaka
                    podudara. To nije prisilno vremensko usklađivanje. Uvijek
                    ručno provjerite vremena.
                  </p>
                  <button
                    className="primary"
                    disabled={!audioBlob}
                    onClick={transcribe}
                  >
                    <Sparkles size={16} /> Prepoznaj tekst lokalno
                  </button>
                </>
              )}
              {tab === "projekti" && (
                <>
                  <h2>Vaši projekti</h2>
                  <p className="muted">
                    Projekti i mediji čuvaju se u IndexedDB-u ovog preglednika.
                    Izvezite sigurnosnu kopiju prije brisanja podataka
                    preglednika.
                  </p>
                  <button onClick={saveProject}>
                    <Save size={16} /> Spremi trenutačni projekt
                  </button>
                  <button onClick={pack}>
                    <Download size={16} /> Izvezi cijeli projekt s medijima
                  </button>
                  {upload(
                    ".json",
                    (f) => void unpack(f),
                    <>
                      <FolderOpen size={18} /> Uvezi projekt
                    </>,
                  )}
                  {saved.map((s) => (
                    <div className="saved-row" key={s}>
                      <span>{s}</span>
                      <button
                        onClick={async () => {
                          try {
                            const d = await db();
                            await restore(await d.get("projects", s));
                          } catch (e) {
                            notify(e);
                          }
                        }}
                      >
                        Otvori
                      </button>
                      <button
                        aria-label={`Obriši projekt ${s}`}
                        onClick={async () => {
                          try {
                            const d = await db();
                            await d.delete("projects", s);
                            setSaved(
                              (await d.getAllKeys("projects")).map(String),
                            );
                          } catch (e) {
                            notify(e);
                          }
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {tab === "izvoz" && (
                <>
                  <h2>Spremno za vaš sljedeći hit</h2>
                  <p className="muted">
                    Video i zvuk snimaju se lokalno u stvarnom vremenu. Ne
                    zatvarajte i ne skrivajte karticu tijekom izvoza.
                  </p>
                  <label>
                    Jezik videa
                    <select
                      value={lang}
                      onChange={(e) => setLang(e.target.value as "hr" | "en")}
                    >
                      <option value="hr">Hrvatski</option>
                      <option value="en">Engleski</option>
                    </select>
                  </label>
                  <label>
                    Rezolucija
                    <select
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                    >
                      <option value="720">720p</option>
                      <option value="1080">1080p (zahtjevnije)</option>
                    </select>
                  </label>
                  <label>
                    Format
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                    >
                      <option value="webm">WebM</option>
                      <option value="mp4">
                        MP4 (ako ga preglednik podržava)
                      </option>
                    </select>
                  </label>
                  <button
                    className="primary full"
                    disabled={!audioBlob}
                    onClick={exportVideo}
                  >
                    <Film size={17} /> Generiraj {lang.toUpperCase()} video
                  </button>
                  <p className="notice">
                    Za drugu jezičnu verziju promijenite jezik i ponovite izvoz.
                    Na slabijim uređajima koristite 720p.
                  </p>
                  <details open>
                    <summary>MP4 preko lokalnog FFmpega</summary>
                    <p>
                      Ako preglednik ne podržava MP4, preuzmite WebM,
                      instalirajte besplatni FFmpeg na računalo i pokrenite:
                    </p>
                    <code>
                      ffmpeg -i video.webm -c:v libx264 -crf 18 -pix_fmt yuv420p
                      -c:a aac -b:a 192k -movflags +faststart video.mp4
                    </code>
                    <p>
                      Ova naredba stvarno pretvara video i audio; datoteke
                      ostaju na računalu.
                    </p>
                  </details>
                </>
              )}
            </fieldset>
            {busy && (
              <div className="processing">
                <LoaderCircle className="spin" size={20} />
                <span>
                  {Math.round(progress)}% ·{" "}
                  {recording.current ? "Izvoz videa" : "Lokalna AI obrada"}
                </span>
                <progress value={progress} max="100" />
                <button
                  onClick={() => {
                    if (recording.current) recorder.current?.stop();
                    else {
                      worker.current?.terminate();
                      setBusy(false);
                      setMessage("AI obrada prekinuta.");
                    }
                  }}
                >
                  Prekini
                </button>
              </div>
            )}
          </section>
          <section className="preview-column">
            <div className="preview card">
              <div className="preview-heading">
                <span>
                  <Monitor size={16} /> Pregled uživo
                </span>
                <span className="preview-tag">
                  {look.ratio} <span>•</span> {lang.toUpperCase()}
                </span>
              </div>
              <div
                className="canvas-wrap"
                style={{ aspectRatio: look.ratio.replace(":", " / ") }}
              >
                <canvas ref={canvas} />
                {!audioBlob && (
                  <div className="preview-empty">
                    <div className="disc">
                      <Headphones size={40} />
                    </div>
                    <span>VAŠA POZORNICA ČEKA</span>
                    <h2>Svaki stih zaslužuje kadar.</h2>
                    <p>Učitajte pjesmu. Dodajte tekst. Stvorite nešto svoje.</p>
                  </div>
                )}
              </div>
              <div className="transport">
                <button
                  className="play-button"
                  disabled={!audioUrl || busy}
                  onClick={toggle}
                  aria-label={playing ? "Pauza" : "Reproduciraj"}
                >
                  {playing ? (
                    <Pause size={19} />
                  ) : (
                    <Play size={19} fill="currentColor" />
                  )}
                </button>
                <span>
                  {fmt(time)} <span className="muted">/ {fmt(duration)}</span>
                </span>
                <input
                  type="range"
                  aria-label="Premotavanje"
                  min="0"
                  max={duration || 1}
                  step="0.01"
                  value={time}
                  disabled={busy}
                  onChange={(e) => seek(Number(e.target.value))}
                />
                <button
                  disabled={busy}
                  onClick={() => setLang((l) => (l === "hr" ? "en" : "hr"))}
                  className="lang-toggle"
                >
                  {lang.toUpperCase()}
                </button>
              </div>
            </div>
            <div className="timeline card">
              <div className="section-title">
                <h3>
                  <AudioLines size={17} /> Vremenska traka
                </h3>
                <span>{duration ? fmt(duration) : "00:00"}</span>
              </div>
              <div className="timeline-ruler">
                <span>00:00</span>
                <span>{fmt(duration / 4)}</span>
                <span>{fmt(duration / 2)}</span>
                <span>{fmt(duration * 0.75)}</span>
                <span>{fmt(duration)}</span>
              </div>
              <div
                className="waveform"
                role="slider"
                tabIndex={0}
                aria-label="Vremenska traka pjesme"
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={time}
                onKeyDown={(e) => {
                  if (e.key === "ArrowRight") seek(time + 1);
                  if (e.key === "ArrowLeft") seek(time - 1);
                }}
                onClick={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  seek(((e.clientX - r.left) / r.width) * duration);
                }}
              >
                {(waveform.length
                  ? waveform
                  : Array.from({ length: 160 }, () => 0.025)
                ).map((v, i) => (
                  <i
                    key={i}
                    style={{
                      height: `${Math.max(3, v * 100)}%`,
                      background:
                        i / 160 <= time / (duration || 1)
                          ? "#d77abb"
                          : undefined,
                    }}
                  />
                ))}
                <div
                  className="playhead"
                  style={{ left: `${(time / (duration || 1)) * 100}%` }}
                />
              </div>
              <div className="cue-track">
                {cues.map((c) => (
                  <button
                    key={c.id}
                    title={c[lang]}
                    disabled={busy}
                    style={{
                      left: `${(c.start / (duration || 180)) * 100}%`,
                      width: `${Math.max(0.5, ((c.end - c.start) / (duration || 180)) * 100)}%`,
                    }}
                    onClick={() => seek(c.start)}
                  >
                    {c[lang] || "…"}
                  </button>
                ))}
              </div>
              <p className="timeline-hint">
                Kliknite valni oblik ili stih za premotavanje.
              </p>
            </div>
            <div className="tip">
              <Sparkles size={18} />
              <div>
                <strong>Vaša kreativnost. Bez pretplate.</strong>
                <p>Od prve ideje do gotovog videa — sve u vašem pregledniku.</p>
              </div>
            </div>
            {result && (
              <div className="card result">
                <h3>Pregled izvezenog videa</h3>
                <video src={result} controls />
                <a
                  className="button primary"
                  href={result}
                  download={resultName}
                >
                  <Download size={16} /> Preuzmi video
                </a>
              </div>
            )}
          </section>
        </div>
        <footer role="status">
          <span className="status-dot" />
          {message}
        </footer>
        <audio
          ref={audio}
          src={audioUrl || undefined}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration))
              setDuration(e.currentTarget.duration);
          }}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            if (recording.current) recorder.current?.stop();
            if (media.current instanceof HTMLVideoElement)
              media.current.pause();
          }}
          onError={() =>
            setMessage("Audio format nije podržan u ovom pregledniku.")
          }
        />
      </main>
    </div>
  );
  function range(
    label: string,
    key: "size" | "position" | "visSize" | "visPosition",
    min: number,
    max: number,
  ) {
    return (
      <label>
        {label}
        <span className="range-value">{look[key]}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={look[key]}
          onChange={(e) => update({ [key]: Number(e.target.value) })}
        />
      </label>
    );
  }
}
createRoot(document.getElementById("root")!).render(<App />);
