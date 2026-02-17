export interface CleanedMaterial {
  title: string;
  url: string;
  content: string;
  source_type: string;
  authors?: string[];
  year?: string;
  citation_count?: number;
  published_at?: string;
  quality_score: number;
  similarity_score?: number;
  embedding_similarity?: number;
  is_selected?: boolean;
}

export interface CleaningOptions {
  removeHtml?: boolean;
  deduplicateByUrl?: boolean;
  deduplicateByTitle?: boolean;
  removeLowQuality?: boolean;
  minContentLength?: number;
  minQualityScore?: number;
}

const defaultOptions: CleaningOptions = {
  removeHtml: true,
  deduplicateByUrl: true,
  deduplicateByTitle: true,
  removeLowQuality: true,
  minContentLength: 100,
  minQualityScore: 0.3,
};

export function cleanHtml(text: string): string {
  if (!text) return '';

  let cleaned = text;

  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '');
  cleaned = cleaned.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  cleaned = cleaned.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  cleaned = cleaned.replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');

  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  cleaned = cleaned.replace(/&nbsp;/g, ' ');
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/&lt;/g, '<');
  cleaned = cleaned.replace(/&gt;/g, '>');
  cleaned = cleaned.replace(/&quot;/g, '"');
  cleaned = cleaned.replace(/&#39;/g, "'");
  cleaned = cleaned.replace(/&[a-z]+;/gi, '');

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

export function normalizeUrl(url: string): string {
  if (!url) return '';

  try {
    let normalized = url.toLowerCase();

    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^www\./, '');
    normalized = normalized.replace(/\/$/, '');
    normalized = normalized.split('?')[0];
    normalized = normalized.split('#')[0];

    return normalized;
  } catch {
    return url;
  }
}

