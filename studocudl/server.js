const express = require('express');
const puppeteerExtra = require('puppeteer-extra'); // NEW: For stealth
const StealthPlugin = require('puppeteer-extra-plugin-stealth'); // NEW: Stealth plugin
const cors = require('cors');
const { EventEmitter } = require('events');

puppeteerExtra.use(StealthPlugin()); // NEW: Enable stealth plugin

const app = express();
const port = 7860;

app.use(cors());
app.use(express.json());

// --- Progress Tracking and Job Storage --- (Unchanged)
const progressTrackers = new Map();
const downloadJobs = new Map();

class ProgressTracker extends EventEmitter {
    constructor(sessionId) {
        super();
        this.sessionId = sessionId;
        this.progress = 0;
        this.status = 'initializing';
        this.message = '';
    }

    updateProgress(progress, status, message) {
        this.progress = progress;
        this.status = status;
        this.message = message;
        const update = {
            sessionId: this.sessionId,
            progress,
            status,
            message,
            timestamp: new Date().toISOString()
        };
        this.emit('progress', update);
        console.log(`📊 [${this.sessionId}] ${progress}% - ${status}: ${message}`);
    }
}

// --- Puppeteer Logic (Updated for Stealth and Reliability) ---
const bypassCookiesAndRestrictions = async (page, progressTracker) => {
    progressTracker?.updateProgress(5, 'bypassing', 'Setting up cookie bypass...');

    console.log("🍪 Starting comprehensive cookie and restriction bypass...");
    // Step 1: Set cookies before page load
    const preCookies = [
        { name: 'cookieConsent', value: 'accepted', domain: '.studocu.com' },
        { name: 'cookie_consent', value: 'true', domain: '.studocu.com' },
        { name: 'gdpr_consent', value: 'accepted', domain: '.studocu.com' },
        { name: 'privacy_policy_accepted', value: 'true', domain: '.studocu.com' },
        { name: 'user_consent', value: '1', domain: '.studocu.com' },
        { name: 'analytics_consent', value: 'false', domain: '.studocu.com' },
        { name: 'marketing_consent', value: 'false', domain: '.studocu.com' },
        { name: 'functional_consent', value: 'true', domain: '.studocu.com' },
    ];
    for (const cookie of preCookies) {
        try {
            await page.setCookie(cookie);
        } catch (e) {
            console.log(`Failed to set cookie ${cookie.name}:`, e.message);
        }
    }

    // Step 2: Inject CSS to hide cookie banners immediately (Unchanged)
    await page.addStyleTag({
        content: `
            /* Hide all possible cookie banners */
            [id*="cookie" i]:not(img):not(input), [class*="cookie" i]:not(img):not(input), [data-testid*="cookie" i], [aria-label*="cookie" i],
            .gdpr-banner, .gdpr-popup, .gdpr-modal, .consent-banner, .consent-popup, .consent-modal, .privacy-banner, .privacy-popup, .privacy-modal,
            .cookie-law, .cookie-policy, .cookie-compliance, .onetrust-banner-sdk, #onetrust-consent-sdk, .cmp-banner, .cmp-popup, .cmp-modal,
            [class*="CookieBanner"], [class*="CookieNotice"], [class*="ConsentBanner"], [class*="ConsentManager"], .cc-banner, .cc-window, .cc-compliance,
            div[style*="position: fixed"]:has-text("cookie"), div[style*="position: fixed"]:has-text("consent"), .fixed:has-text("cookie"), .fixed:has-text("consent") {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                z-index: -9999 !important;
                pointer-events: none !important;
            }
            /* Remove blur and premium overlays */
            [class*="blur" i], [class*="premium" i], [class*="paywall" i], [class*="sample-preview-blur" i] {
                filter: none !important;
                backdrop-filter: none !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            /* Ensure document content is visible */
            .document-content, .page-content, [data-page] {
                filter: none !important;
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
            }
            /* Remove fixed overlays */
            .fixed-overlay, .sticky-overlay, .content-overlay {
                display: none !important;
            }
            /* Restore scrolling */
            html, body {
                overflow: auto !important;
                position: static !important;
            }
        `
    });

    // Step 3: Inject JavaScript to handle dynamic cookie banners (Unchanged)
    await page.evaluateOnNewDocument(() => {
        // Override common cookie consent functions
        window.cookieConsent = { accepted: true };
        window.gtag = () => { };
        window.ga = () => { };
        window.dataLayer = [];

        // Mutation observer to catch dynamically added cookie banners
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        const element = node;
                        const text = element.textContent || '';
                        const className = element.className || '';
                        const id = element.id || '';
                        // Check if this looks like a cookie banner
                        if (
                            text.toLowerCase().includes('cookie') ||
                            text.toLowerCase().includes('consent') ||
                            text.toLowerCase().includes('privacy policy') ||
                            className.toLowerCase().includes('cookie') ||
                            className.toLowerCase().includes('consent') ||
                            className.toLowerCase().includes('gdpr') ||
                            id.toLowerCase().includes('cookie') ||
                            id.toLowerCase().includes('consent')
                        ) {
                            console.log('Removing detected cookie banner:', element);
                            element.remove();
                        }
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Set up periodic cleanup
        setInterval(() => {
            const cookieElements = document.querySelectorAll(`
                [id*="cookie" i]:not(img):not(input), [class*="cookie" i]:not(img):not(input), [data-testid*="cookie" i],
                .gdpr-banner, .consent-banner, .privacy-banner, .onetrust-banner-sdk, #onetrust-consent-sdk,
                .cmp-banner, .cc-banner
            `);
            cookieElements.forEach(el => el.remove());
            // Restore body scroll
            document.body.style.overflow = 'auto';
            document.documentElement.style.overflow = 'auto';
        }, 1000);
    });

    progressTracker?.updateProgress(10, 'bypassing', 'Cookie bypass configured successfully');
    return true;
};

