import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWorker } from 'tesseract.js';
import OpenAI from 'openai';

@Injectable()
export class InvoicesParserService {
  private readonly logger = new Logger(InvoicesParserService.name);
  private openaiClient: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    // Initialize OpenAI client if API key is provided
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({
        apiKey: openaiApiKey,
      });
      this.logger.log('OpenAI client initialized');
    } else {
      this.logger.warn('OpenAI API key not found. AI-powered parsing will be disabled.');
    }
  }

  /**
   * Parse invoice file and extract details
   * Uses OCR for images and optionally OpenAI for enhanced parsing
   */
  async parseInvoiceFile(file: Express.Multer.File): Promise<{
    invoiceNumber?: string;
    amount?: number;
    currency?: string;
    provider?: string;
    billingDate?: string;
    dueDate?: string;
    category?: string;
  }> {
    const extractedData: any = {};

    try {
      let text = '';

      // Handle PDF files
      if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
        try {
          if (!file.buffer) {
            this.logger.warn('PDF file has no buffer, using filename extraction');
            text = file.originalname;
          } else {
            this.logger.debug(
              `Parsing PDF file: ${file.originalname}, size: ${file.buffer.length} bytes`,
            );
            // Use pdfjs-dist for Node-safe PDF text extraction (no DOM/Canvas warnings)
            // This is the recommended approach for Node.js 20+ on Railway
            // pdfjs-dist v4.x is ESM-only, so we use dynamic import
            // Use Function constructor to preserve dynamic import syntax (prevents TypeScript from converting to require)
            // This ensures the dynamic import is executed at runtime, not transformed by TypeScript compiler
            const importPdfjs = new Function('specifier', 'return import(specifier)');
            const pdfjsLib = await importPdfjs('pdfjs-dist/legacy/build/pdf.mjs');
            const loadingTask = pdfjsLib.getDocument({
              data: new Uint8Array(file.buffer),
              verbosity: 0, // Suppress warnings
            });
            const pdf = await loadingTask.promise;

            let extractedText = '';
            // Extract from first 3 pages (most invoices are 1-2 pages)
            const pagesToExtract = Math.min(pdf.numPages, 3);
            for (let i = 1; i <= pagesToExtract; i++) {
              try {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                // Better text extraction - preserve structure and spacing
                let pageText = '';
                let lastY = null;
                let lastX = null;

                for (const item of content.items) {
                  // Check if item is TextItem (has str property)
                  if ('str' in item) {
                    // Preserve spacing based on position
                    const currentY = item.transform?.[5] || 0; // Y position
                    const currentX = item.transform?.[4] || 0; // X position

                    // Add newline if Y position changed significantly (new line)
                    if (lastY !== null && Math.abs(currentY - lastY) > 5) {
                      pageText += '\n';
                    }
                    // Add space if X position changed significantly (new word)
                    else if (
                      lastX !== null &&
                      Math.abs(currentX - lastX) > 10 &&
                      pageText.length > 0 &&
                      !pageText.endsWith('\n') &&
                      !pageText.endsWith(' ')
                    ) {
                      pageText += ' ';
                    }

                    pageText += item.str;
                    lastY = currentY;
                    lastX = currentX;
                  }
                }

                extractedText += pageText + '\n\n';
              } catch (pageError) {
                this.logger.warn(`Error extracting page ${i}: ${pageError.message}`);
              }
            }

            // Clean and normalize the extracted text
            // Preserve line breaks for better structure, but normalize excessive whitespace
            text = extractedText
              .replace(/[ \t]+/g, ' ') // Normalize multiple spaces/tabs to single space
              .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
              .trim();

            this.logger.debug(
              `Extracted ${text.length} characters from PDF (${pagesToExtract} pages)`,
            );

            // If text extraction is too short, log a warning
            if (text.length < 50) {
              this.logger.warn(
                `PDF text extraction seems incomplete (only ${text.length} chars). The PDF might be image-based or encrypted.`,
              );
            }
          }
        } catch (error) {
          this.logger.error(`Error parsing PDF: ${error.message}`, error.stack);
          // Fallback to filename
          text = file.originalname;
        }
      } else if (file.mimetype.startsWith('image/')) {
        // Use OCR for images
        this.logger.debug(`Extracting text from image: ${file.originalname}`);
        try {
          text = await this.extractTextWithOCR(file.buffer);
          this.logger.debug(`OCR extracted ${text.length} characters from image`);
        } catch (error) {
          this.logger.error(`OCR failed: ${error.message}`, error.stack);
          // Fallback to filename
          text = file.originalname;
        }
      } else {
        // Try to read as text
        text = file.buffer?.toString('utf-8') || '';
      }

      // Clean and normalize text before processing
      // Preserve line breaks for better date/amount detection
      text = text
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
        .replace(/[ \t]+/g, ' ') // Normalize multiple spaces/tabs to single space (but keep newlines)
        .trim();

      // Always include filename in text for provider detection (add as separate line)
      text = `${text}\n\nFilename: ${file.originalname}`;

      this.logger.debug(`Processing text (${text.length} chars) for invoice extraction`);

      // Always try OpenAI parsing first if available (it's much better for amount/date detection)
      if (this.openaiClient && text.length > 50) {
        try {
          this.logger.debug(
            `Attempting OpenAI-powered parsing (text length: ${text.length} chars)`,
          );
          const aiExtracted = await this.parseWithOpenAI(text, file.originalname);
          // Prioritize OpenAI results, use regex only as fallback
          this.logger.debug('OpenAI extraction results:', JSON.stringify(aiExtracted, null, 2));

          // Invoice Number: Use AI first, fallback to regex
          extractedData.invoiceNumber =
            aiExtracted.invoiceNumber || this.extractInvoiceNumber(text);

          // Amount: Prioritize OpenAI (it's better at finding totals)
          const aiAmount = aiExtracted.amount;
          if (aiAmount !== null && aiAmount !== undefined) {
            const numAmount =
              typeof aiAmount === 'number' ? aiAmount : parseFloat(String(aiAmount));
            if (!isNaN(numAmount) && isFinite(numAmount) && numAmount > 0) {
              extractedData.amount = Math.round(numAmount * 100) / 100;
              this.logger.debug(`Using OpenAI amount: ${extractedData.amount}`);
            } else {
              // AI amount invalid, try regex
              const regexAmount = this.extractAmount(text);
              if (regexAmount) {
                extractedData.amount = regexAmount;
                this.logger.debug(`Using regex amount (AI invalid): ${extractedData.amount}`);
              }
            }
          } else {
            // No AI amount, use regex
            const regexAmount = this.extractAmount(text);
            if (regexAmount) {
              extractedData.amount = regexAmount;
              this.logger.debug(`Using regex amount (AI missing): ${extractedData.amount}`);
            }
          }

          extractedData.currency = 'USD'; // Always use USD

          // Provider: Use AI first, fallback to regex
          extractedData.provider =
            aiExtracted.provider || this.extractProvider(text, file.originalname);

          // Dates: Prioritize OpenAI (it's better at understanding context)
          if (aiExtracted.billingDate) {
            const normalizedBillingDate = this.normalizeDate(aiExtracted.billingDate);
            extractedData.billingDate = normalizedBillingDate || aiExtracted.billingDate;
            this.logger.debug(`Using OpenAI billing date: ${extractedData.billingDate}`);
          } else {
            extractedData.billingDate = this.extractDate(text, 'billing');
            if (extractedData.billingDate) {
              this.logger.debug(`Using regex billing date: ${extractedData.billingDate}`);
            }
          }

          if (aiExtracted.dueDate) {
            const normalizedDueDate = this.normalizeDate(aiExtracted.dueDate);
            extractedData.dueDate = normalizedDueDate || aiExtracted.dueDate;
            this.logger.debug(`Using OpenAI due date: ${extractedData.dueDate}`);
          } else {
            extractedData.dueDate = this.extractDate(text, 'due');
            if (extractedData.dueDate) {
              this.logger.debug(`Using regex due date: ${extractedData.dueDate}`);
            }
          }

          // Category: Use AI first, fallback to regex
          extractedData.category =
            aiExtracted.category || this.extractCategory(text, extractedData.provider);

          this.logger.debug('OpenAI parsing completed successfully');
        } catch (error) {
          this.logger.warn(`OpenAI parsing failed, using regex fallback: ${error.message}`);
          this.logger.debug(`Error details: ${error.stack}`);
          // Fallback to regex extraction only if OpenAI completely fails
          extractedData.invoiceNumber = this.extractInvoiceNumber(text);

          // Ensure amount is a valid number
          const regexAmount = this.extractAmount(text);
          if (regexAmount !== null && regexAmount !== undefined) {
            const numAmount =
              typeof regexAmount === 'number' ? regexAmount : parseFloat(String(regexAmount));
            if (!isNaN(numAmount) && isFinite(numAmount) && numAmount > 0) {
              extractedData.amount = Math.round(numAmount * 100) / 100;
            }
          }

          extractedData.currency = 'USD'; // Always use USD
          extractedData.provider = this.extractProvider(text, file.originalname);
          extractedData.billingDate = this.extractDate(text, 'billing');
          extractedData.dueDate = this.extractDate(text, 'due');
          extractedData.category = this.extractCategory(text, extractedData.provider);
        }
      } else {
        // Use regex patterns for extraction (fallback when OpenAI is not available)
        this.logger.debug('Using regex-based extraction (OpenAI not available or text too short)');

        extractedData.invoiceNumber = this.extractInvoiceNumber(text);

        // Ensure amount is a valid number
        const regexAmount = this.extractAmount(text);
        if (regexAmount !== null && regexAmount !== undefined) {
          const numAmount =
            typeof regexAmount === 'number' ? regexAmount : parseFloat(String(regexAmount));
          if (!isNaN(numAmount) && isFinite(numAmount) && numAmount > 0) {
            extractedData.amount = Math.round(numAmount * 100) / 100;
          }
        }

        extractedData.currency = 'USD'; // Always use USD
        extractedData.provider = this.extractProvider(text, file.originalname);
        extractedData.billingDate = this.extractDate(text, 'billing');
        extractedData.dueDate = this.extractDate(text, 'due');
        extractedData.category = this.extractCategory(text, extractedData.provider);
      }

      // Log what was extracted for debugging
      const extractedFields = Object.keys(extractedData).filter(
        (key) => extractedData[key] !== null && extractedData[key] !== undefined,
      );
      this.logger.log(
        `Invoice extraction completed. Extracted fields: ${extractedFields.join(', ') || 'none'}`,
      );
      this.logger.debug('Extracted invoice data:', JSON.stringify(extractedData, null, 2));

      return extractedData;
    } catch (error) {
      this.logger.error(`Error parsing invoice: ${error.message}`, error.stack);
      // Return partial data if available
      return extractedData;
    }
  }

  private extractInvoiceNumber(text: string): string | undefined {
    // Common patterns: INV-2024-001, Invoice #12345, Invoice Number: INV-001, etc.
    // Improved patterns with better accuracy
    const patterns = [
      // Invoice Number: INV-2024-001 or Invoice #: INV-2024-001 (highest priority)
      /invoice\s*(?:number|#|no\.?|num\.?|id)\s*:?\s*([A-Z0-9\-_\/]+)/i,
      // INV-2024-001 or INV 2024 001
      /(?:invoice|inv)\.?\s*([A-Z0-9\-_\/]+)/i,
      // # INV-2024-001 or #12345
      /#\s*([A-Z0-9\-_\/]+)/i,
      // INV-2024-001, INV-001, INV2024001 (improved pattern)
      /\b(INV[-\s_]?\d{4}[-\s_]?\d{2,})\b/i,
      // 2024-INV-001 or 2024/INV/001
      /\b(\d{4}[-\s_\/]?[A-Z]{2,4}[-\s_\/]?\d{2,})\b/i,
      // Invoice ID: ABC123 or Invoice ID ABC123
      /invoice\s*id\s*:?\s*([A-Z0-9\-_\/]+)/i,
      // Bill Number: BILL-001
      /bill\s*(?:number|#|no\.?|id)?\s*:?\s*([A-Z0-9\-_\/]+)/i,
      // Reference: REF-2024-001
      /reference\s*(?:number|#|no\.?)?\s*:?\s*([A-Z0-9\-_\/]+)/i,
      // Document Number: DOC-001
      /document\s*(?:number|#|no\.?)?\s*:?\s*([A-Z0-9\-_\/]+)/i,
      // Order Number: ORD-001
      /order\s*(?:number|#|no\.?)?\s*:?\s*([A-Z0-9\-_\/]+)/i,
      // Standalone patterns like INV-001, INV001, #001
      /\b(INV[-\s_]?\d{3,})\b/i,
      // Alphanumeric codes like ABC123, 123ABC, etc. (but not dates)
      /\b([A-Z]{2,}\d{2,}|\d{2,}[A-Z]{2,})\b/,
    ];

    const candidates: Array<{ value: string; confidence: number }> = [];

    // Try each pattern and collect candidates with confidence scores
    for (const pattern of patterns) {
      const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
      for (const match of matches) {
        if (match && match[1]) {
          const candidate = match[1].trim();
          // Filter out dates, amounts, and other false positives
          if (
            (candidate.length >= 3 &&
              candidate.length <= 50 &&
              !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(candidate) && // Not a date
              !/^\$?[\d,]+\.?\d*$/.test(candidate) && // Not an amount
              !/^\d{4}-\d{2}-\d{2}$/.test(candidate) && // Not ISO date
              !/^[A-Z]{3}$/.test(candidate) && // Not a currency code
              !/^\d+$/.test(candidate)) ||
            candidate.length > 6 // Not just numbers (unless long)
          ) {
            // Calculate confidence based on pattern type
            let confidence = 5;
            if (pattern.source.includes('invoice.*number|invoice.*#')) {
              confidence = 10; // Highest confidence
            } else if (pattern.source.includes('INV')) {
              confidence = 9; // High confidence for INV patterns
            } else if (pattern.source.includes('bill|reference|document|order')) {
              confidence = 8; // Good confidence for labeled fields
            }

            candidates.push({ value: candidate, confidence });
          }
        }
      }
    }

    // Return the candidate with highest confidence
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.confidence - a.confidence);
      const best = candidates[0];
      this.logger.debug(
        `Extracted invoice number: ${best.value} with confidence: ${best.confidence}`,
      );
      return best.value;
    }

    // Fallback: Look for common invoice number formats in filename
    const filenamePatterns = [
      /(INV[-\s_]?\d+)/i,
      /(\d{4}[-\s_]?[A-Z]{2,}[-\s_]?\d+)/i,
      /([A-Z]{2,}\d+)/i,
    ];

    for (const pattern of filenamePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (candidate.length >= 3 && candidate.length <= 50) {
          this.logger.debug(`Extracted invoice number from filename pattern: ${candidate}`);
          return candidate;
        }
      }
    }

    this.logger.warn('Could not extract invoice number from text');
    return undefined;
  }

  private extractAmount(text: string): number | undefined {
    // Look for currency amounts: $1,234.56, USD 1,234.56, ₹1,234.56, INR 1,234.56, Total: $1,234.56, etc.
    // Improved patterns with better accuracy and more comprehensive matching
    const patterns = [
      // Total/Amount/Balance/Due with currency symbols (highest priority)
      // More comprehensive labels - handle various formats
      /(?:total|amount|subtotal|balance|due|grand\s*total|invoice\s*amount|payable|charges|bill\s*amount|payment\s*amount|amount\s*due|balance\s*due|final\s*amount|net\s*amount)\s*(?:amount)?\s*:?\s*[₹$€£¥]?\s*([\d,]+\.?\d{1,2}?)/i,
      // Amount with label and colon/equals: "Total: $123.45" or "Amount = 123.45"
      /(?:total|amount|balance|due|payable)\s*[:=]\s*[₹$€£¥]?\s*([\d,]+\.?\d{1,2}?)/i,
      // Currency symbols: $, ₹, €, £, ¥ (with decimal places) - handle spaces
      /[₹$€£¥]\s*([\d,\s]+\.?\d{1,2}?)/,
      // Currency codes: USD, INR, EUR, GBP, CAD, etc. (with decimal places)
      /(?:USD|INR|EUR|GBP|CAD|AUD|JPY|CNY)\s*([\d,\s]+\.?\d{1,2}?)/i,
      // Indian Rupee formats: Rs. 1,234.56, Rs 1,234.56, ₹1,234.56
      /Rs\.?\s*([\d,\s]+\.?\d{1,2}?)/i,
      // Amount with "USD" or currency code after number
      /([\d,\s]+\.?\d{1,2}?)\s*(?:USD|INR|EUR|GBP|CAD|AUD)/i,
      // Decimal amounts with 2 decimal places (common invoice format)
      // Match larger amounts first (more likely to be totals)
      /([\d]{1,3}(?:[,\s]\d{3})*\.\d{2})\b/,
      // Amounts with commas/spaces and optional decimals: 1,234.56 or 1 234.56
      /([\d]{1,3}(?:[,\s]\d{3})+(?:\.\d{1,2})?)\b/,
      // Any number that looks like an amount (with commas/spaces and decimals)
      /([\d]{1,3}(?:[,\s]\d{3})*(?:\.\d{1,2})?)\b/,
      // Amounts without thousand separators but with decimals: 1234.56
      /([\d]{2,}\.\d{2})\b/,
      // Large numbers that might be amounts: 12345.67
      /([\d]{4,}\.\d{1,2})\b/,
    ];

    let bestMatch: { amount: number; confidence: number } | null = null;
    const seenAmounts = new Set<number>();

    for (const pattern of patterns) {
      try {
        const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
        for (const match of matches) {
          if (match && match[1]) {
            // Remove commas, spaces, and normalize
            const amountStr = match[1].replace(/[,\s]/g, '').trim();
            const amount = parseFloat(amountStr);

            if (!isNaN(amount) && amount > 0 && amount < 1000000000 && !seenAmounts.has(amount)) {
              seenAmounts.add(amount);

              // Higher confidence for amounts with currency indicators
              let confidence = 5;
              if (pattern.source.includes('total|amount|balance|due|payable|charges')) {
                confidence = 10; // Highest confidence for labeled amounts
              } else if (pattern.source.includes('[₹$€£¥]')) {
                confidence = 9; // High confidence for currency symbols
              } else if (pattern.source.includes('USD|INR|EUR')) {
                confidence = 8; // Good confidence for currency codes
              } else if (pattern.source.includes('\\.\\d{2}')) {
                confidence = 7; // Good confidence for decimal amounts
              }

              // Prefer larger amounts (likely to be totals, not line items)
              // But not too large (likely errors)
              if (amount >= 1 && amount <= 100000) {
                confidence += 1;
              } else if (amount > 100000) {
                confidence -= 2; // Penalize very large amounts
              }

              // Prefer amounts with 2 decimal places (more likely to be currency)
              if (amountStr.includes('.') && amountStr.split('.')[1]?.length === 2) {
                confidence += 1;
              }

              if (!bestMatch || confidence > bestMatch.confidence) {
                bestMatch = { amount, confidence };
              }
            }
          }
        }
      } catch (patternError) {
        this.logger.warn(`Error with pattern ${pattern.source}: ${patternError.message}`);
      }
    }

    if (bestMatch) {
      this.logger.debug(
        `Extracted amount: ${bestMatch.amount} with confidence: ${bestMatch.confidence}`,
      );
      return bestMatch.amount;
    }

    this.logger.warn('Could not extract amount from invoice text');
    this.logger.debug(`Text sample (first 500 chars): ${text.substring(0, 500)}`);
    return undefined;
  }

  private extractCurrency(text: string): string | undefined {
    // Always return USD - website uses dollars only
    // Still detect currency symbols for amount extraction, but always use USD
    if (text.includes('$') || text.toUpperCase().includes('USD')) {
      return 'USD';
    }
    // For other currencies, still return USD (amounts will be converted/treated as USD)
    return 'USD';
  }

  private extractProvider(text: string, filename: string): string | undefined {
    // Common provider names (expanded list)
    const providers = [
      'AWS',
      'Amazon Web Services',
      'Microsoft Azure',
      'Google Cloud',
      'GCP',
      'GitHub',
      'GitLab',
      'Stripe',
      'PayPal',
      'SendGrid',
      'Twilio',
      'MongoDB',
      'PostgreSQL',
      'MySQL',
      'Redis',
      'Elasticsearch',
      'Slack',
      'Discord',
      'Microsoft Teams',
      'Zoom',
      'ChatGPT',
      'OpenAI',
      'Anthropic',
      'Claude',
      'Orchids',
      'Cursor',
      'Figma',
      'Adobe',
      'Canva',
      'Notion',
      'Airtable',
      'Salesforce',
      'HubSpot',
      'Zendesk',
      'Intercom',
      'Vercel',
      'Netlify',
      'Heroku',
      'DigitalOcean',
      'Linode',
      'Cloudflare',
      'Fastly',
      'Akamai',
      'Datadog',
      'New Relic',
      'Sentry',
      'LogRocket',
      'Mixpanel',
      'Amplitude',
      'Segment',
    ];

    // Check filename first (highest priority)
    const filenameUpper = filename.toUpperCase();
    for (const provider of providers) {
      if (filenameUpper.includes(provider.toUpperCase())) {
        this.logger.debug(`Extracted provider from filename: ${provider}`);
        return provider;
      }
    }

    // Check text content for provider names
    const textUpper = text.toUpperCase();
    for (const provider of providers) {
      if (textUpper.includes(provider.toUpperCase())) {
        this.logger.debug(`Extracted provider from text: ${provider}`);
        return provider;
      }
    }

    // Try to extract from "From:" or "Vendor:" fields (improved patterns)
    const vendorPatterns = [
      /(?:from|vendor|supplier|company|billed\s*by|issued\s*by)\s*:?\s*([A-Z][A-Za-z0-9\s&\.\-]+)/i,
      /^([A-Z][A-Za-z0-9\s&\.\-]+)\s*(?:invoice|bill|statement|receipt)/i,
      /(?:invoice\s*from|billed\s*by)\s*:?\s*([A-Z][A-Za-z0-9\s&\.\-]+)/i,
    ];

    for (const pattern of vendorPatterns) {
      const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
      for (const match of matches) {
        if (match && match[1]) {
          const vendor = match[1].trim();
          // Filter out common false positives
          if (
            vendor.length > 2 &&
            vendor.length < 50 &&
            !vendor.toLowerCase().includes('invoice') &&
            !vendor.toLowerCase().includes('bill') &&
            !vendor.toLowerCase().includes('statement')
          ) {
            this.logger.debug(`Extracted provider from vendor pattern: ${vendor}`);
            return vendor;
          }
        }
      }
    }

    this.logger.warn('Could not extract provider from invoice text');
    return undefined;
  }

  private extractDate(text: string, type: 'billing' | 'due'): string | undefined {
    // Look for date patterns: MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
    const datePatterns = [
      // ISO format: YYYY-MM-DD
      /(\d{4}-\d{2}-\d{2})/,
      // US format: MM/DD/YYYY or M/D/YYYY
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      // European format: DD/MM/YYYY or D/M/YYYY
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      // Dash format: DD-MM-YYYY or MM-DD-YYYY or D-M-YYYY
      /(\d{1,2}-\d{1,2}-\d{4})/,
      // Dot format: DD.MM.YYYY or MM.DD.YYYY
      /(\d{1,2}\.\d{1,2}\.\d{4})/,
      // Month name: January 15, 2024 or Jan 15, 2024 or 15 January 2024
      /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
      /(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
      // Month name with dashes: 15-Jan-2024 or Jan-15-2024
      /(\d{1,2}[-/](?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/]\d{4})/i,
      /((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/]\d{1,2}[-/]\d{4})/i,
      // Short year format: DD/MM/YY or MM/DD/YY
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2})/,
    ];

    // Look for specific date labels (more comprehensive)
    // Handle cases where label and date might be on different lines or have various separators
    const labelPatterns = {
      billing: [
        // Date with label and various separators (handle :, =, or just space)
        /(?:invoice\s*date|billing\s*date|date\s*of\s*invoice|issue\s*date|invoice\s*issued|date\s*issued|bill\s*date|invoice\s*no\.?\s*date|invoice\s*#\s*date)\s*[:=\s]+\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /(?:invoice\s*date|billing\s*date|date\s*of\s*invoice|issue\s*date|invoice\s*issued|date\s*issued|bill\s*date)\s*[:=\s]+\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
        // Date with label and month names
        /(?:invoice\s*date|billing\s*date|date\s*of\s*invoice|issue\s*date)\s*[:=\s]+\s*((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
        /(?:invoice\s*date|billing\s*date|date\s*of\s*invoice|issue\s*date)\s*[:=\s]+\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
        // Handle label on one line, date on next (with newline)
        /(?:invoice\s*date|billing\s*date|date\s*of\s*invoice|issue\s*date)\s*[:=\s]*\s*\n\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ],
      due: [
        // Date with label and various separators
        /(?:due\s*date|payment\s*due|pay\s*by|due\s*by|payment\s*due\s*date|amount\s*due\s*by|payable\s*by|pay\s*on)\s*[:=\s]+\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /(?:due\s*date|payment\s*due|pay\s*by|due\s*by|payment\s*due\s*date|amount\s*due\s*by)\s*[:=\s]+\s*(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/i,
        // Date with label and month names
        /(?:due\s*date|payment\s*due|pay\s*by|due\s*by)\s*[:=\s]+\s*((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
        /(?:due\s*date|payment\s*due|pay\s*by|due\s*by)\s*[:=\s]+\s*(\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4})/i,
        // Handle label on one line, date on next (with newline)
        /(?:due\s*date|payment\s*due|pay\s*by|due\s*by)\s*[:=\s]*\s*\n\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ],
    };

    // First try label-specific patterns (highest priority)
    for (const pattern of labelPatterns[type]) {
      try {
        const match = text.match(pattern);
        if (match && match[1]) {
          const dateStr = this.normalizeDate(match[1]);
          if (dateStr) {
            this.logger.debug(`Extracted ${type} date: ${dateStr} using label pattern`);
            return dateStr;
          }
        }
      } catch (error) {
        this.logger.warn(`Error with date pattern ${pattern.source}: ${error.message}`);
      }
    }

    // Then try general date patterns (match all occurrences and pick the best one)
    const dateCandidates: Array<{ date: string; confidence: number }> = [];

    for (const pattern of datePatterns) {
      try {
        const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
        for (const match of matches) {
          if (match && match[1]) {
            const dateStr = this.normalizeDate(match[1]);
            if (dateStr) {
              // Higher confidence for ISO dates and dates with month names
              let confidence = 5;
              if (pattern.source.includes('\\d{4}-\\d{2}-\\d{2}')) {
                confidence = 8; // ISO format is reliable
              } else if (pattern.source.includes('January|February')) {
                confidence = 7; // Month names are reliable
              }

              dateCandidates.push({ date: dateStr, confidence });
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Error with date pattern ${pattern.source}: ${error.message}`);
      }
    }

    // Return the date with highest confidence, or first valid date if all equal
    if (dateCandidates.length > 0) {
      dateCandidates.sort((a, b) => b.confidence - a.confidence);
      const bestDate = dateCandidates[0].date;
      this.logger.debug(
        `Extracted ${type} date: ${bestDate} using general pattern (confidence: ${dateCandidates[0].confidence})`,
      );
      return bestDate;
    }

    this.logger.debug(`Could not extract ${type} date from text`);
    this.logger.debug(`Text sample (first 500 chars): ${text.substring(0, 500)}`);
    return undefined;
  }

  private normalizeDate(dateStr: string): string | undefined {
    try {
      // Handle different date formats
      let date: Date;
      const cleaned = dateStr.trim();

      // Handle month name formats: "January 15, 2024" or "Jan 15, 2024"
      const monthNamePattern =
        /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i;
      const monthMatch = cleaned.match(monthNamePattern);
      if (monthMatch) {
        const monthNames: Record<string, number> = {
          january: 0,
          jan: 0,
          february: 1,
          feb: 1,
          march: 2,
          mar: 2,
          april: 3,
          apr: 3,
          may: 4,
          june: 5,
          jun: 5,
          july: 6,
          jul: 6,
          august: 7,
          aug: 7,
          september: 8,
          sep: 8,
          october: 9,
          oct: 9,
          november: 10,
          nov: 10,
          december: 11,
          dec: 11,
        };
        const month = monthNames[monthMatch[1].toLowerCase()];
        const day = parseInt(monthMatch[2], 10);
        const year = parseInt(monthMatch[3], 10);
        if (month !== undefined && !isNaN(day) && !isNaN(year)) {
          date = new Date(year, month, day);
        } else {
          date = new Date(cleaned);
        }
      } else if (cleaned.includes('-')) {
        // ISO format or DD-MM-YYYY or MM-DD-YYYY
        const parts = cleaned.split('-').map((p) => p.trim());
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            date = new Date(cleaned);
          } else {
            // Handle 2-digit years
            let year = parseInt(parts[2], 10);
            if (year < 100) {
              year = year < 50 ? 2000 + year : 1900 + year;
            }

            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);

            // If day > 12, it's DD-MM-YYYY, otherwise try both
            if (day > 12 && day <= 31) {
              // DD-MM-YYYY
              date = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            } else {
              // Try MM-DD-YYYY first, then DD-MM-YYYY
              date = new Date(`${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
              if (isNaN(date.getTime())) {
                date = new Date(
                  `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`,
                );
              }
            }
          }
        } else {
          date = new Date(cleaned);
        }
      } else if (cleaned.includes('/')) {
        // MM/DD/YYYY or DD/MM/YYYY
        const parts = cleaned.split('/').map((p) => p.trim());
        if (parts.length === 3) {
          // Handle 2-digit years (assume 20xx if < 50, else 19xx)
          let year = parseInt(parts[2], 10);
          if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year;
          }

          if (parts[0].length <= 2 && parts[1].length <= 2) {
            // Try DD/MM/YYYY first (common in India/Europe), then MM/DD/YYYY
            // If day > 12, it's definitely DD/MM/YYYY
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);

            if (day > 12 && day <= 31) {
              // Definitely DD/MM/YYYY
              date = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            } else if (month > 12 && month <= 31) {
              // Definitely MM/DD/YYYY (swapped)
              date = new Date(`${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
            } else {
              // Ambiguous - try DD/MM/YYYY first (more common internationally)
              date = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
              // If invalid, try MM/DD/YYYY
              if (isNaN(date.getTime()) || date.getDate() !== day) {
                date = new Date(
                  `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`,
                );
              }
            }
          } else {
            date = new Date(cleaned);
          }
        } else {
          date = new Date(cleaned);
        }
      } else if (cleaned.includes('.')) {
        // DD.MM.YYYY or MM.DD.YYYY (dot format)
        const parts = cleaned.split('.').map((p) => p.trim());
        if (parts.length === 3) {
          let year = parseInt(parts[2], 10);
          if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year;
          }

          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);

          if (day > 12 && day <= 31) {
            // DD.MM.YYYY
            date = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          } else {
            // Try MM.DD.YYYY first, then DD.MM.YYYY
            date = new Date(`${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
            if (isNaN(date.getTime())) {
              date = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            }
          }
        } else {
          date = new Date(cleaned);
        }
      } else {
        date = new Date(cleaned);
      }

      if (isNaN(date.getTime())) {
        this.logger.warn(`Invalid date: ${dateStr}`);
        return undefined;
      }

      // Validate date is reasonable (not too far in past/future)
      const now = new Date();
      const year = date.getFullYear();
      if (year < 2000 || year > 2100) {
        this.logger.warn(`Date out of reasonable range: ${dateStr} (year: ${year})`);
        return undefined;
      }

      // Return in YYYY-MM-DD format
      const normalized = date.toISOString().split('T')[0];
      this.logger.debug(`Normalized date: ${dateStr} -> ${normalized}`);
      return normalized;
    } catch (error) {
      this.logger.warn(`Error normalizing date ${dateStr}: ${error.message}`);
      return undefined;
    }
  }

  private extractCategory(text: string, provider?: string): string | undefined {
    // Map providers to categories
    const categoryMap: Record<string, string> = {
      AWS: 'Cloud Services',
      'Amazon Web Services': 'Cloud Services',
      'Microsoft Azure': 'Cloud Services',
      'Google Cloud': 'Cloud Services',
      GCP: 'Cloud Services',
      GitHub: 'Development Tools',
      GitLab: 'Development Tools',
      ChatGPT: 'AI Tools',
      OpenAI: 'AI Tools',
      Anthropic: 'AI Tools',
      Claude: 'AI Tools',
      Orchids: 'AI Tools',
      Cursor: 'Development Tools',
      'GitHub Copilot': 'Development Tools',
      Stripe: 'Payment Processing',
      PayPal: 'Payment Processing',
      SendGrid: 'Email Services',
      Twilio: 'Communication',
      Slack: 'Communication',
      Discord: 'Communication',
      MongoDB: 'Database Services',
      PostgreSQL: 'Database Services',
      MySQL: 'Database Services',
      Figma: 'Design Tools',
      Adobe: 'Design Tools',
      Canva: 'Design Tools',
    };

    if (provider) {
      for (const [key, category] of Object.entries(categoryMap)) {
        if (provider.toUpperCase().includes(key.toUpperCase())) {
          return category;
        }
      }
    }

    // Try to find category keywords in text
    const categoryKeywords: Record<string, string[]> = {
      'Cloud Services': ['cloud', 'aws', 'azure', 'gcp', 'infrastructure'],
      'Development Tools': ['development', 'devops', 'ci-cd', 'github', 'gitlab'],
      'AI Tools': ['ai', 'artificial intelligence', 'machine learning', 'ml'],
      'Payment Processing': ['payment', 'stripe', 'paypal', 'billing'],
      'Email Services': ['email', 'sendgrid', 'mail'],
      Communication: ['slack', 'discord', 'messaging', 'chat'],
      'Database Services': ['database', 'db', 'mongodb', 'postgresql'],
      'Design Tools': ['design', 'figma', 'adobe', 'creative'],
    };

    const textLower = text.toLowerCase();
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) {
          return category;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract text from image using OCR (Tesseract.js)
   */
  private async extractTextWithOCR(imageBuffer: Buffer): Promise<string> {
    try {
      const worker = await createWorker('eng');
      const {
        data: { text },
      } = await worker.recognize(imageBuffer);
      await worker.terminate();
      return text;
    } catch (error) {
      this.logger.error(`OCR extraction failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Parse invoice text using OpenAI for better extraction
   */
  private async parseWithOpenAI(
    text: string,
    filename: string,
  ): Promise<{
    invoiceNumber?: string;
    amount?: number;
    currency?: string;
    provider?: string;
    billingDate?: string;
    dueDate?: string;
    category?: string;
  }> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const prompt = `You are an expert invoice parser. Extract the following information from this invoice text and return ONLY a valid JSON object.

REQUIRED FIELDS (use null if not found):
{
  "invoiceNumber": "string or null",
  "amount": number (not string, no quotes),
  "currency": "USD" (always USD),
  "provider": "string or null",
  "billingDate": "YYYY-MM-DD format or null",
  "dueDate": "YYYY-MM-DD format or null",
  "category": "string or null"
}

CRITICAL EXTRACTION RULES:

1. AMOUNT (MOST IMPORTANT):
   - Look for: "Total", "Amount", "Balance", "Due", "Grand Total", "Invoice Amount", "Payable", "Amount Due"
   - Extract the LARGEST amount if multiple found (this is usually the total)
   - Remove ALL currency symbols ($, ₹, €, £, ¥) and commas
   - Convert to pure number: "₹1,234.56" → 1234.56, "$5,000.00" → 5000.00
   - Handle formats: "1,234.56", "1234.56", "1 234.56", "$1,234.56", "USD 1,234.56"
   - Amount MUST be a number (not string) in JSON
   - If multiple amounts found, choose the one labeled as "Total", "Amount Due", or "Grand Total"

2. DATES (CRITICAL):
   - Billing Date: Look for "Invoice Date", "Billing Date", "Date of Invoice", "Issue Date", "Bill Date", "Invoice Issued"
   - Due Date: Look for "Due Date", "Payment Due", "Pay By", "Due By", "Payment Due Date", "Amount Due By"
   - Accept formats: "12/20/2024", "20/12/2024", "2024-12-20", "December 20, 2024", "20-Dec-2024", "12.20.2024"
   - Convert ALL dates to YYYY-MM-DD format
   - For ambiguous dates (12/20/2024), prefer DD/MM/YYYY if day > 12, otherwise try both formats
   - If year is 2 digits (24), assume 2024 if < 50, else 1924
   - Dates must be valid calendar dates

3. INVOICE NUMBER:
   - Look for: "Invoice Number", "Invoice #", "Invoice No", "Bill Number", "Reference", "Invoice ID"
   - Patterns: INV-2024-001, #12345, BILL-001, etc.

4. PROVIDER:
   - Extract company/vendor name from "From:", "Vendor:", "Billed By:", or invoice header
   - Common providers: AWS, Azure, Google Cloud, GitHub, Stripe, etc.

5. CURRENCY:
   - Always return "USD" regardless of invoice currency

Invoice Text:
${text.substring(0, 6000)} ${text.length > 6000 ? '... (truncated)' : ''}

Filename: ${filename}

Return ONLY valid JSON. No explanations, no markdown, just the JSON object.`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini', // Using cheaper model, can be changed to gpt-4 for better accuracy
        messages: [
          {
            role: 'system',
            content:
              'You are an expert invoice parser. Extract invoice data with high accuracy, especially for amounts and dates. Always return valid JSON only. Amount must be a number (not string). Dates must be in YYYY-MM-DD format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0, // Zero temperature for maximum consistency
        max_tokens: 800, // Increased for more detailed responses
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);

      // Normalize the response
      const result: any = {};
      if (parsed.invoiceNumber) {
        // Clean up the invoice number - remove extra whitespace and normalize
        const cleaned = String(parsed.invoiceNumber).trim().replace(/\s+/g, '-');
        if (cleaned.length >= 3 && cleaned.length <= 50) {
          result.invoiceNumber = cleaned;
        }
      }

      // Ensure amount is a valid number
      if (parsed.amount !== null && parsed.amount !== undefined) {
        let amountValue: number;

        if (typeof parsed.amount === 'number') {
          amountValue = parsed.amount;
        } else if (typeof parsed.amount === 'string') {
          // Remove currency symbols, commas, and whitespace
          const cleaned = parsed.amount.replace(/[₹$€£¥,\s]/g, '').trim();
          amountValue = parseFloat(cleaned);
        } else {
          amountValue = parseFloat(String(parsed.amount).replace(/[₹$€£¥,\s]/g, ''));
        }

        if (
          !isNaN(amountValue) &&
          isFinite(amountValue) &&
          amountValue > 0 &&
          amountValue < 1000000000
        ) {
          // Round to 2 decimal places
          result.amount = Math.round(amountValue * 100) / 100;
        } else {
          this.logger.warn(`Invalid amount extracted: ${parsed.amount}, skipping`);
        }
      }

      if (parsed.currency) {
        const currency = String(parsed.currency).toUpperCase().trim();
        // Validate currency code
        const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY'];
        if (validCurrencies.includes(currency)) {
          result.currency = currency;
        } else {
          // Default to USD
          result.currency = 'USD';
        }
      } else {
        // Default to USD if no currency detected
        result.currency = 'USD';
      }
      if (parsed.provider) {
        result.provider = String(parsed.provider).trim();
      }

      // Normalize dates - OpenAI should return YYYY-MM-DD, but normalize just in case
      if (parsed.billingDate) {
        const normalized = this.normalizeDate(String(parsed.billingDate));
        if (normalized) {
          result.billingDate = normalized;
        } else {
          // If normalization failed, try to use as-is if it's already in YYYY-MM-DD format
          const dateStr = String(parsed.billingDate).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            result.billingDate = dateStr;
          } else {
            this.logger.warn(`Could not normalize billing date from OpenAI: ${dateStr}`);
          }
        }
      }

      if (parsed.dueDate) {
        const normalized = this.normalizeDate(String(parsed.dueDate));
        if (normalized) {
          result.dueDate = normalized;
        } else {
          // If normalization failed, try to use as-is if it's already in YYYY-MM-DD format
          const dateStr = String(parsed.dueDate).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            result.dueDate = dateStr;
          } else {
            this.logger.warn(`Could not normalize due date from OpenAI: ${dateStr}`);
          }
        }
      }

      if (parsed.category) {
        result.category = String(parsed.category).trim();
      }

      return result;
    } catch (error) {
      this.logger.error(`OpenAI parsing error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
