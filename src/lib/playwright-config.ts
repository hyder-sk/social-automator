import { chromium, Browser, BrowserContext, Page } from 'playwright';

// Global browser configuration
const BROWSER_CONFIG = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--disable-gpu',
    '--window-size=1920x1080',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process',
  ]
};

// Global context configuration
const CONTEXT_CONFIG = {
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  locale: 'en-US',
  timezoneId: 'America/New_York',
  permissions: ['geolocation'],
  geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York coordinates
  deviceScaleFactor: 1,
  hasTouch: false,
  isMobile: false,
  acceptDownloads: true,
};

// Update the ProxyConfig interface
interface ProxyConfig {
  type?: string;  // Make type optional
  server: string;
  port: string;
  username?: string;
  password?: string;
}

// Manual stealth scripts
const STEALTH_SCRIPTS = {
  context: `
    // Override navigator properties
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    // Override window properties
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };
  `,
  page: `
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
  `
};

// Global browser instance
let globalBrowser: Browser | null = null;

// Initialize global browser
export async function initGlobalBrowser() {
  if (!globalBrowser) {
    globalBrowser = await chromium.launch(BROWSER_CONFIG);
  }
  return globalBrowser;
}

// Helper function to parse cookies
function parseCookies(cookies: string) {
  try {
    // First try parsing as JSON
    return JSON.parse(cookies);
  } catch {
    // If not JSON, parse as cookie string
    return cookies.split(';').map(cookie => {
      const [name, value] = cookie.trim().split('=');
      return {
        name,
        value,
        domain: '.facebook.com',
        path: '/',
        secure: true,
        httpOnly: true,
        sameSite: 'Lax'
      };
    });
  }
}

// Create a new context with stealth configuration
export async function createStealthContext(cookies?: string, proxyConfig?: ProxyConfig): Promise<BrowserContext> {
  const browser = await initGlobalBrowser();
  
  // Merge proxy configuration if provided
  const contextConfig = {
    ...CONTEXT_CONFIG,
    ...(proxyConfig && {
      proxy: {
        server: proxyConfig.type ? 
          `${proxyConfig.type}://${proxyConfig.server}:${proxyConfig.port}` : 
          `http://${proxyConfig.server}:${proxyConfig.port}`,
        username: proxyConfig.username,
        password: proxyConfig.password
      }
    })
  };

  const context = await browser.newContext(contextConfig);

  // Add cookies if provided
  if (cookies) {
    try {
      const parsedCookies = parseCookies(cookies);
      await context.addCookies(parsedCookies);
    } catch (error) {
      console.error('Error parsing cookies:', error);
    }
  }

  // Add manual stealth scripts to context
  await context.addInitScript(STEALTH_SCRIPTS.context);

  return context;
}

// Create a new page with stealth configuration
export async function createStealthPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.addInitScript(STEALTH_SCRIPTS.page);
  return page;
}

// Cleanup function to close the global browser
export async function cleanup() {
  if (globalBrowser) {
    await globalBrowser.close();
    globalBrowser = null;
  }
}

// Helper function to create a complete stealth setup
export async function createStealthSetup(cookies?: string, proxyConfig?: ProxyConfig, headless: boolean = true) {
  const browser = await chromium.launch({
    ...BROWSER_CONFIG,
    headless
  });

  // Initialize context with the browser instance
  const contextConfig = {
    ...CONTEXT_CONFIG,
    ...(proxyConfig && {
      proxy: {
        server: proxyConfig.type ? 
          `${proxyConfig.type}://${proxyConfig.server}:${proxyConfig.port}` : 
          `http://${proxyConfig.server}:${proxyConfig.port}`,
        username: proxyConfig.username,
        password: proxyConfig.password
      }
    })
  };

  const context = await browser.newContext(contextConfig);
  
  // Add cookies and scripts as before
  if (cookies) {
    try {
      const parsedCookies = parseCookies(cookies);
      await context.addCookies(parsedCookies);
    } catch (error) {
      console.error('Error parsing cookies:', error);
    }
  }

  await context.addInitScript(STEALTH_SCRIPTS.context);
  const page = await context.newPage();
  await page.addInitScript(STEALTH_SCRIPTS.page);
  
  return { context, page };
}

// // Add proxy validation function
// export async function validateProxy(proxyConfig: ProxyConfig): Promise<boolean> {
//   try {
//     const { page } = await createStealthSetup(undefined, proxyConfig);
    
//     // Navigate to the IP check endpoint
//     const response = await page.goto('h', { 
//       timeout: 30000,
//       waitUntil: 'networkidle'
//     });

//     if (!response) {
//       console.error('No response received from IP check');
//       return false;
//     }

//     // Check if the response is OK
//     if (!response.ok()) {
//       console.error('IP check failed with status:', response.status());
//       return false;
//     }

//     // Get the response text
//     const content = await response.text();
    
//     try {
//       const ipData = JSON.parse(content);
//       await page.close();
//       return true;
//     } catch (parseError) {
//       console.error('Failed to parse IP check response:', content);
//       return false;
//     }
//   } catch (error) {
//     console.error('Proxy validation failed:', error);
//     return false;
//   }
// }

// Export the configured chromium instance
export { chromium };

export const getProxyParamsA = () => ({
  proxy_type: 'socks5',
  server: '127.0.0.1',
  port: '1080',
  proxy_username: '',  // Empty string instead of undefined
  proxy_password: '',  // Empty string instead of undefined
  proxy_country: 'US',
  proxy_rotation_interval: 3600
}); 