/**
 * Research Assistant — AI-powered tools for scientific research.
 *
 * Literature summaries, hypothesis generation, experimental design,
 * data interpretation, and citation management via LLM.
 */

import { LLM, type ChatMessage } from './llm.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiteratureResult {
  topic: string;
  summary: string;
  keyPoints: string[];
  gaps: string[];
  suggestedReading: string[];
}

export interface HypothesisSuggestion {
  hypothesis: string;
  rationale: string;
  testability: 'easy' | 'moderate' | 'complex';
  relatedFields: string[];
}

export interface ExperimentalDesign {
  objective: string;
  method: string;
  variables: { independent: string[]; dependent: string[]; controlled: string[] };
  controls: string[];
  sampleSize: string;
  timeline: string;
  potentialIssues: string[];
}

export interface DataInterpretation {
  summary: string;
  patterns: string[];
  statisticalNotes: string;
  limitations: string[];
  nextSteps: string[];
}

export interface Citation {
  id: string;
  title: string;
  authors: string;
  year: number;
  venue: string;
  doi?: string;
  notes: string;
}

// ─── System Prompts ───────────────────────────────────────────────────────────

const SCIENCE_SYSTEM = `You are a research assistant for sciencelog.ai — an AI lab notebook.
You help scientists with literature review, hypothesis generation, experimental design, and data interpretation.
Be precise, cite reasoning, and think like a rigorous researcher. Use scientific terminology accurately.
When uncertain, state assumptions clearly.`;

// ─── Literature Summary ───────────────────────────────────────────────────────

export async function summarizeLiterature(
  llm: LLM,
  topic: string,
  context?: string,
): Promise<LiteratureResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SCIENCE_SYSTEM },
    {
      role: 'user',
      content: `Summarize the current state of research on: "${topic}"
${context ? `Additional context: ${context}` : ''}

Provide your response in this exact JSON format:
{
  "topic": "...",
  "summary": "2-3 paragraph overview",
  "keyPoints": ["point 1", "point 2", "..."],
  "gaps": ["gap 1", "gap 2", "..."],
  "suggestedReading": ["topic/area 1", "topic/area 2", "..."]
}`,
    },
  ];

  const res = await llm.chat(messages);
  try {
    const cleaned = res.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as LiteratureResult;
  } catch {
    return {
      topic,
      summary: res.content,
      keyPoints: [],
      gaps: [],
      suggestedReading: [],
    };
  }
}

// ─── Hypothesis Generator ─────────────────────────────────────────────────────

export async function generateHypotheses(
  llm: LLM,
  observations: string,
  field?: string,
): Promise<HypothesisSuggestion[]> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SCIENCE_SYSTEM },
    {
      role: 'user',
      content: `Based on these observations, generate testable scientific hypotheses:

Observations:
${observations}
${field ? `\nField of study: ${field}` : ''}

Provide your response as a JSON array:
[
  {
    "hypothesis": "clear, testable statement",
    "rationale": "why this is a reasonable hypothesis",
    "testability": "easy|moderate|complex",
    "relatedFields": ["field1", "field2"]
  }
]

Generate 3-5 hypotheses.`,
    },
  ];

  const res = await llm.chat(messages);
  try {
    const cleaned = res.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as HypothesisSuggestion[];
  } catch {
    return [{
      hypothesis: res.content,
      rationale: 'Generated from observations',
      testability: 'moderate',
      relatedFields: field ? [field] : [],
    }];
  }
}

// ─── Experimental Design ──────────────────────────────────────────────────────

export async function suggestExperimentalDesign(
  llm: LLM,
  hypothesis: string,
  constraints?: string,
): Promise<ExperimentalDesign> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SCIENCE_SYSTEM },
    {
      role: 'user',
      content: `Design an experiment to test this hypothesis:

"${hypothesis}"
${constraints ? `\nConstraints: ${constraints}` : ''}

Provide your response in this exact JSON format:
{
  "objective": "what the experiment aims to determine",
  "method": "detailed methodology",
  "variables": {
    "independent": ["variable 1"],
    "dependent": ["variable 1"],
    "controlled": ["variable 1"]
  },
  "controls": ["control 1"],
  "sampleSize": "recommended size with reasoning",
  "timeline": "estimated duration",
  "potentialIssues": ["issue 1"]
}`,
    },
  ];

  const res = await llm.chat(messages);
  try {
    const cleaned = res.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as ExperimentalDesign;
  } catch {
    return {
      objective: `Test: ${hypothesis}`,
      method: res.content,
      variables: { independent: [], dependent: [], controlled: [] },
      controls: [],
      sampleSize: 'Not specified',
      timeline: 'Not specified',
      potentialIssues: [],
    };
  }
}

// ─── Data Interpretation ──────────────────────────────────────────────────────

export async function interpretData(
  llm: LLM,
  data: string,
  context?: string,
): Promise<DataInterpretation> {
  const messages: ChatMessage[] = [
    { role: 'system', content: SCIENCE_SYSTEM },
    {
      role: 'user',
      content: `Interpret the following experimental data/results:

${data}
${context ? `\nContext: ${context}` : ''}

Provide your response in this exact JSON format:
{
  "summary": "brief interpretation summary",
  "patterns": ["pattern 1", "pattern 2"],
  "statisticalNotes": "notes on statistical significance or analysis",
  "limitations": ["limitation 1"],
  "nextSteps": ["recommended next step 1"]
}`,
    },
  ];

  const res = await llm.chat(messages);
  try {
    const cleaned = res.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned) as DataInterpretation;
  } catch {
    return {
      summary: res.content,
      patterns: [],
      statisticalNotes: '',
      limitations: [],
      nextSteps: [],
    };
  }
}

// ─── Citation Manager ─────────────────────────────────────────────────────────

export class CitationManager {
  private citations: Map<string, Citation> = new Map();

  add(data: Omit<Citation, 'id'>): Citation {
    const id = `cite_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const citation: Citation = { id, ...data };
    this.citations.set(id, citation);
    return citation;
  }

  get(id: string): Citation | undefined {
    return this.citations.get(id);
  }

  list(): Citation[] {
    return Array.from(this.citations.values()).sort((a, b) => b.year - a.year);
  }

  search(query: string): Citation[] {
    const q = query.toLowerCase();
    return this.list().filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.authors.toLowerCase().includes(q) ||
      c.notes.toLowerCase().includes(q)
    );
  }

  delete(id: string): boolean {
    return this.citations.delete(id);
  }

  /** Format citation in common styles */
  format(id: string, style: 'apa' | 'mla' | 'chicago' = 'apa'): string {
    const c = this.citations.get(id);
    if (!c) return '';
    switch (style) {
      case 'apa':
        return `${c.authors} (${c.year}). ${c.title}. ${c.venue}.${c.doi ? ` https://doi.org/${c.doi}` : ''}`;
      case 'mla':
        return `${c.authors}. "${c.title}." ${c.venue} (${c.year}).${c.doi ? ` doi:${c.doi}` : ''}`;
      case 'chicago':
        return `${c.authors}. "${c.title}." ${c.venue} (${c.year}).${c.doi ? ` https://doi.org/${c.doi}` : ''}`;
    }
  }

  toJSON(): Citation[] {
    return this.list();
  }

  static fromJSON(data: Citation[]): CitationManager {
    const mgr = new CitationManager();
    for (const c of data) mgr.citations.set(c.id, c);
    return mgr;
  }
}
