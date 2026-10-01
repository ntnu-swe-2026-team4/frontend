import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import lottie from "lottie-web/build/player/lottie_canvas";
import type { AnimationItem } from "lottie-web";
import { api, type Role } from "@/api";
import { keys } from "@/api/queries";
import "./landing.css";

/** 進場動畫：元素第一次捲進畫面時加上 is-visible（樣式在 landing.css） */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } }), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

/** 標題拆成一個字一個字，滑鼠靠近時會微微跳起來 */
function LogoTitle({ text }: { text: string }) {
  const chars = [...text];
  const ref = useRef<HTMLHeadingElement>(null);
  const move = (e: React.MouseEvent) => {
    ref.current?.querySelectorAll<HTMLElement>(".char").forEach((span) => {
      const r = span.getBoundingClientRect();
      const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
      const k = Math.max(0, 1 - d / 90);
      span.style.transform = k > 0 ? `translateY(${-k * 10}px) scale(${1 + k * 0.18})` : "";
    });
  };
  const leave = () => ref.current?.querySelectorAll<HTMLElement>(".char").forEach((s) => { s.style.transform = ""; });
  return (
    <h1 className="logo-title" ref={ref} onMouseMove={move} onMouseLeave={leave}>
      {chars.map((ch, i) => <span key={i} className="char" style={{ ["--i" as string]: i }}>{ch === " " ? "\u00A0" : ch}</span>)}
    </h1>
  );
}

/**
 * 一格 Lottie 動畫：靠近畫面才載入、離開畫面就暫停、點一下從頭播、滑鼠移動有視差與傾斜。
 * 動畫檔在 public/landing/landing-N.json（每個 1–3 MB，所以用延遲載入）。
 */
function LandJson({ n, className }: { n: number; className: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const anim = useRef<AnimationItem | null>(null);
  const reveal = useReveal<HTMLDivElement>();

  useEffect(() => {
    const el = box.current!;
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) {
        if (!anim.current) {
          anim.current = lottie.loadAnimation({
            container: inner.current!, renderer: "canvas", loop: true, autoplay: false,
            path: `/landing/landing-${n}.json`, rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
          });
        }
        anim.current.play();
      } else anim.current?.pause();
    }), { rootMargin: "200px 0px", threshold: 0 });
    io.observe(el);
    return () => { io.disconnect(); anim.current?.destroy(); anim.current = null; };
  }, [n]);

  const onMove = (e: React.MouseEvent) => {
    const r = box.current!.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
    inner.current!.style.transform = `translate(${-nx * 44}px, ${-ny * 44}px)`;
    box.current!.style.transform = `perspective(800px) rotateX(${-ny * 6}deg) rotateY(${nx * 6}deg)`;
  };
  const onLeave = () => { inner.current!.style.transform = "translate(0,0)"; box.current!.style.transform = ""; };

  return (
    <div ref={(el) => { box.current = el; reveal.current = el; }} className={`land-json ${className}`} onClick={() => anim.current?.goToAndPlay(0, true)} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div ref={inner} className="land-json-inner" />
    </div>
  );
}

function Word({ className, children, standalone }: { className?: string; children: ReactNode; standalone?: boolean }) {
  const ref = useReveal<HTMLDivElement>();
  return <div ref={ref} className={`land-word ${standalone ? "land-word-standalone" : ""} ${className ?? ""}`}>{children}</div>;
}

const ICON_STUDENT = <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4L3 8.5 12 13l9-4.5L12 4Z" /><path d="M6.5 10.6V15c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.4" /></svg>;
const ICON_TEACHER = <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5C6 4.4 8.4 4 12 4.9V19c-3.6-.9-6-.5-8 .6z" /><path d="M20 5.5C18 4.4 15.6 4 12 4.9V19c3.6-.9 6-.5 8 .6z" /></svg>;

