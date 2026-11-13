/** The product's name. Change it here and it changes everywhere. */
export const PRODUCT_NAME = 'TaxPilot';

/** Planned price per filed return, in dollars. Nothing is charged in demo mode. */
export const FILING_FEE = 50;

/**
 * True until the software is certified by CRA for T2 Corporation Internet Filing.
 * While true, the filing step is a labelled simulation and sends nothing anywhere.
 */
export const DEMO_FILING = true;

/** One line under the name on the splash and welcome screens. */
export const TAGLINE = 'Corporate tax returns for small businesses';

/**
 * Photo on the welcome screen. Free to use under the Unsplash licence and loaded from
 * Unsplash's image server; swap `src` for a file in /public to host it ourselves.
 */
export const WELCOME_IMAGE = {
  src: 'https://images.unsplash.com/photo-1590649917466-06e6e1c3e92d?auto=format&fit=crop&w=1400&q=75',
  alt: 'Two colleagues smiling as they go over figures together on a laptop',
};