export function normalizeTitle(title: string): string {
  if (!title) return '';

  let normalized = title.toLowerCase();

  normalized = normalized.replace(/[^\w\s\u4e00-\u9fff]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

export function calculateTitleSimilarity(title1: string, title2: string): number {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  if (!norm1 || !norm2) return 0;

  if (norm1 === norm2) return 1;

  if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;

  const words1 = norm1.split(' ');
  const words2 = norm2.split(' ');
  const set1 = new Set(words1);
  const set2 = new Set(words2);

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

export function calculateQualityScore(material: {
  title?: string;
  content?: string;
  url?: string;
  authors?: string[];
  citation_count?: number;
  year?: string;
}): number {
  let score = 0;
  let factors = 0;

  if (material.title && material.title.length > 10) {
    score += 0.2;
    factors++;
  }

  if (material.content) {
    const contentLength = material.content.length;
    if (contentLength > 500) {
      score += 0.3;
    } else if (contentLength > 200) {
      score += 0.2;
    } else if (contentLength > 100) {
      score += 0.1;
    }
    factors++;
  }

  if (material.url) {
    try {
      const parsedUrl = new URL(material.url);
      const trustedDomains = [
        'scholar.google.com',
        'arxiv.org',
        'nature.com',
        'science.org',
        'springer.com',
        'wiley.com',
        'ieee.org',
        'acm.org',
        'sciencedirect.com',
        'researchgate.net',
        'semanticscholar.org',
        'pubmed.ncbi.nlm.nih.gov',
      ];

      if (trustedDomains.some(d => parsedUrl.hostname.includes(d))) {
        score += 0.3;
      } else {
        score += 0.1;
      }
      factors++;
    } catch {
    }
  }

  if (material.authors && material.authors.length > 0) {
    score += 0.1;
    factors++;
  }

  if (material.citation_count && material.citation_count > 0) {
    if (material.citation_count > 100) {
      score += 0.2;
    } else if (material.citation_count > 50) {
      score += 0.15;
    } else if (material.citation_count > 10) {
      score += 0.1;
    }
    factors++;
  }

  if (material.year) {
    const yearNum = parseInt(material.year);
    const currentYear = new Date().getFullYear();
    const age = currentYear - yearNum;

    if (age <= 1) {
      score += 0.15;
    } else if (age <= 3) {
      score += 0.1;
    } else if (age <= 5) {
      score += 0.05;
    }
    factors++;
  }

  return factors > 0 ? score / factors : 0;
}

export function isLowQualityContent(content: string): boolean {
  if (!content || content.length < 50) return true;

  const lowQualityPatterns = [
    /click here/i,
    /subscribe now/i,
    /sign up/i,
    /advertisement/i,
    /sponsored/i,
    /cookie policy/i,
    /privacy policy/i,
    /terms of service/i,
    /404 not found/i,
    /page not found/i,
    /access denied/i,
    /login required/i,
    /paywall/i,
  ];

  const matchCount = lowQualityPatterns.filter(p => p.test(content)).length;

  return matchCount >= 3;
}

export function cleanMaterials(
  materials: any[],
  options: CleaningOptions = {}
): CleanedMaterial[] {
  const opts = { ...defaultOptions, ...options };

  let cleaned = materials.map(m => {
    let content = m.full_text || m.abstract || m.content || '';

    if (opts.removeHtml) {
      content = cleanHtml(content);
    }

    const qualityScore = calculateQualityScore({
      title: m.title,
      content,
      url: m.url,
      authors: m.authors,
      citation_count: m.citation_count,
      year: m.year,
    });

    return {
      ...m,
      content,
      quality_score: qualityScore,
    };
  });

  if (opts.deduplicateByUrl) {
    const urlMap = new Map<string, CleanedMaterial>();

    for (const m of cleaned) {
      const normalizedUrl = normalizeUrl(m.url);

      if (!normalizedUrl) {
        continue;
      }

      const existing = urlMap.get(normalizedUrl);

      if (!existing || m.quality_score > existing.quality_score) {
        urlMap.set(normalizedUrl, m);
      }
    }

    const urlDeduped = Array.from(urlMap.values());
    const noUrlMaterials = cleaned.filter(m => !m.url);
    cleaned = [...urlDeduped, ...noUrlMaterials];
  }

  if (opts.deduplicateByTitle) {
    const titleGroups: CleanedMaterial[][] = [];

    for (const m of cleaned) {
      let foundGroup = false;

      for (const group of titleGroups) {
        const similarity = calculateTitleSimilarity(m.title, group[0].title);

        if (similarity > 0.85) {
          group.push(m);
          foundGroup = true;
          break;
        }
      }

      if (!foundGroup) {
        titleGroups.push([m]);
      }
    }

    cleaned = titleGroups.map(group => {
      return group.reduce((best, current) =>
        current.quality_score > best.quality_score ? current : best
      );
    });
  }

  if (opts.removeLowQuality) {
    cleaned = cleaned.filter(m => {
      if (m.content.length < (opts.minContentLength || 100)) {
        return false;
      }

      if (isLowQualityContent(m.content)) {
        return false;
      }

      if (m.quality_score < (opts.minQualityScore || 0.3)) {
        return false;
      }

      return true;
    });
  }

  cleaned.sort((a, b) => b.quality_score - a.quality_score);

  return cleaned;
}

export function calculateRelevanceScore(
  material: CleanedMaterial,
  query: string,
  keywords: string[] = []
): number {
  const title = (material.title || '').toLowerCase();
  const content = (material.content || '').toLowerCase();
  const queryLower = query.toLowerCase();

  let score = material.quality_score;

  if (title.includes(queryLower)) {
    score += 0.3;
  } else if (content.includes(queryLower)) {
    score += 0.1;
  }

  for (const keyword of keywords) {
    const kwLower = keyword.toLowerCase();
    if (title.includes(kwLower)) {
      score += 0.1;
    } else if (content.includes(kwLower)) {
      score += 0.05;
    }
  }

  return Math.min(score, 1);
}

export function rerankMaterials(
  materials: CleanedMaterial[],
  query: string,
  keywords: string[] = []
): CleanedMaterial[] {
  const scored = materials.map(m => ({
    ...m,
    similarity_score: calculateRelevanceScore(m, query, keywords),
  }));

  scored.sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0));

  return scored;
}

export interface RerankWithEmbeddingOptions {
  topN?: number;
  maxContentLength?: number;
  model?: string;
}

export async function rerankMaterialsWithEmbedding(
  materials: CleanedMaterial[],
  query: string,
  keywords: string[] = [],
  options: RerankWithEmbeddingOptions = {}
): Promise<CleanedMaterial[]> {
  const {
    topN = 5,
    maxContentLength = 2000,
    model = 'text-embedding-3-small'
  } = options;

  if (materials.length === 0) {
    return [];
  }

  try {
    const { createEmbedding, createBatchEmbeddings, cosineSimilarity } = await import('./embedding.js');

    const queryEmbeddingResult = await createEmbedding(query, model);
    const queryEmbedding = queryEmbeddingResult.embedding;

    const textsToEmbed = materials.map(m =>
      `${m.title}\n\n${m.content.substring(0, maxContentLength)}`
    );

    const embeddingResults = await createBatchEmbeddings(textsToEmbed, model, 5);

    const scored = materials.map((m, index) => {
      let embeddingSimilarity = 0;
      if (embeddingResults[index]) {
        embeddingSimilarity = cosineSimilarity(queryEmbedding, embeddingResults[index].embedding);
      }

      const keywordSimilarity = calculateRelevanceScore(m, query, keywords);

      const combinedScore = (embeddingSimilarity * 0.7) + (keywordSimilarity * 0.3);

      return {
        ...m,
        embedding_similarity: embeddingSimilarity,
        similarity_score: combinedScore,
      };
    });

    scored.sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0));

    return scored.map((m, index) => ({
      ...m,
      is_selected: index < topN,
    }));
  } catch {
    const keywordRanked = rerankMaterials(materials, query, keywords);
    return keywordRanked.map((m, index) => ({
      ...m,
      is_selected: index < topN,
    }));
  }
}