export function LandingPage() {
  const scroller = useRef<HTMLDivElement>(null);
  const logo = useReveal<HTMLDivElement>();
  const [role, setRole] = useState<Role | null>(null);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function enter() {
    if (!role) return;
    setBusy(true);
    try {
      const user = await api.login({ role, name: "" });
      qc.setQueryData(keys.me, user);
      navigate({ to: "/" });
    } finally { setBusy(false); }
  }

  return (
    <div className="landing-root" id="site-scroll" ref={scroller}>
      <div id="top-nav">
        <button className="top-nav-btn" title="Back to top" onClick={() => scroller.current?.scrollTo({ top: 0, behavior: "smooth" })}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg><span>Top</span>
        </button>
        <button className="top-nav-btn" title="Go to login" onClick={() => document.getElementById("login-screen")?.scrollIntoView({ behavior: "smooth" })}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg><span>Login</span>
        </button>
      </div>

      <section className="land-hero" id="land-hero">
        <div className="land-logo" ref={logo}>
          <div className="logo-mark">Σ</div>
          <LogoTitle text="Socratic Dialogue Classroom" />
          <p className="logo-sub">think out loud. never told the answer.</p>
          <div className="logo-cue"><span>scroll</span><svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></div>
        </div>
      </section>

      <section className="land-group" id="land-group-1"><div className="land-cluster">
        <LandJson n={1} className="is-primary pos-p1" /><LandJson n={2} className="is-secondary pos-s1" />
        <Word className="pos-w1">一群工程師，在漫長的開發之中，重新喚醒了一個活在兩千四百年前的靈魂。</Word>
      </div></section>

      <section className="land-group" id="land-group-2">
        <div className="land-cluster">
          <LandJson n={3} className="is-primary pos-p2" /><LandJson n={4} className="is-secondary pos-s2" />
          <Word className="pos-w2">消息傳開之後，人們趨之若鶩——每個人都渴望，能和這位「希臘三哲」對話。</Word>
        </div>
        <Word standalone>他從不直接給答案。</Word>
      </section>

      <section className="land-group" id="land-group-3"><div className="land-cluster">
        <LandJson n={5} className="is-primary pos-p3" /><LandJson n={6} className="is-secondary pos-s3" />
        <Word className="pos-w3">蘇格拉底接受了每一個問題——</Word>
      </div></section>

      <section className="land-group" id="land-group-4"><div className="land-cluster">
        <LandJson n={7} className="is-primary pos-p4" /><LandJson n={8} className="is-secondary pos-s4" />
        <Word className="pos-w4">但他從不直接回答，只用一個又一個提問，領著你走向自己的答案。</Word>
      </div></section>

      <div id="login-screen"><div className="login-wrap"><div className="login-card login-card-split">
        <div className="login-card-left">
          <div className="mark">Σ</div>
          <h1>詰問 · 蘇格拉底對話教室</h1>
          <p className="sub">在開始之前，先告訴我們你的身份。<br />教師可以指派議題、管理教室；學生則直接進入與蘇格拉底的對話。</p>
          <div className="role-options">
            {([["student", "學生", "進入對話教室，練習提問與論證", ICON_STUDENT], ["teacher", "教師", "管理議題、教室與學生名單", ICON_TEACHER]] as const).map(([r, t, d, icon]) => (
              <div key={r} className={`role-card${role === r ? " selected" : ""}`} onClick={() => setRole(r)} role="button" tabIndex={0} aria-pressed={role === r}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setRole(r)}>
                {icon}<span className="rc-title">{t}</span><span className="rc-desc">{d}</span>
              </div>
            ))}
          </div>
          <button className="pill-btn primary" id="btn-enter" disabled={!role || busy} onClick={enter}>進入教室</button>
        </div>
        <div className="login-card-divider" />
        <div className="login-card-right">
          <div className="auth-tabs">
            <button className={`auth-tab${tab === "login" ? " active" : ""}`} type="button" onClick={() => setTab("login")}>登入</button>
            <button className={`auth-tab${tab === "signup" ? " active" : ""}`} type="button" onClick={() => setTab("signup")}>註冊帳號</button>
          </div>
          {tab === "login" ? (
            <form className="auth-form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
              <div className="field"><label>帳號 / Email</label><input type="text" placeholder="you@example.com" /></div>
              <div className="field"><label>密碼</label><input type="password" placeholder="••••••••" /></div>
              <a className="auth-forgot" href="#" onClick={(e) => e.preventDefault()}>忘記密碼？</a>
              <button className="pill-btn primary full" type="button">登入</button>
            </form>
          ) : (
            <form className="auth-form" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
              <div className="field"><label>姓名</label><input type="text" placeholder="王小明" /></div>
              <div className="field"><label>帳號 / Email</label><input type="text" placeholder="you@example.com" /></div>
              <div className="field"><label>密碼</label><input type="password" placeholder="設定一組密碼" /></div>
              <button className="pill-btn primary full" type="button">建立帳號</button>
            </form>
          )}
          <p className="auth-note">＊ 這裡目前只是前端畫面，還沒有接真正的帳號驗證。</p>
        </div>
      </div></div></div>
    </div>
  );
}