const unblurContent = async (page, progressTracker) => {
    progressTracker?.updateProgress(15, 'unblurring', 'Removing content restrictions...');

    console.log("🔓 Unblurring content and bypassing premium restrictions...");
    await page.evaluate(() => {
        const removeRestrictions = () => {
            const removeBySelector = (selector) => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            };

            removeBySelector("#adbox, .adsbox, .ad-box, .banner-ads, .advert");
            removeBySelector(".PremiumBannerBlobWrapper_overflow-wrapper__xsaS8");

            const removeBlur = (element = document) => {
                element.querySelectorAll("*").forEach(el => {
                    const style = window.getComputedStyle(el);
                    if (
                        style.filter?.includes("blur") ||
                        style.backdropFilter?.includes("blur") ||
                        parseFloat(style.opacity) < 1 ||
                        (el.className && el.className.toString().toLowerCase().includes("blur")) ||
                        (el.className && el.className.toString().toLowerCase().includes("premium"))
                    ) {
                        el.style.filter = "none !important";
                        el.style.backdropFilter = "none !important";
                        el.style.opacity = "1 !important";
                        if (el.classList) {
                            el.classList.remove("blur", "blurred", "premium-blur");
                        }
                    }
                });
            };

            removeBlur();
            removeBySelector('[class*="blur" i], [class*="premium" i], [class*="paywall" i]');

            const contentSelectors = [
                '.document-content', '.page-content', '.content', '[data-page]', '[data-testid*="document"]',
                '[data-testid*="page"]', '.page', '.document-page', 'main', 'article'
            ];
            contentSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.setProperty('filter', 'none', 'important');
                    el.style.setProperty('opacity', '1', 'important');
                    el.style.setProperty('visibility', 'visible', 'important');
                    el.style.setProperty('display', 'block', 'important');
                    el.style.setProperty('pointer-events', 'auto', 'important');
                });
            });
        };

        removeRestrictions();
        const intervalId = setInterval(removeRestrictions, 1000); // Reduced from 2000ms to 1000ms
        setTimeout(() => clearInterval(intervalId), 30000); // Reduced from 60000ms to 30000ms
    });

    progressTracker?.updateProgress(20, 'unblurring', 'Content restrictions removed');
};

