// Amazon product page review extraction
import type {
  ProductInfo,
  ExtractedReview,
  ExtractedProductPage,
  PageType,
} from './types';

// URL patterns for supported e-commerce sites
// Matches regional Amazon domains: amazon.com, amazon.co.uk, amazon.de, amazon.fr,
// amazon.es, amazon.it, amazon.co.jp, amazon.com.br, amazon.com.tr, amazon.in, etc.
const AMAZON_PRODUCT_PATTERN = /amazon\.[a-z.]+(?:\/[^\/]*)*\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i;

// Matches: amazon.*/product-reviews/ASIN/...
const AMAZON_REVIEWS_PATTERN = /amazon\.[a-z.]+\/product-reviews\/([A-Z0-9]{10})/i;

/**
 * Detect if the current URL is a supported product page
 */
export function detectPageType(url: string): PageType {
  if (AMAZON_PRODUCT_PATTERN.test(url) || AMAZON_REVIEWS_PATTERN.test(url)) {
    return 'product';
  }
  return 'article';
}

/**
 * Extract ASIN from Amazon URL (supports product pages and review pages)
 */
function extractAsin(url: string): string | null {
  const productMatch = url.match(AMAZON_PRODUCT_PATTERN);
  if (productMatch) return productMatch[1];
  
  const reviewMatch = url.match(AMAZON_REVIEWS_PATTERN);
  if (reviewMatch) return reviewMatch[1];
  
  return null;
}

/**
 * Extract product information from Amazon page
 */
function extractProductInfo(doc: Document, url: string): ProductInfo {
  const getText = (selectors: string[]): string | null => {
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el?.textContent?.trim()) {
        return el.textContent.trim();
      }
    }
    return null;
  };

  // Title selectors - includes review page selectors
  const title = getText([
    '#productTitle',
    '#title',
    'h1.product-title-word-break',
    // Review page selectors
    '[data-hook="product-link"]',
    '.product-title',
    '.a-link-normal[data-hook="product-link"]',
    'h1 a[data-hook="product-link"]',
  ]) || 'Unknown Product';

  const priceText = getText([
    '.a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price-whole',
    '[data-a-color="price"] .a-offscreen',
  ]);

  // Extract rating (e.g., "4.5 out of 5 stars")
  const ratingText = getText([
    '[data-hook="rating-out-of-text"]',
    '#acrPopover',
    '.a-icon-star-small .a-icon-alt',
    '.averageStarRating',
  ]);
  // Handle European comma decimals (e.g., "4,5 sur 5 étoiles") by normalizing to dot
  const rating = ratingText
    ? parseFloat(ratingText.replace(',', '.').match(/[\d.]+/)?.[0] || '0')
    : null;

  // Extract review count
  const reviewCountText = getText([
    '[data-hook="total-review-count"]',
    '#acrCustomerReviewText',
  ]);
  const reviewCount = reviewCountText 
    ? parseInt(reviewCountText.replace(/[^\d]/g, ''), 10) || null
    : null;

  // Extract image
  const imgEl = doc.querySelector('#landingImage, #imgBlkFront, #main-image') as HTMLImageElement | null;
  const imageUrl = imgEl?.src || null;

  return {
    title,
    price: priceText,
    rating,
    reviewCount,
    asin: extractAsin(url),
    url,
    imageUrl,
  };
}

/**
 * Parse helpful count from text like "42 people found this helpful"
 */
