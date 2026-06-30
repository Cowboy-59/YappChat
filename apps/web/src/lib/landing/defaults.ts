import type { LandingConfig } from "./config-schema";

/**
 * First-launch defaults (FR-008). Seeded on first deploy; admins override via
 * spec 013's LandingPageConfigPanel. Also the static fallback when no DB row
 * exists yet or the DB is unreachable, so the page always renders.
 */
export const DEFAULT_LANDING_CONFIG: LandingConfig = {
  branding: {
    companyname: "YappChatt",
    logourl: "",
    heroheadline: "Every conversation. One private AI.",
    herosubheadline:
      "YappChatt unifies your chat channels, personal assistant, video, and AI tooling — while your data stays on your machine.",
    primarycolor: "#4f46e5",
    accentcolor: "#06b6d4",
    contactemail: "hello@yappchat.app",
    githuburl: "https://github.com/yappchat",
    termsurl: "",
    privacyurl: "",
  },
  seo: {
    title: "YappChatt — Your private, unified AI chat",
    description:
      "Unify your messaging channels with a private AI gateway. Personal assistant, video, agent studio, and document generation — with your data on your machine.",
    keywords: [
      "AI chat",
      "private AI",
      "unified messaging",
      "personal assistant",
      "self-hosted",
      "end-to-end encryption",
    ],
    canonicalurl: "",
    ogimageurl: "",
    twitterhandle: "@yappchat",
    disallowindexing: false,
  },
  plans: [
    {
      id: "individual",
      name: "Individual",
      displayprice: "$5/month",
      billinginterval: "billed yearly",
      features: [
        "Unified inbox across every channel",
        "Personal AI assistant",
        "AI chat with your choice of provider",
        "Document & media generation",
        "End-to-end encrypted, data on your machine",
      ],
      ctalabel: "Get started",
      ctapath: "/signup?plan=individual",
      highlighted: false,
    },
    {
      id: "corporate",
      name: "Corporate",
      displayprice: "$5/seat/month",
      billinginterval: "billed yearly",
      features: [
        "Everything in Individual",
        "Team workspaces & shared agents",
        "Admin console & branding",
        "Centralised billing",
        "Priority support",
      ],
      ctalabel: "Start a team",
      ctapath: "/signup?plan=corporate",
      highlighted: true,
    },
  ],
  features: [
    {
      id: "feature-chat",
      icon: "MessagesSquare",
      headline: "Unified chat",
      body: "One inbox for every channel — Slack, Discord, Telegram, WhatsApp, and 20 more.",
    },
    {
      id: "feature-pa",
      icon: "Bot",
      headline: "Personal assistant",
      body: "An assistant that consumes your registered channels and acts on your behalf.",
    },
    {
      id: "feature-video",
      icon: "Video",
      headline: "Video & calls",
      body: "Real-time voice and video over the same private WebSocket engine.",
    },
    {
      id: "feature-studio",
      icon: "Wrench",
      headline: "Agent & skill studio",
      body: "Build, test, and ship your own agents and skills without leaving the app.",
    },
    {
      id: "feature-ai",
      icon: "Sparkles",
      headline: "AI chat",
      body: "Chat with the model of your choice — calls go direct from your machine.",
    },
    {
      id: "feature-docs",
      icon: "FileText",
      headline: "Document & media generation",
      body: "Produce documents, images, and media from a single prompt.",
    },
    {
      id: "feature-avatar",
      icon: "UserRound",
      headline: "AI avatar",
      body: "An animated visual presence that brings your assistant to life.",
    },
    {
      id: "feature-download",
      icon: "Download",
      headline: "Downloadable for company internal use",
      body: "Download and run YappChatt entirely inside your company — self-hosted on your own infrastructure, no data leaving your network.",
      cta: { label: "Download for your company", href: "/signup?plan=corporate" },
    },
  ],
  security: {
    headline: "Your data stays on your machine.",
    bullets: [
      "Skills and agents execute locally — your prompts and files never transit our servers.",
      "AI provider calls go directly from your machine using your own keys.",
      "End-to-end encryption means the server only ever holds ciphertext it cannot read.",
    ],
  },
  faq: [
    {
      id: "what-is-yappchat",
      question: "What is YappChatt?",
      answer:
        "YappChatt is a private, unified AI gateway. It brings every messaging channel, a personal assistant, video, an agent studio, AI chat, document generation, and an AI avatar into one app — while keeping your data on your machine.",
    },
    {
      id: "where-is-my-data",
      question: "Where is my data stored?",
      answer:
        "On your machine. Skills run locally, AI calls go direct from your device, and anything synced is end-to-end encrypted so our servers only ever see ciphertext.",
    },
    {
      id: "which-plans",
      question: "What plans are available?",
      answer:
        "Two: Individual at $5/month (billed yearly) and Corporate at $5/seat/month (billed yearly). You can start either from the pricing section above.",
    },
    {
      id: "self-hosting",
      question: "Can I self-host YappChatt?",
      answer:
        "Yes. YappChatt is built to be self-hosted, and every deployment can brand this landing page with its own logo, colours, and copy.",
    },
    {
      id: "which-channels",
      question: "Which channels are supported?",
      answer:
        "Over 20 channels including Slack, Discord, Telegram, Matrix, WhatsApp, Microsoft Teams, Signal, and more, all from one unified inbox.",
    },
  ],
  testimonials: [],
  downloads: {
    ios: { available: false, url: "", comingsoonnote: "iOS app coming soon" },
    android: { available: false, url: "", comingsoonnote: "Android app coming soon" },
    desktop: { available: false, url: "", comingsoonnote: "Desktop app coming soon" },
  },
};
