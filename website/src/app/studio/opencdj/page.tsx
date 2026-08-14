import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryblokServerRichText } from "@storyblok/react/rsc";
import type { StoryblokRichTextNode } from "@storyblok/react/rsc";
import { fetchStory } from "@/lib/storyblok";
import { getStudioSession } from "@/lib/studio-session";
import type { OpencdjConfigStoryContent } from "@/lib/types";
import { OpencdjTypewriter } from "./OpencdjTypewriter";
import { OpencdjForm } from "./OpencdjForm";
import { OpencdjLoginGate } from "./OpencdjLoginGate";

async function getConfig(): Promise<OpencdjConfigStoryContent> {
  const story = await fetchStory<OpencdjConfigStoryContent>("opencdj-config");
  if (!story) notFound();
  return story.content;
}

export async function generateMetadata(): Promise<Metadata> {
  const config = await getConfig();
  return {
    title: `${config.headline} · bit-lab`,
    description: config.description,
  };
}

export default async function OpencdjPage() {
  const session = await getStudioSession();
  if (!session) {
    return <OpencdjLoginGate returnTo="/opencdj" />;
  }

  const config = await getConfig();

  return (
    <div className="opencdj-page">
      {/* ── Hero ── */}
      <section className="hero">
        <div className="heroBg">
          {(config.hero_video_mp4?.filename || config.hero_video_webm?.filename) && (
            <video className="heroVideo" autoPlay muted loop playsInline>
              {config.hero_video_webm?.filename && (
                <source src={config.hero_video_webm.filename} type="video/webm" />
              )}
              {config.hero_video_mp4?.filename && (
                <source src={config.hero_video_mp4.filename} type="video/mp4" />
              )}
            </video>
          )}
          <div className="heroOverlay" />
        </div>

        <svg
          className="bgTriangle"
          viewBox="0 0 200 178"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path d="M100 6L194 172H6L100 6Z" stroke="#00ff41" strokeWidth="0.6" />
          <path
            d="M100 30L178 166H22L100 30Z"
            stroke="#00ff41"
            strokeWidth="0.3"
            strokeDasharray="3 6"
          />
          <circle cx="100" cy="126" r="20" stroke="#00ff41" strokeWidth="0.6" />
          <circle cx="100" cy="126" r="5" fill="rgba(0,255,65,0.2)" />
          <ellipse cx="100" cy="126" rx="12" ry="7" stroke="#00ff41" strokeWidth="0.4" />
          <line
            x1="100"
            y1="106"
            x2="100"
            y2="84"
            stroke="#00ff41"
            strokeWidth="0.4"
            strokeDasharray="2 3"
          />
        </svg>

        <div className="heroBadge">[ FREQUÊNCIA RESTRITA // ORDEM OCULTA ]</div>

        <div className="heroContent">
          {config.logo?.filename && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={config.logo.filename} alt="OpenCDJ" className="heroLogo" />
          )}
          <OpencdjTypewriter text={config.subheadline} />
          <a href="#form" className="heroCta">
            <span className="ctaArrow">▶</span> {config.submit_text}
          </a>
        </div>

        <div className="heroStatusBar">
          <span className="statusDot">◉</span>
          <span>SYS.ONLINE</span>
          <span className="statusSep">//</span>
          <span>ACESSO.RESTRITO</span>
          <span className="statusSep">//</span>
          <span>NODE.33</span>
          <span className="statusSep">//</span>
          <span>△</span>
        </div>

        <div className="scrollIndicator">
          <span />
        </div>
      </section>

      <div className="divider" aria-hidden="true">
        <span>──────────────</span>
        <span className="dividerSymbol"> △ </span>
        <span>──────────────</span>
      </div>

      {/* ── Form Section ── */}
      <section id="form" className="formSection">
        <div className="formContainer">
          <span className="corner" data-pos="tl" />
          <span className="corner" data-pos="tr" />
          <span className="corner" data-pos="bl" />
          <span className="corner" data-pos="br" />

          <div className="formIntro">
            <div className="sectionTag">// 01 · MANIFESTO</div>
            <h1 className="headline">{config.headline}</h1>
            <p className="description">{config.description}</p>
            <div className="markdownBody">
              <StoryblokServerRichText
                doc={config.manifesto as StoryblokRichTextNode<React.ReactElement>}
              />
            </div>
          </div>

          <div className="sectionTag">// 02 · INSCRIÇÃO</div>

          <OpencdjForm
            nameLabel={config.name_label}
            namePlaceholder={config.name_placeholder}
            contactLabel={config.contact_label}
            contactPlaceholder={config.contact_placeholder}
            genreLabel={config.genre_label}
            genrePlaceholder={config.genre_placeholder}
            submitText={config.submit_text}
            successMessage={config.success_message}
          />
        </div>
      </section>

      <footer className="footer">
        <div className="footerDivider" aria-hidden="true">
          △ △ △
        </div>
        <div className="footerRow">
          <a href="mailto:rz@bit-lab.tech" className="footerEmail">
            rz@bit-lab.tech
          </a>
          <span className="footerSep">//</span>
          <span className="footerCopy">© {new Date().getFullYear()} BIT LAB</span>
        </div>
        <div className="footerCode" aria-hidden="true">
          01001111 01010010 01000100 01000101 01001101
        </div>
      </footer>
    </div>
  );
}