function parseHelpfulCount(text: string | null): number {
  if (!text) return 0;
  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse star rating from class or text
 */
function parseStarRating(el: Element | null): number {
  if (!el) return 0;
  
  // Try class-based rating (e.g., "a-star-4")
  const classList = el.className;
  const classMatch = classList.match(/a-star-(\d)/);
  if (classMatch) return parseInt(classMatch[1], 10);
  
  // Try text-based rating
  const text = el.textContent || '';
  const textMatch = text.match(/(\d+(?:\.\d+)?)/);
  return textMatch ? parseFloat(textMatch[1]) : 0;
}

/**
 * Extract reviews from Amazon page
 * Searches multiple locations to maximize review count
 */
function extractReviews(doc: Document): ExtractedReview[] {
  const reviews: ExtractedReview[] = [];
  const seenTexts = new Set<string>(); // Deduplicate by review text

  // All possible review container selectors (Amazon has reviews in multiple places)
  const containerSelectors = [
    // Main review section
    '[data-hook="review"]',
    // Customer reviews section
    '#cm-cr-dp-review-list [data-hook="review"]',
    '#cm-cr-global-review-list [data-hook="review"]',
    // Top reviews section
    '#reviewsMedley [data-hook="review"]',
    // Review cards
    '.review',
    '.a-section.review',
    '.cr-widget-FocalReviews [data-hook="review"]',
    // Individual review items
    '.review-views .review',
    '#customer_review_foreign [data-hook="review"]',
    // Community reviews
    '.cr-widget-CommunityFeedback [data-hook="review"]',
    // Dedicated reviews page (/product-reviews/ASIN)
    '#cm_cr-review_list [data-hook="review"]',
    '.reviews-content [data-hook="review"]',
    '#cm_cr-review_list .review',
    '.celwidget[data-hook="review"]',
  ];

  // Combine all selectors and query
  const allContainers = doc.querySelectorAll(containerSelectors.join(', '));

  for (const container of allContainers) {
    // Extract review text - try multiple selectors
    const textSelectors = [
      '[data-hook="review-body"] span:not(.cr-original-review-content)',
      '[data-hook="review-body"]',
      '.review-text-content span',
      '.review-text-content',
      '.review-text span',
      '.review-text',
    ];

    let text: string | null = null;
    for (const selector of textSelectors) {
      const el = container.querySelector(selector);
      if (el?.textContent?.trim()) {
        text = el.textContent.trim();
        break;
      }
    }

    if (!text || text.length < 20) continue; // Skip very short reviews

    // Deduplicate - skip if we've seen this review text
    const textKey = text.slice(0, 100); // Use first 100 chars as key
    if (seenTexts.has(textKey)) continue;
    seenTexts.add(textKey);

    // Extract rating
    const ratingSelectors = [
      '[data-hook="review-star-rating"]',
      '[data-hook="cmps-review-star-rating"]',
      '.review-rating',
      '.a-icon-star',
      'i.review-rating',
    ];

    let ratingEl: Element | null = null;
    for (const selector of ratingSelectors) {
      ratingEl = container.querySelector(selector);
      if (ratingEl) break;
    }
    const rating = parseStarRating(ratingEl);

    // Extract title
    const titleSelectors = [
      '[data-hook="review-title"] span:not(.a-letter-space)',
      '[data-hook="review-title"]',
      '.review-title span',
      '.review-title',
    ];

    let title: string | null = null;
    for (const selector of titleSelectors) {
      const el = container.querySelector(selector);
      const titleText = el?.textContent?.trim();
      // Filter out rating text in titles across locales:
      // EN: "4.5 out of 5 stars", FR: "4,5 sur 5 étoiles",
      // DE: "4,5 von 5 Sternen", ES: "4,5 de 5 estrellas",
      // TR: "5 üzerinden 4,5"
      if (titleText && titleText.length > 0 && !titleText.match(/^\d[\d.,]*\s+\S+\s+\d/i)) {
        title = titleText;
        break;
      }
    }

    // Extract helpful count
    const helpfulEl = container.querySelector(
      '[data-hook="helpful-vote-statement"], .cr-vote-text, .a-size-base.a-color-tertiary'
    );
    const helpfulCount = parseHelpfulCount(helpfulEl?.textContent || null);

    // Check if verified purchase — data-hook selectors are locale-agnostic;
    // the text fallback covers regional translations (e.g., "Achat vérifié", "Compra verificada")
    const verifiedEl = container.querySelector(
      '[data-hook="avp-badge"], [data-hook="avp-badge-linkless"], .a-size-mini.a-color-state'
    );
    const isVerified = !!verifiedEl;

    reviews.push({
      text,
      rating,
      title,
      helpfulCount,
      isVerified,
    });
  }

  // Sort by helpful count (most helpful first)
  return reviews.sort((a, b) => b.helpfulCount - a.helpfulCount);
}

/**
 * Main extraction function for product pages
 */
export function extractProductPage(doc: Document, url: string): ExtractedProductPage | null {
  if (detectPageType(url) !== 'product') {
    return null;
  }

  const product = extractProductInfo(doc, url);
  const reviews = extractReviews(doc);

  return {
    product,
    reviews,
  };
}

/**
 * Check if URL matches Amazon product page pattern (includes review pages)
 */
export function isAmazonProductUrl(url: string): boolean {
  return AMAZON_PRODUCT_PATTERN.test(url) || AMAZON_REVIEWS_PATTERN.test(url);
}
