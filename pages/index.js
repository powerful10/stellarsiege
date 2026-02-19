import Head from "next/head";

export default function Home() {
  return (
    <>
      <Head>
        <title>Stellar Siege - Browser Space Shooter</title>
        <meta
          name="description"
          content="Stellar Siege is a browser roguelite shooter with Survival, Campaign, and Online Duel modes, persistent upgrades, and account-backed progression."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://stellarsiege.vercel.app/" />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5266296505652960"
          crossOrigin="anonymous"
        />
      </Head>

      <main className="page">
        <header className="hero">
          <p className="tag">Stellar Siege</p>
          <h1>Roguelite Arena Shooter In Your Browser</h1>
          <p className="lead">
            Fight escalating waves, build your ship with permanent upgrades, and switch between Survival, Campaign, and
            Online Duel without installing any app.
          </p>
          <div className="actions">
            <a className="btn btnPrimary" href="/game/survival/start">
              Play Survival
            </a>
            <a className="btn" href="/game/campaign/start">
              Start Campaign
            </a>
            <a className="btn" href="/game/onlinematch/start">
              Open Online
            </a>
            <a className="btn" href="/game/hangar">
              Open Loadout
            </a>
            <a className="btn" href="/game/index.html">
              Game Menu
            </a>
            <a className="btn" href="/game/info.html">
              Full Game Guide
            </a>
            <a className="btn" href="/game/leaderboard">
              Leaderboard
            </a>
          </div>
        </header>

        <section className="card">
          <h2>Why This Game Is Different</h2>
          <p>
            Stellar Siege combines fast arena combat with long-term progression. Your run decisions matter in the moment,
            while your account upgrades shape future runs. Instead of repeating one fixed pattern, enemy pressure changes
            with wave pacing, mission objectives, and build choices.
          </p>
          <p>
            The result is a short-session game that still has depth: players can jump in for five minutes, or spend longer
            optimizing routes, ship setups, and risk-reward choices.
          </p>
        </section>

        <section className="grid">
          <article className="card">
            <h3>Survival Mode</h3>
            <p>
              Endless wave combat with scaling intensity. Prioritize dodging, target control, and efficient upgrade paths
              to push your personal best score.
            </p>
          </article>
          <article className="card">
            <h3>Campaign Mode</h3>
            <p>
              Structured missions with goals beyond raw score. Campaign unlocks teach positioning, timing, and resource
              planning under pressure.
            </p>
          </article>
          <article className="card">
            <h3>Online Duel</h3>
            <p>
              Competitive one-on-one matches with room codes. Win condition is simple: deplete the opponent hull first.
            </p>
          </article>
        </section>

        <section className="card">
          <h2>Progression And Economy</h2>
          <ul>
            <li>Credits are earned through gameplay and used for core upgrades.</li>
            <li>Crystals unlock premium ships and higher tier progression paths.</li>
            <li>XP increases pilot level and improves long-term effectiveness.</li>
            <li>Account sync keeps progression available across sessions.</li>
          </ul>
        </section>

        <section className="card">
          <h2>Player Experience Goals</h2>
          <ul>
            <li>Responsive controls on desktop and mobile browsers.</li>
            <li>Readable HUD with clear combat information.</li>
            <li>Stable gameplay loop with meaningful build decisions.</li>
            <li>Transparent rules for rewards, progression, and online play.</li>
          </ul>
        </section>

        <footer className="footer">
          <a href="/game/survival/start">Play</a>
          <a href="/game/campaign/start">Campaign</a>
          <a href="/game/onlinematch/start">Online</a>
          <a href="/game/hangar">Loadout</a>
          <a href="/game/info.html">Guide</a>
          <a href="/privacy.html">Privacy</a>
          <a href="/terms.html">Terms</a>
          <a href="/sitemap.xml">Sitemap</a>
        </footer>
      </main>

      <style jsx>{`
        .page {
          max-width: 980px;
          margin: 0 auto;
          padding: 24px 16px 40px;
          color: #e8edf7;
          background: radial-gradient(circle at top left, #1b2a4a 0%, #0a1022 52%, #060b17 100%);
          min-height: 100vh;
          font-family: "Segoe UI", Tahoma, sans-serif;
        }
        .hero {
          background: rgba(8, 16, 34, 0.86);
          border: 1px solid #2a3f6f;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 16px;
        }
        .tag {
          display: inline-block;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #8cc2ff;
          margin: 0 0 8px;
        }
        h1 {
          margin: 0 0 10px;
          font-size: 34px;
          line-height: 1.15;
        }
        .lead {
          margin: 0;
          color: #b7c8e8;
          line-height: 1.6;
        }
        .actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 16px;
        }
        .btn {
          display: inline-block;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid #375897;
          color: #d8e6ff;
          text-decoration: none;
          font-weight: 700;
          background: #111d39;
        }
        .btnPrimary {
          background: #ffd166;
          color: #2a1f08;
          border-color: #ffd166;
        }
        .card {
          background: rgba(7, 14, 30, 0.86);
          border: 1px solid #243b69;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 12px;
        }
        h2,
        h3 {
          margin-top: 0;
          margin-bottom: 10px;
        }
        p,
        li {
          color: #bfd0ed;
          line-height: 1.6;
        }
        ul {
          margin: 0;
          padding-left: 18px;
        }
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
        }
        .footer {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-top: 10px;
          padding: 8px 2px;
        }
        .footer a {
          color: #91c3ff;
          text-decoration: none;
        }
      `}</style>
    </>
  );
}
