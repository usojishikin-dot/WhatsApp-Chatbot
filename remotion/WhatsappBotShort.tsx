import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";

type WhatsappBotShortProps = {
  businessName: string;
  ownerPhone: string;
  market: string;
};

type Message = {
  from: "customer" | "bot";
  text: string;
};

const messages: Message[] = [
  { from: "customer", text: "How much is delivery?" },
  { from: "bot", text: "Delivery depends on your area. Please share your location." },
  { from: "customer", text: "I want to order today" },
  { from: "bot", text: "Got it. I have saved this as a lead." },
];

const dark = "#071512";
const green = "#25d366";
const lime = "#d7ff6b";
const cream = "#f7f5ea";
const ink = "#10201b";
const muted = "#719086";

export const WhatsappBotShort = ({
  businessName,
  ownerPhone,
  market,
}: WhatsappBotShortProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scene = Math.floor(frame / (fps * 4.5));
  const sceneFrame = frame - scene * fps * 4.5;

  return (
    <AbsoluteFill style={styles.stage}>
      <Backdrop />
      <Header businessName={businessName} market={market} />

      <Sequence from={0} durationInFrames={fps * 4.5}>
        <SceneIntro localFrame={sceneFrame} />
      </Sequence>

      <Sequence from={fps * 4.5} durationInFrames={fps * 4.5}>
        <SceneConversation localFrame={sceneFrame} />
      </Sequence>

      <Sequence from={fps * 9} durationInFrames={fps * 4.5}>
        <SceneLeads localFrame={sceneFrame} />
      </Sequence>

      <Sequence from={fps * 13.5} durationInFrames={fps * 4.5}>
        <SceneClose localFrame={sceneFrame} ownerPhone={ownerPhone} />
      </Sequence>
    </AbsoluteFill>
  );
};

const Backdrop = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 540], [-80, 80], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={styles.backdrop}>
      <div style={{ ...styles.grid, transform: `translateY(${drift}px)` }} />
      <div style={{ ...styles.glow, transform: `translate(${drift * 0.4}px, ${drift * -0.2}px)` }} />
    </AbsoluteFill>
  );
};

const Header = ({ businessName, market }: { businessName: string; market: string }) => {
  return (
    <div style={styles.header}>
      <div style={styles.logoMark}>W</div>
      <div>
        <div style={styles.headerName}>{businessName}</div>
        <div style={styles.headerSub}>{market}</div>
      </div>
    </div>
  );
};

const SceneIntro = ({ localFrame }: { localFrame: number }) => {
  const { fps } = useVideoConfig();
  const headline = reveal(localFrame, 0.1 * fps, 0.9 * fps);
  const phone = spring({ frame: localFrame - 12, fps, config: { damping: 16, stiffness: 110 } });

  return (
    <AbsoluteFill style={styles.scene}>
      <div style={{ ...styles.kicker, opacity: headline }}>Your WhatsApp inbox is already busy</div>
      <h1 style={{ ...styles.h1, opacity: headline, transform: `translateY(${(1 - headline) * 48}px)` }}>
        Turn repeated questions into instant replies.
      </h1>
      <PhoneMock scale={0.82 + phone * 0.18}>
        <ChatBubble from="customer" text="Are you open today?" delay={18} />
        <ChatBubble from="customer" text="Price please" delay={30} />
        <ChatBubble from="customer" text="Do you deliver?" delay={42} />
      </PhoneMock>
    </AbsoluteFill>
  );
};

const SceneConversation = ({ localFrame }: { localFrame: number }) => {
  const title = reveal(localFrame, 0, 18);

  return (
    <AbsoluteFill style={styles.scene}>
      <h2 style={{ ...styles.h2, opacity: title }}>AI answers. Keyword fallback keeps working.</h2>
      <PhoneMock scale={1}>
        {messages.map((message, index) => (
          <ChatBubble key={message.text} from={message.from} text={message.text} delay={index * 18 + 10} />
        ))}
      </PhoneMock>
    </AbsoluteFill>
  );
};

