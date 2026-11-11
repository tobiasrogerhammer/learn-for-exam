/**
 * The Stage-Gate model as taught in PMF (lessons 2 and 3) and Cooper's
 * «Winning with New Products»: what happens in each stage and what is
 * decided at each gate. Keywords decide what counts as right when you write
 * a point yourself; a point matches when your text contains one of them.
 */

export type SlotKind = "stage" | "gate" | "review";

export type StageGatePoint = {
  text: string;
  keywords: string[];
};

export type StageGateSlot = {
  id: string;
  kind: SlotKind;
  label: string;
  title: string;
  /** The question the gate answers, from Cooper */
  question?: string;
  points: StageGatePoint[];
};

export const STAGE_GATE: StageGateSlot[] = [
  {
    id: "s0",
    kind: "stage",
    label: "Fase 0",
    title: "Idégenerering",
    points: [
      { text: "Market pull: ideer fra kundebehov og misfornøyde kunder", keywords: ["market pull", "kundebehov", "misfornøyd", "behov i markedet"] },
      { text: "Technology push: nye teknologier forskes frem", keywords: ["technology push", "teknologi push", "ny teknologi", "forsk"] },
      { text: "Interne kilder som idékonkurranser og forslagskasser", keywords: ["intern", "ansatte", "idékonkurranse", "idekonkurranse", "forslagskasse"] },
      { text: "Lead users som kilde til ideer", keywords: ["lead user", "ledende bruker"] },
      { text: "Eksterne kilder: konkurrenter, leverandører, messer og universiteter", keywords: ["ekstern", "konkurrent", "leverandør", "messe", "universitet", "høgskole"] },
    ],
  },
  {
    id: "g1",
    kind: "gate",
    label: "Gate 1",
    title: "Idéscreening",
    question: "Er ideen verdt å jobbe videre med?",
    points: [
      { text: "Initiell vurdering (screening) av ideene med go/kill", keywords: ["screening", "initiell vurdering", "første vurdering", "go/kill", "go kill", "sile"] },
      { text: "Passer ideen med bedriftens markedskompetanse?", keywords: ["markedskompetanse"] },
      { text: "Passer ideen med bedriftens teknologiske kompetanse?", keywords: ["teknologisk kompetanse", "teknisk kompetanse"] },
      { text: "Vurdere total risiko og usikkerhet ved utfallet", keywords: ["risiko", "usikkerhet"] },
    ],
  },
  {
    id: "s1",
    kind: "stage",
    label: "Fase 1",
    title: "Analyse",
    points: [
      { text: "Foreløpig markedsanalyse", keywords: ["markedsanalyse", "markedsvurdering", "markedsundersøk"] },
      { text: "Foreløpig teknisk analyse", keywords: ["teknisk analyse", "teknisk vurdering", "teknologisk analyse"] },
      { text: "Foreløpig finansiell analyse", keywords: ["finansiell", "økonomisk analyse", "forretningsmessig"] },
      { text: "Grov research med intervjuer og sekundære kilder", keywords: ["sekundær", "intervju", "grov research", "desk research"] },
      { text: "Handlingsplan for neste fase", keywords: ["handlingsplan", "plan for neste fase", "plan for fase 2"] },
    ],
  },
  {
    id: "g2",
    kind: "gate",
    label: "Gate 2",
    title: "Andre screening",
    question: "Rettferdiggjør ideen en grundig undersøkelse?",
    points: [
      { text: "Grundigere evaluering basert på kvalitative data og finansielle analyser", keywords: ["kvalitative data", "finansielle analyser", "grundigere evaluering", "grundig vurdering"] },
      { text: "Godkjenne handlingsplanen for konseptutviklingen", keywords: ["handlingsplan", "godkjenne plan"] },
    ],
  },
  {
    id: "s2",
    kind: "stage",
    label: "Fase 2",
    title: "Konseptutvikling (business case)",
    points: [
      { text: "Brukerundersøkelse av kundenes behov og ønsker", keywords: ["brukerundersøk", "behov og ønsker", "kundebehov", "brukerbehov"] },
      { text: "Konkurrentanalyse", keywords: ["konkurrentanalyse", "konkurrent"] },
      { text: "Konsepttest mot kundene", keywords: ["konsepttest", "teste konseptet"] },
      { text: "Definere verdiforslag og produktdefinisjon", keywords: ["verdiforslag", "produktdefinisjon", "definere produktet", "spesifikasjon"] },
      { text: "Detaljert teknisk og finansiell analyse", keywords: ["teknisk analyse", "finansiell analyse", "lønnsomhet", "payback", "roi"] },
      { text: "Business case og handlingsplan for utvikling og lansering", keywords: ["business case", "handlingsplan", "markedsplan"] },
    ],
  },
  {
    id: "g3",
    kind: "gate",
    label: "Gate 3",
    title: "Beslutning om utvikling",
    question: "Er business caset solid?",
    points: [
      { text: "Har prosjektet livets rett før de store utviklingskostnadene?", keywords: ["livets rett", "business case", "utviklingskostnad"] },
      { text: "Passer prosjektet med strategien?", keywords: ["strategi"] },
      { text: "Har produktet et konkurransefortrinn og høy kundeverdi?", keywords: ["konkurransefortrinn", "unike fordeler", "kundeverdi", "overlegen"] },
      { text: "Er markedet attraktivt (størrelse, vekst, konkurranse)?", keywords: ["markedsattraktiv", "attraktivt marked", "markedsstørrelse", "vekst"] },
      { text: "Teknisk gjennomførbarhet og risiko mot avkastning", keywords: ["gjennomførbar", "avkastning", "npv", "irr", "nåverdi"] },
    ],
  },
  {
    id: "s3",
    kind: "stage",
    label: "Fase 3",
    title: "Utvikling",
    points: [
      { text: "Utvikle prototyper", keywords: ["prototyp"] },
      { text: "Iterativ bygging, testing og tilbakemelding fra kunder", keywords: ["iterativ", "tilbakemelding", "bygg test", "kontinuerlig kontakt"] },
      { text: "Intern produkttesting", keywords: ["intern test", "intern produkttest", "in-house"] },
      { text: "Følge tidsplan og milepæler", keywords: ["tidsplan", "milepæl"] },
      { text: "Lage planer for produksjon, lansering og drift", keywords: ["lanseringsplan", "plan for lansering", "produksjonsplan", "driftsplan", "testplan"] },
    ],
  },
  {
    id: "g4",
    kind: "gate",
    label: "Gate 4",
    title: "Beslutning om testing",
    question: "Skal prosjektet over til ekstern testing?",
    points: [
      { text: "Er utviklingen gjort i tråd med plan og budsjett?", keywords: ["plan og budsjett", "budsjett", "etter planen"] },
      { text: "Er prototypen klar for testing hos kunder?", keywords: ["ekstern test", "klar for test", "test hos kunde"] },
    ],
  },
  {
    id: "s4",
    kind: "stage",
    label: "Fase 4",
    title: "Testing og verifisering",
    points: [
      { text: "Utvidede laboratorietester", keywords: ["laboratorie", "labtest", "lab-test"] },
      { text: "Kundetester og utvidet brukstest", keywords: ["kundetest", "brukstest", "feltest", "field trial"] },
      { text: "Test- eller nullproduksjon", keywords: ["nullproduksjon", "testproduksjon", "prøveproduksjon"] },
      { text: "Testmarked eller prøvesalg", keywords: ["testmarked", "prøvesalg", "trial sell"] },
      { text: "Avklare regulativer, godkjenning og patenter", keywords: ["regulativ", "lov", "godkjen", "patent"] },
      { text: "Ferdigstille produksjons- og markedsplan og finansielle beregninger", keywords: ["ferdigstille", "markedsplan", "produksjonsplan", "finansielle beregning"] },
    ],
  },
  {
    id: "g5",
    kind: "gate",
    label: "Gate 5",
    title: "Beslutning om lansering",
    question: "Er produktet klart for kommersiell lansering?",
    points: [
      { text: "Ta stilling til full produksjon og markedslansering", keywords: ["full produksjon", "markedslansering", "lansering"] },
      { text: "Er produktet testet og verifisert godt nok?", keywords: ["verifisert", "testet godt nok", "klar for lansering"] },
    ],
  },
  {
    id: "s5",
    kind: "stage",
    label: "Fase 5",
    title: "Kommersialisering",
    points: [
      { text: "Markedslansering og utrulling", keywords: ["lansering", "utrulling", "roll-out", "lansere"] },
      { text: "Full produksjon og drift", keywords: ["full produksjon", "produksjon", "drift"] },
      { text: "Salget starter", keywords: ["salg", "selge"] },
      { text: "Overvåke resultatene", keywords: ["overvåk", "følge med på resultat", "resultatoppfølging", "måle resultat"] },
    ],
  },
  {
    id: "pir",
    kind: "review",
    label: "PIR",
    title: "Etterevaluering",
    question: "Post implementation review",
    points: [
      { text: "Hvordan gikk det sammenlignet med prognosene?", keywords: ["prognose", "forventning", "sammenlign"] },
      { text: "Hva lærte vi?", keywords: ["lærte", "læring", "erfaring"] },
    ],
  },
];

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pairs each line you wrote with a point in the slot it was written for.
 * Each point can only be used once, so writing the same thing twice counts once.
 */
export function checkWritten(slot: StageGateSlot, lines: string[]) {
  const used = new Set<number>();
  const results = lines.map((line) => {
    const text = normalize(line);
    if (!text) return { line, match: null as number | null };
    const match = slot.points.findIndex(
      (p, i) => !used.has(i) && p.keywords.some((k) => text.includes(normalize(k))),
    );
    if (match >= 0) used.add(match);
    return { line, match: match >= 0 ? match : null };
  });
  return { results, found: used };
}