const applyPrintStyles = async (page, progressTracker) => {
    progressTracker?.updateProgress(85, 'styling', 'Applying print styles...');

    console.log("🖨️ Applying print styles for clean PDF...");
    await page.evaluate(() => {
        const style = document.createElement("style");
        style.id = "print-style-extension";
        style.innerHTML = `
            @page {
                /* Set page size to A4 and remove default margins */
                size: A4 portrait;
                margin: 0mm; 
            }
            @media print {
                html, body {
                    /* Ensure the body takes the full width and has no extra padding/margin */
                    width: 210mm !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    background: white !important;
                    color: black !important;
                }
                /* Remove all unwanted elements like headers, footers, sidebars, etc. */
                header, footer, nav, aside, .no-print, .ads, .sidebar, .premium-banner,
                [class*="Header"], [class*="Footer"], [class*="Sidebar"], [id*="Header"],
                .ViewerToolbar, .Layout_info-bar-wrapper__He0Ho, .Sidebar_sidebar-scrollable__kqeBZ,
                .HeaderWrapper_header-wrapper__mCmf3, .Layout_visible-content-bottom-wrapper-sticky__yaaAB,
                .Layout_bottom-section-wrapper__yBWWk, .Layout_footer-wrapper__bheJQ,
                .InlineBanner_inline-banner-wrapper__DAi5X, .banner-wrapper, #top-bar-wrapper,
                .Layout_sidebar-wrapper__unavM, .Layout_is-open__9DQr4 {
                    display: none !important;
                }
                /* Force all elements to have a transparent background and no shadow */
                * {
                    box-shadow: none !important;
                    background: transparent !important;
                    color: inherit !important;
                }
                /*
                 * KEY FIX: Target the main document container.
                 * Force it to be a block element, remove any transforms or max-widths,
                 * and center it perfectly within the page.
                 */
                .Viewer_document-wrapper__JPBWQ, .Viewer_document-wrapper__LXzoQ, 
                .Viewer_document-wrapper__XsO4j, .page-content, .document-viewer, #page-container {
                    position: static !important;
                    display: block !important;
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box; /* Include padding in width calculation */
                    transform: none !important;
                }
                /* Ensure individual pages and images within the document use the full width */
                [data-page], .page, .document-page, img {
                    page-break-after: always !important;
                    page-break-inside: avoid !important;
                    page-break-before: avoid !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    height: auto !important;
                    display: block !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
            }
        `;
        document.head.appendChild(style);
    });

    progressTracker?.updateProgress(88, 'styling', 'Print styles applied successfully');
};

