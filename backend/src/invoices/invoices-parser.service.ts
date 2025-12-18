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
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
            const loadingTask = pdfjsLib.getDocument({ 
              data: file.buffer,
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
                // Better text extraction - preserve line breaks and structure
                const pageText = content.items
                  .map((item: any) => {
                    // Handle text items with proper spacing
                    if (item.str) {
                      return item.str;
                    }
                    return '';
                  })
                  .join(' ')
                  .replace(/\s+/g, ' ') // Normalize whitespace
                  .trim();
                
                extractedText += pageText + '\n\n';
              } catch (pageError) {
                this.logger.warn(`Error extracting page ${i}: ${pageError.message}`);
              }
            }
            
            // Clean and normalize the extracted text
            text = extractedText
              .replace(/\s+/g, ' ') // Normalize multiple spaces
              .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
              .trim();
            
            this.logger.debug(`Extracted ${text.length} characters from PDF (${pagesToExtract} pages)`);
            
            // If text extraction is too short, log a warning
            if (text.length < 50) {
              this.logger.warn(`PDF text extraction seems incomplete (only ${text.length} chars). The PDF might be image-based or encrypted.`);
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
      text = text
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines
        .replace(/\s+/g, ' ') // Normalize multiple spaces
        .trim();

      // Always include filename in text for provider detection (add as separate line)
      text = `${text}\n\nFilename: ${file.originalname}`;

      this.logger.debug(`Processing text (${text.length} chars) for invoice extraction`);

      // Try OpenAI parsing first if available, otherwise use regex
      if (this.openaiClient && text.length > 50) {
        try {
          this.logger.debug('Attempting OpenAI-powered parsing');
          const aiExtracted = await this.parseWithOpenAI(text, file.originalname);
          // Merge AI results with regex fallback
          extractedData.invoiceNumber =
            aiExtracted.invoiceNumber || this.extractInvoiceNumber(text);

          // Ensure amount is a valid number
          const aiAmount = aiExtracted.amount;
          const regexAmount = this.extractAmount(text);
          if (aiAmount !== null && aiAmount !== undefined) {
            const numAmount =
              typeof aiAmount === 'number' ? aiAmount : parseFloat(String(aiAmount));
            if (!isNaN(numAmount) && isFinite(numAmount) && numAmount > 0) {
              extractedData.amount = Math.round(numAmount * 100) / 100;
            } else if (regexAmount) {
              extractedData.amount = regexAmount;
            }
          } else if (regexAmount) {
            extractedData.amount = regexAmount;
          }

          extractedData.currency = 'USD'; // Always use USD
          extractedData.provider =
            aiExtracted.provider || this.extractProvider(text, file.originalname);
          extractedData.billingDate = aiExtracted.billingDate || this.extractDate(text, 'billing');
          extractedData.dueDate = aiExtracted.dueDate || this.extractDate(text, 'due');
          extractedData.category =
            aiExtracted.category || this.extractCategory(text, extractedData.provider);
          this.logger.debug('OpenAI parsing completed');
        } catch (error) {
          this.logger.warn(`OpenAI parsing failed, using regex fallback: ${error.message}`);
          // Fallback to regex extraction
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
            candidate.length >= 3 &&
            candidate.length <= 50 &&
            !/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(candidate) && // Not a date
            !/^\$?[\d,]+\.?\d*$/.test(candidate) && // Not an amount
            !/^\d{4}-\d{2}-\d{2}$/.test(candidate) && // Not ISO date
            !/^[A-Z]{3}$/.test(candidate) && // Not a currency code
            !/^\d+$/.test(candidate) || candidate.length > 6 // Not just numbers (unless long)
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
      this.logger.debug(`Extracted invoice number: ${best.value} with confidence: ${best.confidence}`);
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
      // More comprehensive labels
      /(?:total|amount|subtotal|balance|due|grand\s*total|invoice\s*amount|payable|charges|bill\s*amount|payment\s*amount|amount\s*due|balance\s*due)\s*(?:amount)?\s*:?\s*[₹$€£¥]?\s*([\d,]+\.?\d{2}?)/i,
      // Currency symbols: $, ₹, €, £, ¥ (with decimal places)
      /[₹$€£¥]\s*([\d,]+\.?\d{2}?)/,
      // Currency codes: USD, INR, EUR, GBP, CAD, etc. (with decimal places)
      /(?:USD|INR|EUR|GBP|CAD|AUD|JPY|CNY)\s*([\d,]+\.?\d{2}?)/i,
      // Indian Rupee formats: Rs. 1,234.56, Rs 1,234.56, ₹1,234.56
      /Rs\.?\s*([\d,]+\.?\d{2}?)/i,
      // Amount with "USD" or currency code after number
      /([\d,]+\.?\d{2}?)\s*(?:USD|INR|EUR|GBP|CAD|AUD)/i,
      // Decimal amounts with 2 decimal places (common invoice format)
      // Match larger amounts first (more likely to be totals)
      /([\d]{1,3}(?:,\d{3})*\.\d{2})\b/,
      // Amounts with commas and optional decimals
      /([\d]{1,3}(?:,\d{3})+(?:\.\d{1,2})?)\b/,
      // Any number that looks like an amount (with commas and decimals)
      /([\d]{1,3}(?:,\d{3})*(?:\.\d{2})?)\b/,
    ];

    let bestMatch: { amount: number; confidence: number } | null = null;
    const seenAmounts = new Set<number>();

    for (const pattern of patterns) {
      try {
        const matches = text.matchAll(new RegExp(pattern.source, pattern.flags + 'g'));
        for (const match of matches) {
          if (match && match[1]) {
            const amountStr = match[1].replace(/,/g, '').trim();
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
      // US format: MM/DD/YYYY
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      // European format: DD/MM/YYYY
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      // Dash format: DD-MM-YYYY or MM-DD-YYYY
      /(\d{1,2}-\d{1,2}-\d{4})/,
      // Month name: January 15, 2024 or Jan 15, 2024
      /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/i,
      // Month name with dashes: 15-Jan-2024
      /(\d{1,2}[-/](?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[-/]\d{4})/i,
    ];

    // Look for specific date labels (more comprehensive)
    const labelPatterns = {
      billing: [
        /(?:invoice\s*date|billing\s*date|date\s*of\s*invoice|issue\s*date|invoice\s*issued|date\s*issued|bill\s*date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(?:invoice\s*date|billing\s*date|date\s*of\s*invoice|issue\s*date|invoice\s*issued|date\s*issued|bill\s*date)\s*:?\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
        /(?:invoice\s*date|billing\s*date|date\s*of\s*invoice|issue\s*date)\s*:?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
      ],
      due: [
        /(?:due\s*date|payment\s*due|pay\s*by|due\s*by|payment\s*due\s*date|amount\s*due\s*by)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /(?:due\s*date|payment\s*due|pay\s*by|due\s*by|payment\s*due\s*date|amount\s*due\s*by)\s*:?\s*(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/i,
        /(?:due\s*date|payment\s*due|pay\s*by|due\s*by)\s*:?\s*((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4})/i,
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

    // Then try general date patterns
    for (const pattern of datePatterns) {
      try {
        const match = text.match(pattern);
        if (match && match[1]) {
          const dateStr = this.normalizeDate(match[1]);
          if (dateStr) {
            this.logger.debug(`Extracted ${type} date: ${dateStr} using general pattern`);
            return dateStr;
          }
        }
      } catch (error) {
        this.logger.warn(`Error with date pattern ${pattern.source}: ${error.message}`);
      }
    }

    this.logger.debug(`Could not extract ${type} date from text`);
    return undefined;
  }

  private normalizeDate(dateStr: string): string | undefined {
    try {
      // Handle different date formats
      let date: Date;
      const cleaned = dateStr.trim();

      // Handle month name formats: "January 15, 2024" or "Jan 15, 2024"
      const monthNamePattern = /(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})/i;
      const monthMatch = cleaned.match(monthNamePattern);
      if (monthMatch) {
        const monthNames: Record<string, number> = {
          january: 0, jan: 0,
          february: 1, feb: 1,
          march: 2, mar: 2,
          april: 3, apr: 3,
          may: 4,
          june: 5, jun: 5,
          july: 6, jul: 6,
          august: 7, aug: 7,
          september: 8, sep: 8,
          october: 9, oct: 9,
          november: 10, nov: 10,
          december: 11, dec: 11,
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
        // ISO format or DD-MM-YYYY
        const parts = cleaned.split('-');
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          date = new Date(cleaned);
        } else {
          // DD-MM-YYYY -> YYYY-MM-DD
          date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
      } else if (cleaned.includes('/')) {
        // MM/DD/YYYY or DD/MM/YYYY
        const parts = cleaned.split('/');
        if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
          // Try DD/MM/YYYY first (common in India/Europe), then MM/DD/YYYY
          // If day > 12, it's definitely DD/MM/YYYY
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10);

          if (day > 12) {
            // Definitely DD/MM/YYYY
            date = new Date(
              `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`,
            );
          } else if (month > 12) {
            // Definitely MM/DD/YYYY
            date = new Date(
              `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`,
            );
          } else {
            // Ambiguous - try DD/MM/YYYY first (more common internationally)
            date = new Date(
              `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`,
            );
            // If invalid, try MM/DD/YYYY
            if (isNaN(date.getTime())) {
              date = new Date(
                `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`,
              );
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

    const prompt = `Extract invoice information from the following text. Return a JSON object with these fields: invoiceNumber, amount (as number, not string), currency, provider, billingDate (YYYY-MM-DD format), dueDate (YYYY-MM-DD format), category.

IMPORTANT:
- For invoiceNumber, look for patterns like: INV-2024-001, Invoice #12345, Bill Number: BILL-001, etc.
- For amount: Extract as a NUMBER (not string), remove currency symbols and commas. Example: "₹1,234.56" should be 1234.56
- For currency: Always use USD. The website uses dollars only.
- Amount must be a valid positive number with up to 2 decimal places.

Text to parse:
${text.substring(0, 4000)} ${text.length > 4000 ? '...' : ''}

Filename: ${filename}

Return only valid JSON, no additional text. If a field cannot be determined, use null for that field.`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini', // Using cheaper model, can be changed to gpt-4 for better accuracy
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at extracting structured data from invoices. Always return valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 500,
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
      if (parsed.provider) result.provider = String(parsed.provider);
      if (parsed.billingDate)
        result.billingDate =
          this.normalizeDate(String(parsed.billingDate)) || String(parsed.billingDate);
      if (parsed.dueDate)
        result.dueDate = this.normalizeDate(String(parsed.dueDate)) || String(parsed.dueDate);
      if (parsed.category) result.category = String(parsed.category);

      return result;
    } catch (error) {
      this.logger.error(`OpenAI parsing error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