const SceneLeads = ({ localFrame }: { localFrame: number }) => {
  const { fps } = useVideoConfig();
  const panel = spring({ frame: localFrame - 8, fps, config: { damping: 18, stiffness: 120 } });
  const rows = ["+2347000000000", "How much is delivery?", "2026-05-02"];

  return (
    <AbsoluteFill style={styles.scene}>
      <h2 style={styles.h2}>Capture buyers while you sleep.</h2>
      <div style={{ ...styles.dashboard, transform: `scale(${0.9 + panel * 0.1})`, opacity: panel }}>
        <div style={styles.dashboardTop}>
          <span>New lead</span>
          <strong>Saved</strong>
        </div>
        {rows.map((row, index) => (
          <div
            key={row}
            style={{
              ...styles.leadRow,
              opacity: reveal(localFrame, index * 12 + 22, 18),
              transform: `translateX(${(1 - reveal(localFrame, index * 12 + 22, 18)) * 60}px)`,
            }}
          >
            {row}
          </div>
        ))}
      </div>
      <div style={styles.featureStrip}>
        <Feature label="SQLite" value="local records" />
        <Feature label="Sheets" value="webhook ready" />
        <Feature label="Handoff" value="human on request" />
      </div>
    </AbsoluteFill>
  );
};

const SceneClose = ({ localFrame, ownerPhone }: { localFrame: number; ownerPhone: string }) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: localFrame - 6, fps, config: { damping: 13, stiffness: 160 } });
  const fade = reveal(localFrame, 0, 20);

  return (
    <AbsoluteFill style={styles.closeScene}>
      <div style={{ ...styles.finalBadge, transform: `scale(${0.85 + pop * 0.15})` }}>WhatsApp FAQ + Lead Bot</div>
      <h2 style={{ ...styles.finalTitle, opacity: fade }}>Sell faster without watching every chat.</h2>
      <div style={styles.ctaPanel}>
        <div style={styles.ctaLine}>Configure one business JSON file.</div>
        <div style={styles.ctaLine}>Connect your WhatsApp webhook.</div>
        <div style={styles.ctaPhone}>{ownerPhone}</div>
      </div>
    </AbsoluteFill>
  );
};

const PhoneMock = ({ children, scale }: { children: ReactNode; scale: number }) => {
  return (
    <div style={{ ...styles.phone, transform: `scale(${scale})` }}>
      <div style={styles.phoneHeader}>
        <div style={styles.avatar}>A</div>
        <div>
          <div style={styles.chatName}>Ada Foods</div>
          <div style={styles.chatStatus}>online</div>
        </div>
      </div>
      <div style={styles.chatArea}>{children}</div>
    </div>
  );
};

const ChatBubble = ({ from, text, delay }: { from: Message["from"]; text: string; delay: number }) => {
  const frame = useCurrentFrame();
  const progress = reveal(frame, delay, 15);
  const isBot = from === "bot";

  return (
    <div
      style={{
        ...styles.bubble,
        ...(isBot ? styles.botBubble : styles.customerBubble),
        opacity: progress,
        transform: `translateY(${(1 - progress) * 28}px) scale(${0.96 + progress * 0.04})`,
      }}
    >
      {text}
    </div>
  );
};

const Feature = ({ label, value }: { label: string; value: string }) => (
  <div style={styles.feature}>
    <strong>{label}</strong>
    <span>{value}</span>
  </div>
);