const studocuDownloader = async (url, options = {}, progressTracker = null) => {
    let browser;
    try {
        progressTracker?.updateProgress(0, 'initializing', 'Starting browser...');

        console.log("🚀 Launching browser with enhanced stealth configuration...");
        browser = await puppeteerExtra.launch({ // UPDATED: Use puppeteerExtra
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-ipc-flooding-protection',
                '--disable-web-security',
                '--disable-features=site-per-process',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions',
                '--ignore-certificate-errors'
            ],
            ignoreHTTPSErrors: true,
            timeout: 300000,
        });

        const page = await browser.newPage();

        progressTracker?.updateProgress(2, 'initializing', 'Configuring browser settings...');

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36');
        await page.setViewport({ width: 794, height: 1122 }); // A4 size in pixels at 96 DPI

        // NOTE: Stealth plugin handles most of this, but keeping for extra safety
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        });

        // Set up cookie and content bypass
        await bypassCookiesAndRestrictions(page, progressTracker);

        // Block unnecessary resources (UPDATED: Block more aggressively, including scripts, fonts, and stylesheets if not critical)
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            const reqUrl = req.url().toLowerCase();

            if (resourceType === 'document') {
                req.continue();
                return;
            }

            if (
                ['image', 'media', 'font', 'stylesheet'].includes(resourceType) && // Block non-essential images/media/fonts/styles early if not core
                !reqUrl.includes('document') && !reqUrl.includes('page') && !reqUrl.includes('studocu') || // Allow core document images
                resourceType === 'script' && !reqUrl.includes('studocu') || // Block third-party scripts
                reqUrl.includes('doubleclick') ||
                reqUrl.includes('googletagmanager') ||
                reqUrl.includes('facebook.com') ||
                reqUrl.includes('twitter.com') ||
                reqUrl.includes('analytics') ||
                reqUrl.includes('gtm') ||
                reqUrl.includes('hotjar') ||
                reqUrl.includes('mixpanel') ||
                reqUrl.includes('onetrust') ||
                reqUrl.includes('cookielaw') ||
                (resourceType === 'other' && reqUrl.includes('/track/'))
            ) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Login if credentials provided
        if (options.email && options.password) {
            progressTracker?.updateProgress(12, 'authenticating', 'Logging into StuDocu...');

            console.log("🔑 Logging in to StuDocu...");
            await page.goto('https://www.studocu.com/en-us/login', { waitUntil: 'domcontentloaded', timeout: 60000 }); // Reduced timeout from 120000
            await page.waitForSelector('#email', { timeout: 10000 }); // Reduced from 15000
            await page.type('#email', options.email);
            await page.type('#password', options.password);
            await page.click('button[type="submit"]');
            try {
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }); // Reduced from 30000
                await page.waitForSelector('.user-profile, [data-testid="user-menu"]', { timeout: 5000 }); // Reduced from 10000
                console.log("✅ Login successful.");
                progressTracker?.updateProgress(18, 'authenticated', 'Login successful');
            } catch (e) {
                console.error("❌ Login failed:", e.message);
                throw new Error("Login failed. Check credentials or try again.");
            }
        }

        // Removed homepage visit as it's not strictly necessary for session setup; directly navigate to URL
        progressTracker?.updateProgress(30, 'navigating', 'Navigating to document...');
        console.log(`📄 Navigating to ${url}...`);

        let navigationSuccess = false;
        let attempts = 0;
        const maxAttempts = 3; // Reduced from 5 to minimize retries
        while (!navigationSuccess && attempts < maxAttempts) {
            try {
                attempts++;
                progressTracker?.updateProgress(30 + (attempts * 5), 'navigating', `Navigation attempt ${attempts}/${maxAttempts}`);
                console.log(`Navigation attempt ${attempts}/${maxAttempts}`);
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Reduced timeout from 150000
                navigationSuccess = true;
            } catch (e) {
                console.log(`Navigation attempt ${attempts} failed:`, e.message);
                if (attempts >= maxAttempts) throw e;
                await new Promise(resolve => setTimeout(resolve, 5000)); // Reduced retry delay from 15000 to 5000ms
            }
        }

        progressTracker?.updateProgress(40, 'loading', 'Page loaded, waiting for content...');
        await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced from 5000ms

        // Apply content unblurring
        await unblurContent(page, progressTracker);

        // Wait for document content
        progressTracker?.updateProgress(45, 'loading', 'Waiting for document content...');
        console.log("⏳ Waiting for document content to load...");

        const contentSelectors = [
            '.document-content', '.page-content', '[data-page]', '[data-testid*="document"]',
            'img[src*="document"]', 'img[src*="page"]', '.page', 'main img', 'article img'
        ];
        let contentFound = false;
        for (const selector of contentSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 10000 }); // Reduced from 20000
                console.log(`✅ Found content with selector: ${selector}`);
                contentFound = true;
                break;
            } catch (e) {
                console.log(`❌ Selector ${selector} not found, trying next...`);
            }
        }

        if (!contentFound) {
            console.log("⚠️ No specific content selector found, proceeding with page content...");
        }

        // Enhanced scrolling to load all content (Optimized: Increased scroll distance, reduced delays)
        progressTracker?.updateProgress(50, 'scrolling', 'Loading all document pages...');
        console.log("📜 Loading all document pages with enhanced slow scroll...");

        await page.evaluate(async () => {
            const delay = (ms) => new Promise((res) => setTimeout(res, ms));
            let scrollHeight = document.body.scrollHeight;
            while (true) {
                let totalHeight = 0;
                const distance = 600; // Increased from 300 for faster coverage
                while (totalHeight < scrollHeight) {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    await delay(200); // Reduced from 500ms
                }
                await delay(1000); // Reduced from 2000ms
                const newHeight = document.body.scrollHeight;
                if (newHeight === scrollHeight) break;
                scrollHeight = newHeight;
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
            await delay(500); // Reduced from 1000ms
        });

        progressTracker?.updateProgress(70, 'processing', 'Processing loaded content...');

        // Re-apply unblur after loading new content
        await unblurContent(page, progressTracker);

        // Wait for all images to load (Optimized: Reduced per-image timeout, parallel wait)
        progressTracker?.updateProgress(75, 'loading_images', 'Loading images...');
        console.log("🖼️ Waiting for all images to load...");

        await page.evaluate(async () => {
            const images = Array.from(document.querySelectorAll('img'));
            await Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise((resolve) => {
                    img.addEventListener('load', resolve);
                    img.addEventListener('error', resolve);
                    setTimeout(resolve, 5000); // Reduced from 15000ms
                });
            }));
        });

        await new Promise(resolve => setTimeout(resolve, 2000)); // Reduced from 5000ms
        progressTracker?.updateProgress(80, 'finalizing', 'Preparing document for PDF generation...');

        // Set exact height
        await page.evaluate(() => {
            const getDocumentHeight = () => Math.max(
                document.body.scrollHeight, document.body.offsetHeight,
                document.documentElement.clientHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight
            );
            const height = getDocumentHeight();
            document.body.style.height = `${height}px !important`;
            document.documentElement.style.height = `${height}px !important`;
            document.body.style.overflow = 'hidden !important';
        });

        // Content verification (Unchanged, as it's quick)
        const contentCheck = await page.evaluate(() => {
            const textContent = document.body.textContent || '';
            const images = document.querySelectorAll('img');
            const documentImages = Array.from(images).filter(img =>
                img.src.includes('document') || img.src.includes('page') ||
                img.alt.includes('document') || img.alt.includes('page')
            );
            return {
                totalText: textContent.length,
                totalImages: images.length,
                documentImages: documentImages.length,
                hasDocumentContent: documentImages.length > 0 || textContent.length > 1000
            };
        });

        console.log("📊 Content verification:", {
            textLength: contentCheck.totalText,
            images: contentCheck.totalImages,
            documentImages: contentCheck.documentImages,
            hasContent: contentCheck.hasDocumentContent
        });

        if (!contentCheck.hasDocumentContent) {
            console.warn("⚠️ Warning: Limited document content detected.");
        }

        // Apply print styles and generate PDF
        await applyPrintStyles(page, progressTracker);
        await page.emulateMediaType('print');

        progressTracker?.updateProgress(90, 'generating', 'Generating PDF...');
        console.log("🔄 Generating PDF...");

        const pdfBuffer = await page.pdf({
            printBackground: true,
            preferCSSPageSize: true, // Use the @page size
            displayHeaderFooter: false,
            timeout: 60000, // Reduced from 180000
            scale: 1,
            omitBackground: false
        });

        progressTracker?.updateProgress(100, 'completed', 'PDF generated successfully!');
        console.log(`✅ PDF generated successfully! Size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        return pdfBuffer;

    } catch (error) {
        progressTracker?.updateProgress(-1, 'error', error.message);
        console.error("❌ Error during PDF generation:", error);
        throw error;
    } finally {
        if (browser) {
            console.log("🔒 Closing browser...");
            try {
                await browser.close();
            } catch (e) {
                console.log("Error closing browser:", e.message);
            }
        }
    }
};

// --- API Routes --- (Unchanged)
app.post('/api/request-download', (req, res) => {
    const { url, email, password } = req.body;
    if (!url || !url.includes('studocu.com')) {
        return res.status(400).json({ error: 'Please provide a valid StuDocu URL.' });
    }

    const sessionId = Date.now().toString();
    const progressTracker = new ProgressTracker(sessionId);

    progressTrackers.set(sessionId, progressTracker);
    downloadJobs.set(sessionId, { status: 'processing' });

    console.log(`🎯 Processing request for: ${url} [Session: ${sessionId}]`);

    // Respond to the client immediately with the session ID
    res.json({ sessionId });

    // --- Start the PDF generation in the background ---
    studocuDownloader(url, { email, password }, progressTracker)
        .then(pdfBuffer => {
            // Store the successful result
            downloadJobs.set(sessionId, { status: 'completed', buffer: pdfBuffer });
            progressTrackers.delete(sessionId); // Clean up live tracker
        })
        .catch(error => {
            // Store the error
            downloadJobs.set(sessionId, { status: 'error', message: error.message });
            progressTrackers.delete(sessionId); // Clean up live tracker
        });
});

app.get('/api/progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const tracker = progressTrackers.get(sessionId);

    if (tracker) {
        // Job is in progress, return live data
        return res.json({
            sessionId,
            progress: tracker.progress,
            status: tracker.status,
            message: tracker.message,
            timestamp: new Date().toISOString()
        });
    }

    const job = downloadJobs.get(sessionId);
    if (job) {
        // Job is finished, return final state
        if (job.status === 'completed') {
            return res.json({ sessionId, progress: 100, status: 'completed', message: 'PDF generated successfully!' });
        }
        if (job.status === 'error') {
            return res.json({ sessionId, progress: -1, status: 'error', message: job.message });
        }
    }

    return res.status(404).json({ error: 'Session not found' });
});

app.get('/api/download/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const job = downloadJobs.get(sessionId);

    if (!job) {
        return res.status(404).json({ error: 'Download session not found or expired.' });
    }

    if (job.status === 'processing') {
        return res.status(400).json({ error: 'Download is still processing.' });
    }

    if (job.status === 'error') {
        return res.status(500).json({ error: `Failed to generate PDF: ${job.message}` });
    }

    if (job.status === 'completed' && job.buffer) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=studocu-document.pdf');
        res.send(job.buffer);
        // Optional: Clean up the job after download to save memory
        // downloadJobs.delete(sessionId);
    } else {
        res.status(500).json({ error: 'An unknown error occurred.' });
    }
});

// --- Health and Info Endpoints (Unchanged) ---
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeDownloads: progressTrackers.size
    });
});

app.get('/', (req, res) => {
    res.json({
        message: '🚀 Enhanced StuDocu Downloader API v5.2 - Real-time Progress Tracking with Stealth',
        version: '5.2.0',
        features: [
            '🍪 Advanced cookie banner bypass',
            '🔓 Premium content unblurring',
            '🔑 Login support for full access',
            '📊 Real-time progress tracking via polling',
            '📄 Clean PDF generation with print styles',
            '🕵️ Enhanced stealth to evade bot detection'
        ],
        endpoints: {
            request: 'POST /api/request-download (body: {url, filename?, email?, password?})',
            progress: 'GET /api/progress/:sessionId',
            download: 'GET /api/download/:sessionId',
            health: 'GET /health'
        }
    });
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});

app.listen(port, () => {
    console.log(`🚀 Enhanced StuDocu Downloader v5.2.0 running on http://localhost:${port}`);
    console.log(`✨ Features: Real-time progress tracking, enhanced stealth, and user feedback`);
});