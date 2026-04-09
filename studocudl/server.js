const express = require('express');
const path = require('path');
const { connect } = require('puppeteer-real-browser');
const cors = require('cors');
const { EventEmitter } = require('events');

// --- Stealth Plugin ---
const puppeteerExtra = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const stealthPlugin = StealthPlugin();
puppeteerExtra.use(stealthPlugin);
console.log('🕵️ Stealth plugin loaded with evasion modules:', stealthPlugin.enabledEvasions);

const app = express();
const port = 7860;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition']
}));

// Fallback CORS headers for all responses (including binary)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Expose-Headers', 'Content-Disposition');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.use(express.json());

// Serve frontend static files
const frontendPath = path.join(__dirname, '..', 'studocu');
app.use('/studocu', express.static(frontendPath));

// Serve index.html at root
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Progress Tracking and Job Storage ---
const progressTrackers = new Map();
const downloadJobs = new Map();

// Auto-cleanup completed/errored jobs after 15 minutes to prevent memory leaks
const JOB_TTL_MS = 15 * 60 * 1000;
function scheduleJobCleanup(sessionId) {
    setTimeout(() => {
        if (downloadJobs.has(sessionId)) {
            console.log(`🗑️ Cleaning up expired job: ${sessionId}`);
            downloadJobs.delete(sessionId);
        }
    }, JOB_TTL_MS);
}

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

// --- Puppeteer Logic ---
const bypassCookiesAndRestrictions = async (page, progressTracker) => {
    progressTracker?.updateProgress(5, 'bypassing', 'Setting up cookie bypass...');

    console.log("🍪 Starting comprehensive cookie and restriction bypass...");
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

    await page.addStyleTag({
        content: `
            [id*="cookie" i]:not(img):not(input), [class*="cookie" i]:not(img):not(input), [data-testid*="cookie" i], [aria-label*="cookie" i],
            .gdpr-banner, .gdpr-popup, .gdpr-modal, .consent-banner, .consent-popup, .consent-modal, .privacy-banner, .privacy-popup, .privacy-modal,
            .cookie-law, .cookie-policy, .cookie-compliance, .onetrust-banner-sdk, #onetrust-consent-sdk, .cmp-banner, .cmp-popup, .cmp-modal,
            [class*="CookieBanner"], [class*="CookieNotice"], [class*="ConsentBanner"], [class*="ConsentManager"], .cc-banner, .cc-window, .cc-compliance {
                display: none !important;
                visibility: hidden !important;
                opacity: 0 !important;
                z-index: -9999 !important;
                pointer-events: none !important;
            }
            [class*="blur" i], [class*="premium" i], [class*="paywall" i], [class*="sample-preview-blur" i] {
                filter: none !important;
                backdrop-filter: none !important;
                opacity: 1 !important;
                visibility: visible !important;
            }
            .document-content, .page-content, [data-page] {
                filter: none !important;
                opacity: 1 !important;
                visibility: visible !important;
                pointer-events: auto !important;
            }
            .fixed-overlay, .sticky-overlay, .content-overlay { display: none !important; }
            html, body { overflow: auto !important; position: static !important; }
        `
    });

    await page.evaluateOnNewDocument(() => {
        window.cookieConsent = { accepted: true };
        window.gtag = () => { };
        window.ga = () => { };
        window.dataLayer = [];

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        const element = node;
                        const text = element.textContent || '';
                        const className = element.className || '';
                        const id = element.id || '';
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
                            element.remove();
                        }
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        setInterval(() => {
            const cookieElements = document.querySelectorAll(`
                [id*="cookie" i]:not(img):not(input), [class*="cookie" i]:not(img):not(input), [data-testid*="cookie" i],
                .gdpr-banner, .consent-banner, .privacy-banner, .onetrust-banner-sdk, #onetrust-consent-sdk,
                .cmp-banner, .cc-banner
            `);
            cookieElements.forEach(el => el.remove());
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
                        el.style.filter = "none";
                        el.style.backdropFilter = "none";
                        el.style.opacity = "1";
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
        const intervalId = setInterval(removeRestrictions, 1000);
        setTimeout(() => clearInterval(intervalId), 30000);
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
                size: A4 portrait;
                margin: 0mm;
            }
            @media print {
                html, body {
                    width: 210mm !important;
                    height: auto !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    background: white !important;
                    color: black !important;
                }
                header, footer, nav, aside, .no-print, .ads, .sidebar, .premium-banner,
                [class*="Header"], [class*="Footer"], [class*="Sidebar"], [id*="Header"],
                .ViewerToolbar, .Layout_info-bar-wrapper__He0Ho, .Sidebar_sidebar-scrollable__kqeBZ,
                .HeaderWrapper_header-wrapper__mCmf3, .Layout_visible-content-bottom-wrapper-sticky__yaaAB,
                .Layout_bottom-section-wrapper__yBWWk, .Layout_footer-wrapper__bheJQ,
                .InlineBanner_inline-banner-wrapper__DAi5X, .banner-wrapper, #top-bar-wrapper,
                .Layout_sidebar-wrapper__unavM, .Layout_is-open__9DQr4 {
                    display: none !important;
                }
                * {
                    box-shadow: none !important;
                    background: transparent !important;
                    color: inherit !important;
                }
                .Viewer_document-wrapper__JPBWQ, .Viewer_document-wrapper__LXzoQ,
                .Viewer_document-wrapper__XsO4j, .page-content, .document-viewer, #page-container {
                    position: static !important;
                    display: block !important;
                    width: 100% !important;
                    max-width: none !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    box-sizing: border-box;
                    transform: none !important;
                }
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
        (document.head || document.documentElement).appendChild(style);
    });

    progressTracker?.updateProgress(88, 'styling', 'Print styles applied successfully');
};