const reveal = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const styles: Record<string, CSSProperties> = {
  stage: {
    backgroundColor: dark,
    color: cream,
    fontFamily: "Inter, Arial, sans-serif",
    overflow: "hidden",
  },
  backdrop: {
    background: `linear-gradient(160deg, ${dark} 0%, #0a241f 52%, #173029 100%)`,
  },
  grid: {
    position: "absolute",
    inset: -120,
    opacity: 0.18,
    backgroundImage:
      "linear-gradient(rgba(247,245,234,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(247,245,234,0.16) 1px, transparent 1px)",
    backgroundSize: "76px 76px",
  },
  glow: {
    position: "absolute",
    width: 900,
    height: 900,
    left: 360,
    top: 260,
    borderRadius: 900,
    background: "radial-gradient(circle, rgba(37,211,102,0.28), rgba(37,211,102,0) 64%)",
  },
  header: {
    position: "absolute",
    top: 72,
    left: 72,
    right: 72,
    zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: 22,
  },
  logoMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    background: green,
    color: dark,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    fontWeight: 900,
  },
  headerName: { fontSize: 30, fontWeight: 800 },
  headerSub: { fontSize: 22, color: "#a9c6bc", marginTop: 4 },
  scene: {
    padding: "190px 72px 88px",
    justifyContent: "space-between",
    alignItems: "center",
  },
  closeScene: {
    padding: "220px 72px 104px",
    justifyContent: "center",
    alignItems: "center",
    gap: 52,
  },
  kicker: {
    alignSelf: "flex-start",
    color: lime,
    fontSize: 34,
    fontWeight: 800,
    letterSpacing: 0,
  },
  h1: {
    margin: "36px 0 24px",
    fontSize: 92,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: 0,
    maxWidth: 920,
  },
  h2: {
    alignSelf: "flex-start",
    margin: "0 0 28px",
    fontSize: 66,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: 0,
    maxWidth: 900,
  },
  phone: {
    width: 650,
    height: 1010,
    borderRadius: 58,
    background: "#eef5ee",
    boxShadow: "0 38px 100px rgba(0,0,0,0.42)",
    border: "12px solid #12201c",
    overflow: "hidden",
    transformOrigin: "center bottom",
  },
  phoneHeader: {
    height: 118,
    background: "#075e54",
    display: "flex",
    alignItems: "center",
    gap: 20,
    padding: "24px 34px",
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 62,
    background: cream,
    color: "#075e54",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    fontWeight: 900,
  },
  chatName: { fontSize: 30, fontWeight: 850, color: cream },
  chatStatus: { fontSize: 22, color: "#cfe6de", marginTop: 4 },
  chatArea: {
    padding: "34px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },
  bubble: {
    maxWidth: 500,
    padding: "20px 24px",
    borderRadius: 26,
    fontSize: 29,
    lineHeight: 1.22,
    fontWeight: 700,
    color: ink,
  },
  customerBubble: {
    alignSelf: "flex-start",
    background: "#ffffff",
    borderTopLeftRadius: 6,
  },
  botBubble: {
    alignSelf: "flex-end",
    background: "#d9fdd3",
    borderTopRightRadius: 6,
  },
  dashboard: {
    width: 860,
    borderRadius: 34,
    background: cream,
    color: ink,
    padding: 34,
    boxShadow: "0 36px 90px rgba(0,0,0,0.34)",
  },
  dashboardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 34,
    fontWeight: 900,
    marginBottom: 22,
  },
  leadRow: {
    background: "#e8eee8",
    borderRadius: 18,
    padding: "24px 26px",
    marginTop: 16,
    fontSize: 30,
    fontWeight: 800,
    color: "#16352d",
  },
  featureStrip: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    width: "100%",
  },
  feature: {
    background: "rgba(247,245,234,0.1)",
    border: "1px solid rgba(247,245,234,0.18)",
    borderRadius: 20,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 22,
  },
  finalBadge: {
    background: green,
    color: dark,
    borderRadius: 30,
    padding: "22px 34px",
    fontSize: 34,
    fontWeight: 950,
  },
  finalTitle: {
    margin: 0,
    textAlign: "center",
    fontSize: 88,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: 0,
  },
  ctaPanel: {
    width: "100%",
    borderTop: "2px solid rgba(247,245,234,0.18)",
    paddingTop: 36,
    display: "flex",
    flexDirection: "column",
    gap: 20,
    alignItems: "center",
  },
  ctaLine: {
    fontSize: 34,
    fontWeight: 800,
    color: "#d9eee6",
  },
  ctaPhone: {
    marginTop: 12,
    color: lime,
    fontSize: 46,
    fontWeight: 950,
  },
};
