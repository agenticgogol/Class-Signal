import "server-only";

export type AiRuntimeSettings = {
  providerName: string;
  modelName: string;
  apiKey: string;
};

export type GroundingMode = "course_only" | "course_and_web";

export type GroundingSource = {
  citationId: string;
  entryId: string;
  kind: "faq" | "theory" | "code";
  documentTitle: string;
  sectionTitle: string;
  moduleTopic: string | null;
  excerpt: string;
  similarityScore: number;
  lexicalScore: number;
  semanticScore: number | null;
  provenanceLabel: string | null;
};

export type ExternalCitation = { title: string; url: string };

export type DraftAnswerResult = {
  draft: string;
  externalCitations: ExternalCitation[];
  webSearchUsed: boolean;
};

export type DraftAnswerInput = {
  questionText: string;
  courseName: string;
  classDate: string | null;
  classNumber: string | null;
  moduleTopic: string | null;
  referenceLinks: string | null;
  groundingMode: GroundingMode;
  courseSources: GroundingSource[];
};

export type DuplicateCandidate = {
  id: string;
  questionText: string;
  localScore: number;
};

export type DuplicateRerankResult = {
  questionId: string;
  similarityScore: number;
  reason: string;
};

export class AiProviderError extends Error {
  constructor(
    public readonly publicMessage: string,
    public readonly status = 502,
  ) {
    super(publicMessage);
    this.name = "AiProviderError";
  }
}

export type AiProvider = {
  generateDraftAnswer(input: DraftAnswerInput, settings: AiRuntimeSettings): Promise<DraftAnswerResult>;
  rerankDuplicates?(
    questionText: string,
    candidates: DuplicateCandidate[],
    settings: AiRuntimeSettings,
  ): Promise<DuplicateRerankResult[]>;
};