// FIX: Safe scroll function that runs in Node.js (not inside page.evaluate)
// to avoid the protocolTimeout issue with long-running evaluate calls.
const scrollPageFully = async (page, progressTracker) => {
    console.log("📜 Loading all document pages with safe incremental scroll...");
    progressTracker?.updateProgress(50, 'scrolling', 'Scrolling to load all pages...');

    const SCROLL_DISTANCE = 600;        // px per scroll step
    const STEP_DELAY_MS = 350;          // ms between each scroll step
    const SETTLE_DELAY_MS = 2500;       // ms to wait after reaching bottom before re-checking
    const MAX_SCROLL_ITERATIONS = 300;  // safety cap (~180s max scroll time)
    const NO_CHANGE_THRESHOLD = 3;      // confirm page is done after 3 unchanged heights

    let noChangeCount = 0;
    let iteration = 0;
    let lastScrollHeight = await page.evaluate(() => document.body.scrollHeight);

    while (noChangeCount < NO_CHANGE_THRESHOLD && iteration < MAX_SCROLL_ITERATIONS) {
        iteration++;

        // Scroll down one step
        await page.evaluate((dist) => window.scrollBy(0, dist), SCROLL_DISTANCE);
        await new Promise(r => setTimeout(r, STEP_DELAY_MS));

        const currentPosition = await page.evaluate(() => window.scrollY + window.innerHeight);
        const scrollHeight = await page.evaluate(() => document.body.scrollHeight);

        if (currentPosition >= scrollHeight) {
            // We've reached the bottom — wait for lazy content to load
            await new Promise(r => setTimeout(r, SETTLE_DELAY_MS));
            const newScrollHeight = await page.evaluate(() => document.body.scrollHeight);

            if (newScrollHeight === lastScrollHeight) {
                noChangeCount++;
                console.log(`📍 Bottom reached, no new content (${noChangeCount}/${NO_CHANGE_THRESHOLD})`);
            } else {
                noChangeCount = 0;
                console.log(`📄 Page grew from ${lastScrollHeight} to ${newScrollHeight}px, continuing...`);
                lastScrollHeight = newScrollHeight;
            }
        }
    }

    if (iteration >= MAX_SCROLL_ITERATIONS) {
        console.warn(`⚠️ Scroll hit max iteration limit (${MAX_SCROLL_ITERATIONS}). Proceeding anyway.`);
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await new Promise(r => setTimeout(r, 1000));
    console.log(`✅ Scrolling complete after ${iteration} steps.`);
};

const studocuDownloader = async (url, options = {}, progressTracker = null) => {
    let browser;
    try {
        progressTracker?.updateProgress(0, 'initializing', 'Starting browser...');

        console.log("🚀 Launching browser with puppeteer-real-browser...");
        const connection = await connect({
            headless: false,
            turnstile: true,
            fingerprint: true,
            disableXvfb: false,
            // FIX: Increase protocol timeout to 3 minutes to handle slow page evaluations
            protocolTimeout: 180000,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1280,900',
                '--window-position=0,0',
                '--start-maximized',
                '--disable-blink-features=AutomationControlled',
                '--disable-extensions-except=',
                '--disable-plugins-discovery',
                '--no-first-run',
                '--no-default-browser-check',
                '--lang=en-US,en',
                '--ignore-certificate-errors',
                '--allow-running-insecure-content',
            ],
            customConfig: {},
        });

        browser = connection.browser;
        const page = connection.page;

        progressTracker?.updateProgress(2, 'initializing', 'Browser ready, configuring...');

        // Apply stealth evasions
        console.log('🕵️ Applying stealth evasions to page...');
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
                configurable: true
            });

            if (!window.chrome) {
                window.chrome = {
                    app: { isInstalled: false },
                    runtime: {},
                    csi: () => {},
                    loadTimes: () => {},
                };
            }

            const makePluginArray = () => {
                const plugins = [
                    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                    { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
                ];
                const pluginArray = Object.create(PluginArray.prototype);
                plugins.forEach((p, i) => {
                    const plugin = Object.create(Plugin.prototype);
                    Object.defineProperty(plugin, 'name', { get: () => p.name });
                    Object.defineProperty(plugin, 'filename', { get: () => p.filename });
                    Object.defineProperty(plugin, 'description', { get: () => p.description });
                    Object.defineProperty(plugin, 'length', { get: () => 0 });
                    Object.defineProperty(pluginArray, i, { get: () => plugin });
                    Object.defineProperty(pluginArray, p.name, { get: () => plugin });
                });
                Object.defineProperty(pluginArray, 'length', { get: () => plugins.length });
                return pluginArray;
            };
            Object.defineProperty(navigator, 'plugins', { get: makePluginArray, configurable: true });

            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });
            Object.defineProperty(navigator, 'language', { get: () => 'en-US', configurable: true });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true });

            // WebGL spoofing
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                if (gl) {
                    const getParameter = gl.getParameter.bind(gl);
                    gl.getParameter = new Proxy(getParameter, {
                        apply(target, ctx, args) {
                            if (args[0] === 37445) return 'Intel Inc.';
                            if (args[0] === 37446) return 'Intel Iris OpenGL Engine';
                            return Reflect.apply(target, ctx, args);
                        }
                    });
                }
            } catch (e) { /* ignore */ }

            if (window.outerWidth === 0) Object.defineProperty(window, 'outerWidth', { get: () => 1280, configurable: true });
            if (window.outerHeight === 0) Object.defineProperty(window, 'outerHeight', { get: () => 900, configurable: true });
        });
        console.log('✅ Stealth evasions applied successfully');

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
        });

        await page.setViewport({ width: 1280, height: 900 });

        // Login if credentials provided
        if (options.email && options.password) {
            progressTracker?.updateProgress(12, 'authenticating', 'Logging into StuDocu...');
            console.log("🔑 Logging in to StuDocu...");
            await page.goto('https://www.studocu.com/en-us/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForSelector('#email', { timeout: 10000 });
            await page.type('#email', options.email);
            await page.type('#password', options.password);
            await page.click('button[type="submit"]');
            try {
                await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
                await page.waitForSelector('.user-profile, [data-testid="user-menu"]', { timeout: 5000 });
                console.log("✅ Login successful.");
                progressTracker?.updateProgress(18, 'authenticated', 'Login successful');
            } catch (e) {
                console.error("❌ Login failed:", e.message);
                throw new Error("Login failed. Check credentials or try again.");
            }
        }

        // Navigate to document URL (with retries)
        progressTracker?.updateProgress(30, 'navigating', 'Navigating to document...');
        console.log(`📄 Navigating to ${url}...`);

        let navigationSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;
        while (!navigationSuccess && attempts < maxAttempts) {
            try {
                attempts++;
                progressTracker?.updateProgress(30 + (attempts * 5), 'navigating', `Navigation attempt ${attempts}/${maxAttempts}`);
                console.log(`Navigation attempt ${attempts}/${maxAttempts}`);
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
                navigationSuccess = true;
            } catch (e) {
                console.log(`Navigation attempt ${attempts} failed:`, e.message);
                if (attempts >= maxAttempts) throw e;
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        progressTracker?.updateProgress(40, 'loading', 'Page loaded, checking for Cloudflare challenge...');

        // Wait for Cloudflare Turnstile to resolve
        console.log('🛡️ Checking for Cloudflare challenge...');
        const maxCfWait = 90000;
        const cfStart = Date.now();
        let cfBypassed = false;
        while (Date.now() - cfStart < maxCfWait) {
            const pageTitle = await page.title();
            console.log(`  🔍 Page title: "${pageTitle}"`);

            if (!pageTitle.includes('Just a moment') && !pageTitle.includes('Attention Required') && !pageTitle.includes('Checking')) {
                console.log('✅ Cloudflare challenge bypassed!');
                cfBypassed = true;
                break;
            }

            progressTracker?.updateProgress(42, 'loading', 'Waiting for security check to complete...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        if (!cfBypassed) {
            throw new Error('Cloudflare security challenge could not be bypassed. Try again later or use a different IP.');
        }

        await new Promise(resolve => setTimeout(resolve, 5000));

        // Wait for document content
        progressTracker?.updateProgress(45, 'loading', 'Waiting for document content...');
        console.log("⏳ Waiting for document content to load...");

        const contentSelectors = [
            'img[src*="d-cdn.net"]',
            'img[src*="studocu"]',
            'img[data-src]',
            '[class*="DocumentViewer"]',
            '[class*="PageViewer"]',
            '[class*="Viewer_document"]',
            '[class*="viewer"] img',
            '[data-page]',
            'main img',
            'img[alt*="Page"]',
            'img[loading="lazy"]',
            '.page-content',
            '.document-content',
        ];
        let contentFound = false;
        for (const selector of contentSelectors) {
            try {
                await page.waitForSelector(selector, { timeout: 8000 });
                const count = await page.$$eval(selector, els => els.length);
                console.log(`✅ Found ${count} elements with selector: ${selector}`);
                contentFound = true;
                break;
            } catch (e) {
                console.log(`❌ Selector ${selector} not found, trying next...`);
            }
        }

        if (!contentFound) {
            console.log("⚠️ No specific content selector found, proceeding with page content...");
            const debugInfo = await page.evaluate(() => {
                const imgs = document.querySelectorAll('img');
                return {
                    imageCount: imgs.length,
                    imageSrcs: Array.from(imgs).slice(0, 10).map(i => i.src?.substring(0, 100)),
                    bodyClasses: document.body.className,
                    title: document.title,
                    url: window.location.href
                };
            });
            console.log('🔍 Page debug info:', JSON.stringify(debugInfo, null, 2));
        }

        // FIX: Use safe Node.js-side scroll instead of a long-running page.evaluate
        await scrollPageFully(page, progressTracker);

        progressTracker?.updateProgress(70, 'processing', 'Processing loaded content...');

        // Re-apply unblur after scrolling
        await unblurContent(page, progressTracker);

        // Force-load lazy images
        progressTracker?.updateProgress(75, 'loading_images', 'Loading images...');
        console.log("🖼️ Waiting for all images to load...");

        await page.evaluate(() => {
            document.querySelectorAll('img[data-src]').forEach(img => {
                if (!img.src || img.src === '') img.src = img.dataset.src;
            });
        });

        // Wait for images with a short per-image timeout (non-blocking)
        await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img'));
            return Promise.all(images.map(img => {
                if (img.complete && img.naturalWidth > 0) return Promise.resolve();
                return new Promise((resolve) => {
                    img.addEventListener('load', resolve, { once: true });
                    img.addEventListener('error', resolve, { once: true });
                    setTimeout(resolve, 8000);
                });
            }));
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
        progressTracker?.updateProgress(80, 'finalizing', 'Preparing document for PDF generation...');

        // Set exact document height
        await page.evaluate(() => {
            const height = Math.max(
                document.body.scrollHeight, document.body.offsetHeight,
                document.documentElement.clientHeight, document.documentElement.scrollHeight,
                document.documentElement.offsetHeight
            );
            document.body.style.height = `${height}px`;
            document.documentElement.style.height = `${height}px`;
            document.body.style.overflow = 'hidden';
        });

        // Content verification
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

        // Resize viewport to A4 for PDF generation
        await page.setViewport({ width: 794, height: 1122 });
        await new Promise(resolve => setTimeout(resolve, 1000));

        await applyPrintStyles(page, progressTracker);
        await page.emulateMediaType('print');

        progressTracker?.updateProgress(90, 'generating', 'Generating PDF...');
        console.log("🔄 Generating PDF...");

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: false,
            displayHeaderFooter: false,
            timeout: 120000,
            scale: 0.8,
            omitBackground: false,
            margin: { top: '10mm', bottom: '10mm', left: '5mm', right: '5mm' }
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

// --- API Routes ---
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

    res.json({ sessionId });

    studocuDownloader(url, { email, password }, progressTracker)
        .then(pdfBuffer => {
            downloadJobs.set(sessionId, { status: 'completed', buffer: pdfBuffer });
            progressTrackers.delete(sessionId);
            scheduleJobCleanup(sessionId); // FIX: auto-cleanup after TTL
        })
        .catch(error => {
            downloadJobs.set(sessionId, { status: 'error', message: error.message });
            progressTrackers.delete(sessionId);
            scheduleJobCleanup(sessionId); // FIX: auto-cleanup after TTL
        });
});

app.get('/api/progress/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const tracker = progressTrackers.get(sessionId);

    if (tracker) {
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
        if (job.status === 'completed') {
            return res.json({ sessionId, progress: 100, status: 'completed', message: 'PDF generated successfully!' });
        }
        if (job.status === 'error') {
            return res.json({ sessionId, progress: -1, status: 'error', message: job.message });
        }
        // Still processing (tracker was just deleted mid-flight)
        return res.json({ sessionId, progress: 0, status: 'processing', message: 'Processing...' });
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
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=studocu-document.pdf');
        res.setHeader('Content-Length', job.buffer.length);
        res.send(job.buffer);
    } else {
        res.status(500).json({ error: 'An unknown error occurred.' });
    }
});

// Health endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        activeDownloads: progressTrackers.size,
        storedJobs: downloadJobs.size
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
    console.log(`🚀 Enhanced StuDocu Downloader v5.3.0 running on http://localhost:${port}`);
    console.log(`✨ Features: Real-time progress tracking, enhanced stealth, safe scroll, auto job cleanup`);
});